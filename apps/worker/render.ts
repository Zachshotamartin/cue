import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  makeCancelSignal,
  renderStill,
} from "@remotion/renderer";
import {
  dataDir,
  root,
  origin,
  assetSignature,
} from "../../packages/storage/config";
import { assets, takes, updateJob, getJob } from "../../packages/storage/db";
import { importMedia, inspect, run } from "../../packages/storage/media";
import type { Job, Draft } from "../../packages/contracts";
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
  const check = setInterval(async () => {
    if ((await getJob(job.id)).cancelRequested) cancel();
  }, 1000);
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
      onProgress: async ({ progress }) => {
        const j = await getJob(job.id);
        if (Math.round(progress * 90) > j.progress)
          await updateJob(j, {
            progress: Math.round(progress * 90),
            leaseUntil: Date.now() + 60000,
          });
      },
    });
    let info = await inspect(output);
    if (info.streams?.some((s: any) => s.codec_type === "audio")) {
      const limited = `${output}.limited.mp4`;
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          output,
          "-c:v",
          "copy",
          "-af",
          "alimiter=limit=0.95:level=false",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          limited,
        ],
        { timeout: 180000 },
      );
      await fs.rename(limited, output);
      info = await inspect(output);
    }
    const video = info.streams?.find((s: any) => s.codec_type === "video");
    if (
      video?.width !== composition.width ||
      video?.height !== composition.height
    )
      throw new Error("The exported resolution failed validation.");
    const actual = Number(info.format?.duration),
      expected = draft.shots.reduce((n, s) => n + s.duration, 0);
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.2)
      throw new Error("The exported duration failed validation.");
    const asset = await importMedia(
      job.projectId,
      await fs.readFile(output),
      `${draft.title}-${draft.format}.mp4`,
      { state: "export", title: draft.title },
    );
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
    clearInterval(check);
    await fs.unlink(output).catch(() => {});
  }
}
