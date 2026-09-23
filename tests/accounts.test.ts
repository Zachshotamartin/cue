import { account } from "./auth-fixture";
import { afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  createProject,
  project,
  editProject,
  enqueue,
  claimSpecificJob,
  budget,
  getJob,
  db,
} from "../packages/storage/db";
import { importMedia } from "../packages/storage/media";
import { handle } from "../packages/server/api";
import {
  origin,
  assetSignature,
  validAssetSignature,
} from "../packages/storage/config";
import { putCredential, credential } from "../packages/storage/credentials";
const alice = {
  id: "alice",
  name: "Alice",
  email: "alice@example.test",
  emailVerified: true,
};
const bob = {
  id: "bob",
  name: "Bob",
  email: "bob@example.test",
  emailVerified: true,
};
async function call(route: string, method = "GET", body?: unknown) {
  const req = new Request(`${origin}/api/${route}`, {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle(req, route.split("/"));
}
afterAll(() => db.close());
describe("account isolation and durable recovery", () => {
  it("creates a server-owned project and restores edits through a new request", async () => {
    account.user = alice;
    const r = await call("projects", "POST", {
      title: "Persistent film",
      siteUrl: "https://example.test",
    });
    expect(r.status).toBe(201);
    const { project: p } = await r.json();
    expect(p.owner).toBe("alice");
    expect(p.id).toBeTruthy();
    await call(`projects/${p.id}/edits`, "POST", {
      revision: 1,
      draft: { ...p.draft, title: "Saved from tab A" },
    });
    expect(
      (await (await call(`projects/${p.id}`)).json()).project.draft.title,
    ).toBe("Saved from tab A");
    expect(
      (
        await call(`projects/${p.id}/edits`, "POST", {
          revision: 1,
          draft: p.draft,
        })
      ).status,
    ).toBe(409);
    const snapshots = await (await call(`projects/${p.id}`)).json();
    expect(snapshots.revisions).toHaveLength(2);
  });
  it("denies another account access to assets, projects, uploads, jobs and key status", async () => {
    account.user = alice;
    const p = await createProject("Private film", "", "alice");
    const bytes = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const a = await importMedia(p.id, bytes, "private.png");
    const j = await enqueue(p.id, "render", { draft: p.draft }, randomUUID());
    const upload = await (
      await call(`projects/${p.id}/uploads`, "POST", {
        name: "a.png",
        bytes: 10,
        hash: "0".repeat(64),
      })
    ).json();
    await putCredential("alice", "gemini", "alice-secret-value-9999");
    account.user = bob;
    expect((await call(`projects/${p.id}`)).status).toBe(404);
    expect((await call(`assets/${a.id}`)).status).toBe(404);
    expect((await call(`jobs/${j.id}/cancel`, "POST")).status).toBe(404);
    expect((await call(`uploads/${upload.id}`)).status).toBe(404);
    expect((await call(`projects/${p.id}/pairing`, "POST")).status).toBe(404);
    expect(await (await call("settings")).text()).not.toContain("9999");
    await expect(credential("bob", "gemini")).rejects.toThrow("Configure");
    expect((await getJob(j.id)).cancelRequested).toBe(false);
  });
  it("requires verification for credentials and paid jobs", async () => {
    account.user = { ...bob, emailVerified: false };
    const p = await createProject("Unverified", "", "bob");
    expect(
      (
        await call("settings", "PUT", {
          provider: "gemini",
          key: "unverified-secret",
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(`projects/${p.id}/plan`, "POST", { revision: 1 })).status,
    ).toBe(403);
    account.user = bob;
  });
  it("serializes simultaneous saves and duplicate job delivery", async () => {
    const p = await createProject("Concurrent", "", "concurrent");
    const writes = await Promise.allSettled([
      editProject(p.id, 1, { ...p.draft, title: "A" }),
      editProject(p.id, 1, { ...p.draft, title: "B" }),
    ]);
    expect(writes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await project(p.id)).revision).toBe(2);
    const key = randomUUID();
    const [a, b] = await Promise.all([
      enqueue(p.id, "plan", {}, key, 25),
      enqueue(p.id, "plan", {}, key, 25),
    ]);
    expect(a.id).toBe(b.id);
    expect((await budget(p.id)).reserved).toBe(25);
    const claims = await Promise.all([
      claimSpecificJob(a.id),
      claimSpecificJob(a.id),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("expires asset capabilities and rejects signatures for other assets", () => {
    const token = assetSignature("one");
    expect(validAssetSignature("one", token)).toBe(true);
    expect(validAssetSignature("two", token)).toBe(false);
    expect(
      validAssetSignature(
        "one",
        assetSignature("one", Math.floor(Date.now() / 1000) - 1),
      ),
    ).toBe(false);
  });
  it("archives and restores without deleting the project", async () => {
    account.user = alice;
    const p = await createProject("Keep forever", "", "alice");
    await call(`projects/${p.id}/archive`, "POST");
    let items = (await (await call("projects")).json()).projects;
    expect(items.find((x: any) => x.id === p.id).archived).toBe(true);
    await call(`projects/${p.id}/unarchive`, "POST");
    expect((await project(p.id, "alice")).draft.title).toBe("Keep forever");
  });
});
