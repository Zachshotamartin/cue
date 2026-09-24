import { bundle } from "@remotion/bundler";
import {
  makeCancelSignal,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import fs from "node:fs/promises";
import path from "node:path";
import { finalizeFilm } from "../../packages/compositor/output";
import type { Draft, Job } from "../../packages/contracts";
import {
  assetSignature,
  dataDir,
  origin,
  root,
} from "../../packages/storage/config";
import { assets, takes } from "../../packages/storage/db";
import {
  attachExportManifest,
  validateExportInput,
} from "../../packages/storage/manifest";
import { importMedia } from "../../packages/storage/media";
import { createRenderMonitor } from "./render-monitor";
let serveUrl: string | null = null;
export async function compositionBundle() {
  if (!serveUrl)
    serveUrl = await bundle({
      entryPoint: path.join(root, "packages/compositor/entry.tsx"),
      outDir: path.join(dataDir, "composition"),
      publicDir: path.join(root, "apps/editor/public"),
      webpackOverride: (c) => c,
    });
  return serveUrl;
}
export async function renderFilm(job: Job) {
  await validateExportInput(job);
  const draft: Draft = job.payload.draft;
  if (!draft.shots.length) throw new Error("Add scenes before exporting.");
  const inputProps = {
    draft,
    assets: await assets(job.projectId),
    takes: await takes(job.projectId),
    urls: Object.fromEntries(
      (await assets(job.projectId)).map((a) => [
        a.id,
        `${origin}/api/assets/${a.id}?signature=${assetSignature(a.id)}`,
      ]),
    ),
  };
  const serve = await compositionBundle();
  const browserExecutable =
    process.env.CUE_CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executable = await fs
    .access(browserExecutable)
    .then(() => browserExecutable)
    .catch(() => undefined);
  const composition = await selectComposition({
    serveUrl: serve,
    id: "CueFilm",
    inputProps,
    browserExecutable: executable,
  });
  const output = path.join(dataDir, `render-${job.id}.mp4`);
  const { cancel, cancelSignal } = makeCancelSignal();
  const monitor = createRenderMonitor(job, cancel);
  try {
    await renderMedia({
      composition,
      serveUrl: serve,
      codec: "h264",
      pixelFormat: "yuv420p",
      outputLocation: output,
      inputProps,
      concurrency: 1,
      browserExecutable: executable,
      cancelSignal,
      crf: 20,
      onProgress: monitor.onProgress,
    });
    await monitor.stop();
    await finalizeFilm(output, {
      width: composition.width,
      height: composition.height,
      duration: draft.shots.reduce((n, s) => n + s.duration, 0),
    });
    const asset = await importMedia(
      job.projectId,
      await fs.readFile(output),
      `${draft.title}-${draft.format}.mp4`,
      { state: "export", title: draft.title },
    );
    await attachExportManifest(asset.id, job);
    const poster = path.join(dataDir, `poster-${job.id}.png`);
    await renderStill({
      composition,
      serveUrl: serve,
      inputProps,
      output: poster,
      frame: Math.min(30, composition.durationInFrames - 1),
      browserExecutable: executable,
    });
    await importMedia(
      job.projectId,
      await fs.readFile(poster),
      `${draft.title}-poster.png`,
      { state: "export-poster" },
    );
    await fs.unlink(poster).catch(() => {});
    return asset;
  } finally {
    await fs.unlink(output).catch(() => {});
    await monitor.stop();
  }
}
