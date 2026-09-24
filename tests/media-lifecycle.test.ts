import { it, expect, afterAll } from "vitest";
import fs from "node:fs/promises";
import sharp from "sharp";
import {
  createProject,
  editProject,
  assets,
  db,
  enqueue,
  updateJob,
  project,
} from "../packages/storage/db";
import { importMedia, readAsset } from "../packages/storage/media";
import {
  duplicateProject,
  deleteProject,
  deleteUnusedAsset,
} from "../packages/storage/lifecycle";
import { cleanupTemporaryObjects } from "../packages/cloud/cleanup";
import { dataDir } from "../packages/storage/config";
import { shotSchema } from "../packages/contracts";
const png = () =>
  sharp({
    create: { width: 64, height: 64, channels: 3, background: "#df603c" },
  })
    .png()
    .toBuffer();
afterAll(async () => {
  await db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});
it("duplicates references and protects shared objects when the original is deleted", async () => {
  const p = await createProject("Original", "", "owner-a"),
    a = await importMedia(p.id, await png(), "screen.png", {});
  p.draft.shots = [
    shotSchema.parse({
      id: "scene",
      title: "Screen",
      assetId: a.id,
      evidenceIds: [a.id],
      template: "showcase",
      mode: "exact-ui",
      duration: 3,
      caption: "",
      prompt: "",
      motion: "still",
    }),
  ];
  await editProject(p.id, 1, p.draft);
  const copy = await duplicateProject(p.id, "owner-a");
  expect(copy.id).not.toBe(p.id);
  expect(copy.draft.shots[0].assetId).not.toBe(a.id);
  await expect(deleteProject(copy.id, "owner-b")).rejects.toThrow();
  await deleteProject(p.id, "owner-a");
  await cleanupTemporaryObjects();
  const source = (await assets(copy.id))[0];
  expect((await readAsset(source)).length).toBeGreaterThan(50);
  await deleteProject(copy.id, "owner-a");
  await cleanupTemporaryObjects();
  await expect(readAsset(source)).rejects.toThrow();
});
it("blocks deletion while work or uncertain paid requests still reference the film", async () => {
  const p = await createProject("Working", "", "owner-b"),
    j = await enqueue(p.id, "analyze", {}, "deletion-test");
  await expect(deleteProject(p.id, "owner-b")).rejects.toThrow("active jobs");
  await updateJob(j, { state: "unknown" });
  await expect(deleteProject(p.id, "owner-b")).rejects.toThrow("active jobs");
  await updateJob(j, { state: "failed" });
  await deleteProject(p.id, "owner-b");
  await expect(project(p.id)).rejects.toThrow();
});
it("removes an unused upload but retains media required by an older revision", async () => {
  const p = await createProject("History", "", "owner-c"),
    a = await importMedia(p.id, await png(), "source.png", {});
  p.draft.shots = [
    shotSchema.parse({
      id: "history",
      title: "Screen",
      assetId: a.id,
      template: "showcase",
      mode: "exact-ui",
      duration: 3,
      caption: "",
      prompt: "",
      motion: "still",
    }),
  ];
  await editProject(p.id, 1, p.draft);
  p.draft.shots = [];
  await editProject(p.id, 2, p.draft);
  await expect(deleteUnusedAsset(a.id, "owner-c")).rejects.toThrow(
    "saved history",
  );
  const unused = await importMedia(
    p.id,
    await sharp({
      create: { width: 65, height: 64, channels: 3, background: "#df603c" },
    })
      .png()
      .toBuffer(),
    "unused.png",
    {},
  );
  await deleteUnusedAsset(unused.id, "owner-c");
  expect((await assets(p.id)).map((x) => x.id)).toEqual([a.id]);
});
