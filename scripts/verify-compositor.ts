/** Synthetic media verification. No account data, API key or paid provider request. */
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ffmpeg from "ffmpeg-static";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  defaultDraft,
  shotSchema,
  dimensions,
  type Asset,
} from "../packages/contracts";
import { finalizeFilm } from "../packages/compositor/output";
import { run } from "../packages/storage/media";
import { inspectFilm } from "../packages/director/quality";
import type { FilmProps } from "../packages/compositor/types";
import sharp from "sharp";
import { createServer } from "node:http";
const root = process.cwd(),
  out = path.join(root, ".data/compositor-verification");
await fs.mkdir(out, { recursive: true });
const source = path.join(out, "source.mp4"),
  speech = path.join(out, "tone.wav");
await run(ffmpeg!, [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=s=960x540:r=30:d=7",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-threads",
  "2",
  "-y",
  source,
]);
await run(ffmpeg!, [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=400:duration=1",
  "-af",
  "volume=0.15",
  "-y",
  speech,
]);
const files = new Map([
  ["/source.mp4", source],
  ["/tone.wav", speech],
]);
const server = createServer(async (req, res) => {
  const file = files.get(req.url || "");
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  const bytes = await fs.readFile(file);
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0,
    end = range?.[2] ? Number(range[2]) : bytes.length - 1;
  res.writeHead(range ? 206 : 200, {
    "Content-Type": file.endsWith(".mp4") ? "video/mp4" : "audio/wav",
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    ...(range
      ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
      : {}),
  });
  res.end(bytes.subarray(start, end + 1));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const address = server.address();
assert(address && typeof address === "object");
const mediaOrigin = `http://127.0.0.1:${address.port}`;
try {
  const assets: Asset[] = [],
    urls: Record<string, string> = {};
  for (const [id, file, mime, kind, duration] of [
    ["video", source, "video/mp4", "video", 7],
    ["audio", speech, "audio/wav", "audio", 1],
  ] as const) {
    const bytes = await fs.readFile(file);
    assets.push({
      id,
      projectId: "verify",
      kind,
      name: path.basename(file),
      mime,
      bytes: bytes.length,
      hash: createHash("sha256").update(bytes).digest("hex"),
      path: file,
      createdAt: new Date().toISOString(),
      duration,
      ...(kind === "video" ? { width: 960, height: 540 } : {}),
      metadata: {},
    });
    urls[id] = `${mediaOrigin}/${path.basename(file)}`;
  }
  const draft = defaultDraft("Export verification");
  draft.productName = "Cue";
  draft.objective = "demonstration";
  draft.targetSeconds = 15;
  draft.ctaUrl = "https://example.com/demo";
  draft.musicAssetId = "audio";
  draft.musicVolume = 0.08;
  draft.shots = [
    shotSchema.parse({
      id: "a",
      title: "Show the action",
      assetId: "video",
      template: "showcase",
      mode: "exact-ui",
      duration: 2,
      caption: "Record the real workflow",
      prompt: "",
      motion: "still",
      trimStart: 1,
      action: "Inspect the product",
      outcome: "See the changing source",
      emphasis: [
        { at: 0.8, x: 0.6, y: 0.4, duration: 0.5, label: "A real action" },
      ],
      narrationAssetId: "audio",
      speechCues: [{ start: 0, end: 1, text: "Record the real workflow." }],
    }),
    shotSchema.parse({
      id: "b",
      title: "See the result",
      assetId: "video",
      template: "closeup",
      mode: "exact-ui",
      duration: 2,
      caption: "Focus on the result",
      prompt: "",
      motion: "still",
      trimStart: 3,
      playbackRate: 1.5,
      focalEnd: { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
    }),
    shotSchema.parse({
      id: "c",
      title: "Try Cue",
      assetId: null,
      template: "endcard",
      mode: "exact-ui",
      duration: 2,
      caption: "Make your product worth watching.",
      prompt: "",
      motion: "still",
    }),
  ];
  draft.soundCues = [
    {
      id: "cue",
      assetId: "audio",
      at: 3.5,
      duration: 0.5,
      trimStart: 0,
      volume: 0.05,
      fade: 0.1,
    },
  ];
  assert.equal(inspectFilm(draft, assets).filter((i) => i.blocking).length, 0);
  const serveUrl = await bundle({
    entryPoint: path.join(root, "packages/compositor/entry.tsx"),
    outDir: path.join(out, "bundle"),
    publicDir: path.join(root, "apps/editor/public"),
  });
  const browserExecutable =
    process.env.CUE_CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const results = [];
  for (const format of ["landscape", "portrait", "square"] as const) {
    const inputProps: FilmProps = {
      draft: { ...draft, format },
      assets,
      takes: [],
      urls,
    };
    const composition = await selectComposition({
      serveUrl,
      id: "CueFilm",
      inputProps,
      browserExecutable,
    });
    const outputLocation = path.join(out, `${format}.mp4`);
    console.log(`Rendering ${format}…`);
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      pixelFormat: "yuv420p",
      outputLocation,
      browserExecutable,
      concurrency: 1,
      crf: 23,
    });
    const info = await finalizeFilm(outputLocation, {
      ...dimensions(format),
      duration: 6,
    });
    assert(
      info.streams.some(
        (s: { codec_type: string }) => s.codec_type === "audio",
      ),
    );
    for (const frame of [1, 59, 60, 61, 90, 150]) {
      const output = path.join(out, `${format}-${frame}.png`);
      await renderStill({
        serveUrl,
        composition,
        inputProps,
        output,
        browserExecutable,
        frame,
      });
      const stat = await sharp(output).stats();
      assert(
        stat.channels.some((c) => c.stdev > 5),
        `Unexpected empty frame ${format}/${frame}`,
      );
    }
    const { stderr } = await run(
      ffmpeg!,
      [
        "-hide_banner",
        "-i",
        outputLocation,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f",
        "null",
        "-",
      ],
      { timeout: 30000, maxBuffer: 1048576 },
    );
    const measurement = JSON.parse(stderr.slice(stderr.lastIndexOf("{")));
    assert(
      Number(measurement.input_tp) <= -1.0,
      "Audio peaks exceed the permitted ceiling",
    );
    assert(
      Math.abs(Number(measurement.input_i) + 16) < 1.5,
      "Integrated loudness missed the target",
    );
    results.push({
      format,
      ...dimensions(format),
      seconds: Number(info.format.duration),
      audio: true,
      integratedLUFS: Number(measurement.input_i),
      truePeakDB: Number(measurement.input_tp),
      frames: [1, 59, 60, 61, 90, 150],
    });
    console.log(
      `${format}: dimensions, timing, audio and six representative frames passed`,
    );
  }
  await fs.writeFile(
    path.join(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
