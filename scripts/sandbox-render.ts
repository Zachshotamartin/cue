import { finalizeFilm } from "../packages/compositor/output";
import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  renderStill,
} from "@remotion/renderer";
const endpoint = process.env.CUE_JOB_URL!,
  token = process.env.CUE_WORKER_TOKEN!;
if (!endpoint?.startsWith("https://") || !token)
  throw new Error("Missing render capability.");
async function call(op: string, method = "GET", data?: unknown) {
  const r = await fetch(`${endpoint}/${op}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`Render service returned ${r.status}`);
  return r.json();
}
async function upload(file: string, kind: "video" | "poster") {
  const bytes = await fs.readFile(file);
  if (bytes.length > 64 * 1024 * 1024)
    throw new Error("Export exceeds 64 MiB. Shorten the film.");
  for (let i = 0; i < bytes.length; i += 1048576) {
    const r = await fetch(`${endpoint}/chunks/${kind}/${i / 1048576}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: bytes.subarray(i, i + 1048576),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error("Export upload interrupted.");
  }
  return call(`complete/${kind}`, "POST", { bytes: bytes.length });
}
try {
  const manifest = await call("manifest");
  const inputProps = manifest.inputProps;
  const serve = await bundle({
    entryPoint: path.resolve("packages/compositor/entry.tsx"),
    outDir: "/tmp/cue-composition",
    publicDir: path.resolve("apps/editor/public"),
  });
  const composition = await selectComposition({
    serveUrl: serve,
    id: "CueFilm",
    inputProps,
  });
  let last = 0;
  const updates: Promise<any>[] = [];
  await renderMedia({
    composition,
    serveUrl: serve,
    codec: "h264",
    pixelFormat: "yuv420p",
    outputLocation: "/tmp/film.mp4",
    inputProps,
    concurrency: 2,
    crf: 20,
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 80) + 10;
      if (percent - last >= 10) {
        last = percent;
        updates.push(
          call("progress", "POST", { progress: percent }).catch(() => {}),
        );
      }
    },
  });
  await Promise.all(updates);
  await finalizeFilm("/tmp/film.mp4", {
    width: composition.width,
    height: composition.height,
    duration: composition.durationInFrames / composition.fps,
  });
  await upload("/tmp/film.mp4", "video");
  try {
    await renderStill({
      composition,
      serveUrl: serve,
      inputProps,
      output: "/tmp/poster.png",
      frame: Math.min(30, composition.durationInFrames - 1),
    });
    await upload("/tmp/poster.png", "poster");
  } catch {
    /* The completed film stays saved if an optional poster fails. */
  }
  await call("finished", "POST", {});
} catch {
  await call("failed", "POST", {}).catch(() => {});
  process.exitCode = 1;
}
