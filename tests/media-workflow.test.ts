import ffmpeg from "ffmpeg-static";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, expect, it } from "vitest";
import { shotSchema } from "../packages/contracts";
import { evidenceAssets } from "../packages/director";
import { analyzeAsset, visualEvidence } from "../packages/director/analysis";
import { dataDir } from "../packages/storage/config";
import {
  assets,
  createProject,
  db,
  editProject,
  enqueue,
  project,
  updateJob,
  validateRender,
} from "../packages/storage/db";
import { pruneHistory } from "../packages/storage/lifecycle";
import { importMedia, readAsset, run } from "../packages/storage/media";
import { pixelMask, redactMedia } from "../packages/storage/redaction";
import { restoreArchive } from "../packages/storage/restore";
const scene = (id: string) =>
  shotSchema.parse({
    id: "scene",
    title: "Demonstration",
    assetId: id,
    template: "showcase",
    mode: "exact-ui",
    duration: 3,
    caption: "Create a result",
    prompt: "",
    motion: "still",
    trimStart: 2,
  });
afterAll(async () => {
  await db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});
it("analyzes real video, uses late interactions, caches identical inputs, and redacts pixels", async () => {
  const p = await createProject("Workflow", "", "media-owner"),
    file = path.join(dataDir, "input.mp4");
  await run(ffmpeg!, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=white:s=320x180:r=12:d=6",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    "1",
    "-y",
    file,
  ]);
  const a = await importMedia(p.id, await fs.readFile(file), "workflow.mp4", {
    interactions: [
      { at: 3, type: "click", label: "Save", x: 0.5, y: 0.5 },
      { at: 4, type: "result", label: "Saved" },
    ],
  });
  const analyzed = await analyzeAsset(a),
    cache = analyzed.metadata.analysis as any;
  expect(cache.frames.length).toBeGreaterThan(2);
  expect(cache.frames.length).toBeLessThanOrEqual(12);
  expect(cache.segments[0].start).toBe(2.3);
  expect((await analyzeAsset(analyzed)).metadata.analysis).toEqual(cache);
  expect(
    (await visualEvidence([analyzed])).some((x) =>
      x.label.includes("recording frame"),
    ),
  ).toBe(true);
  const safe = await redactMedia(analyzed, {
    assetId: a.id,
    regions: [{ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }],
    removeAudio: true,
  });
  const masked = path.join(dataDir, "safe.mp4"),
    frame = path.join(dataDir, "safe.png");
  await fs.writeFile(masked, await readAsset(safe));
  await run(ffmpeg!, [
    "-v",
    "error",
    "-i",
    masked,
    "-frames:v",
    "1",
    "-y",
    frame,
  ]);
  const pixels = await sharp(frame).raw().toBuffer({ resolveWithObject: true });
  const offset = (90 * 320 + 160) * pixels.info.channels;
  expect(pixels.data[offset]).toBeLessThan(10);
  expect(pixels.data[0]).toBeGreaterThan(240);
  expect(
    evidenceAssets(p.draft, await assets(p.id)).map((x) => x.id),
  ).not.toContain(a.id);
  p.draft.shots = [scene(a.id)];
  await expect(validateRender(p.id, p.draft)).rejects.toThrow("safe copy");
  p.draft.shots = [scene(safe.id)];
  await expect(validateRender(p.id, p.draft)).resolves.toBeUndefined();
}, 30000);
it("clamps fractional right/bottom mask bounds without leaking border pixels", async () => {
  expect(
    pixelMask({ x: 0.9, y: 0.9, width: 0.1001, height: 0.1001 }, 31, 17),
  ).toEqual({ left: 27, top: 15, width: 4, height: 2 });
  const p = await createProject("Image", "", "mask-owner"),
    a = await importMedia(
      p.id,
      await sharp({
        create: { width: 31, height: 17, channels: 3, background: "white" },
      })
        .png()
        .toBuffer(),
      "sample.png",
    );
  const safe = await redactMedia(a, {
    assetId: a.id,
    regions: [{ x: 0.9, y: 0.9, width: 0.1001, height: 0.1001 }],
  });
  const bytes = await sharp(await readAsset(safe))
    .removeAlpha()
    .raw()
    .toBuffer();
  expect(bytes[bytes.length - 1]).toBe(0);
});
it("restores editable media with integrity checks and prunes dangling exclusions", async () => {
  const original = await createProject("Restore", "", "restore-owner"),
    image = await importMedia(
      original.id,
      await sharp({
        create: { width: 64, height: 64, channels: 3, background: "red" },
      })
        .png()
        .toBuffer(),
      "capture.png",
    );
  original.draft.shots = [scene(image.id)];
  const target = await createProject("Restored", "", "restore-owner"),
    copy = await importMedia(target.id, await readAsset(image), "capture.png");
  const input = {
    revision: 1,
    draft: original.draft,
    mapping: { [image.id]: copy.id },
    sources: [{ id: image.id, hash: image.hash }],
    takes: [],
  };
  await expect(
    restoreArchive(target.id, "restore-owner", {
      ...input,
      sources: [{ id: image.id, hash: "0".repeat(64) }],
    }),
  ).rejects.toThrow("has changed");
  const restored = await restoreArchive(target.id, "restore-owner", input);
  expect(restored.draft.shots[0].assetId).toBe(copy.id);
  await validateRender(target.id, restored.draft);
  const unused = await importMedia(
    target.id,
    await sharp({
      create: { width: 65, height: 64, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer(),
    "unused.png",
  );
  restored.draft.excludedAssetIds = [unused.id];
  await editProject(target.id, restored.revision, restored.draft);
  await pruneHistory(target.id, "restore-owner", 3);
  const clean = await project(target.id);
  expect(clean.draft.excludedAssetIds).toEqual([]);
  await validateRender(target.id, clean.draft);
  expect((await assets(target.id)).length).toBe(1);
});
it("deduplicates an accepted paid request after a worker adds alignment results", async () => {
  const p = await createProject("Voice", "", "voice-owner"),
    payload = { text: "Hello", voiceId: "stock", timed: true };
  const j = await enqueue(p.id, "narrate", payload, "voice-request", 5);
  await updateJob(j, {
    state: "completed",
    payload: { ...payload, speechCues: [{ start: 0, end: 1, text: "Hello" }] },
  });
  expect(
    (
      await enqueue(
        p.id,
        "narrate",
        { timed: true, voiceId: "stock", text: "Hello" },
        "voice-request",
        5,
      )
    ).id,
  ).toBe(j.id);
  await expect(
    enqueue(
      p.id,
      "narrate",
      { ...payload, text: "Changed" },
      "voice-request",
      5,
    ),
  ).rejects.toThrow("Idempotency conflict");
});

it("preserves safe-copy restrictions when restoring a portable archive", async () => {
  const p = await createProject("Private source", "", "safe-restore");
  const original = await importMedia(
    p.id,
    await sharp({
      create: { width: 64, height: 64, channels: 3, background: "white" },
    })
      .png()
      .toBuffer(),
    "original.png",
  );
  const safe = await redactMedia(original, {
    assetId: original.id,
    regions: [{ x: 0, y: 0, width: 0.5, height: 0.5 }],
  });
  const target = await createProject(
    "Restored private source",
    "",
    "safe-restore",
  );
  const a = await importMedia(
      target.id,
      await readAsset(original),
      "original.png",
    ),
    b = await importMedia(target.id, await readAsset(safe), "safe.png");
  const draft = { ...p.draft, shots: [scene(safe.id)] };
  const result = await restoreArchive(target.id, "safe-restore", {
    revision: 1,
    draft,
    mapping: { [original.id]: a.id, [safe.id]: b.id },
    sources: [
      { id: original.id, hash: original.hash, supersededBy: safe.id },
      { id: safe.id, hash: safe.hash },
    ],
    takes: [],
  });
  expect(
    evidenceAssets(result.draft, await assets(target.id)).map((x) => x.id),
  ).toEqual([b.id]);
  await validateRender(target.id, result.draft);
});
