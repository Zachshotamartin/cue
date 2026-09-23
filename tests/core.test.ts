import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import {
  createProject,
  editProject,
  enqueue,
  budget,
  claimJob,
  updateJob,
  addTake,
  takes,
  db,
  assets,
  validateRender,
  now,
} from "../packages/storage/db";
import { origin, sessionSecret, dataDir } from "../packages/storage/config";
import {
  assertOwner,
  assertCapture,
  createPairing,
  exchangePairing,
} from "../packages/storage/auth";
import {
  putCredential,
  credential,
  decryptCredential,
  encryptCredential,
} from "../packages/storage/credentials";
import { importMedia, assetPath, run, hash } from "../packages/storage/media";
import { shotSchema } from "../packages/contracts";
import { handle } from "../packages/server/api";
import { applyPlan } from "../packages/director";
import { normalizeRoute, family } from "../apps/extension/shared.js";
const png = () =>
  sharp({
    create: { width: 96, height: 64, channels: 3, background: "#df603c" },
  })
    .png()
    .toBuffer();
function request(
  route: string,
  method = "GET",
  value?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}/api/${route}`, {
    method,
    headers: {
      origin,
      authorization: `Bearer ${sessionSecret}`,
      ...(value !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
  });
}
async function call(
  route: string,
  method = "GET",
  value?: unknown,
  headers = {},
) {
  return handle(request(route, method, value, headers), route.split("/"));
}
const shot = (assetId: string | null, extra = {}) =>
  shotSchema.parse({
    id: randomUUID(),
    title: "A scene",
    assetId,
    template: "showcase",
    mode: "exact-ui",
    duration: 3,
    caption: "Your product",
    prompt: "",
    motion: "push",
    ...extra,
  });
afterAll(async () => {
  db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("private sessions and credentials", () => {
  it("rejects another website even when a session credential is supplied", () => {
    expect(() =>
      assertOwner(
        request("projects", "POST", {}, { origin: "https://attacker.example" }),
      ),
    ).toThrow("origin");
    expect(() =>
      assertOwner(
        request("projects", "GET", undefined, { host: "attacker.example" }),
      ),
    ).toThrow("configured host");
  });
  it("requires a session for reads and never accepts a forged cookie", async () => {
    const response = await call("projects", "GET", undefined, {
      authorization: "",
      cookie: "cue_session=no",
    });
    expect(response.status).toBe(401);
  });
  it("makes pairing single-use, expiring, and scoped to one project", () => {
    const a = createProject("A"),
      b = createProject("B");
    const { code } = createPairing(a.id),
      pair = exchangePairing(code);
    expect(() => exchangePairing(code)).toThrow("expired");
    const req = request(
      "uploads",
      "POST",
      {},
      {
        origin: `chrome-extension://${"a".repeat(32)}`,
        authorization: `Bearer ${pair.token}`,
      },
    );
    expect(() => assertCapture(req, a.id)).not.toThrow();
    expect(() => assertCapture(req, b.id)).toThrow("Pair");
    db.prepare("UPDATE capture_tokens SET expiresAt=0").run();
    expect(() => assertCapture(req, a.id)).toThrow("Pair");
  });
  it("encrypts keys with owner/provider authentication and no cross-owner fallback", () => {
    const ciphertext = encryptCredential(
      "alice",
      "runway",
      "secret-value-for-testing",
    );
    expect(ciphertext).not.toContain("secret-value");
    expect(decryptCredential("alice", "runway", ciphertext)).toBe(
      "secret-value-for-testing",
    );
    expect(() => decryptCredential("bob", "runway", ciphertext)).toThrow();
    expect(() => decryptCredential("alice", "gemini", ciphertext)).toThrow();
    process.env.RUNWAYML_API_SECRET = "owner-key-only";
    expect(credential("local", "runway")).toBe("owner-key-only");
    expect(() => credential("alice", "runway")).toThrow("Configure");
    delete process.env.RUNWAYML_API_SECRET;
  });
  it("returns only masked credential status", async () => {
    putCredential("local", "gemini", "never-return-this-key-1234");
    const text = await (await call("settings")).text();
    expect(text).toContain("1234");
    expect(text).not.toContain("never-return");
  });
});

describe("saved films and render preflight", () => {
  it("preserves immutable history and rejects stale saves", () => {
    const p = createProject("Film");
    const updated = editProject(p.id, 1, { ...p.draft, title: "Revised" });
    expect(updated.revision).toBe(2);
    expect(() => editProject(p.id, 1, p.draft)).toThrow("Revision conflict");
    expect(
      JSON.parse(
        String(
          (
            db
              .prepare(
                "SELECT draft FROM revisions WHERE projectId=? AND revision=1",
              )
              .get(p.id) as any
          ).draft,
        ),
      ).title,
    ).toBe("Film");
  });
  it("rejects cross-project assets and invalid crop bounds", async () => {
    const a = createProject("A"),
      b = createProject("B");
    const source = await importMedia(a.id, await png(), "screen.png");
    expect(() =>
      editProject(b.id, 1, { ...b.draft, shots: [shot(source.id)] }),
    ).toThrow("belong");
    expect(() =>
      shot(source.id, { focalRect: { x: 0.7, y: 0, width: 0.5, height: 1 } }),
    ).toThrow("Crop");
  });
  it("prevents audio truncation and incomplete generated scenes", async () => {
    const p = createProject("Narration");
    const file = path.join(dataDir, "voice.wav");
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=4",
      "-c:a",
      "pcm_s16le",
      file,
    ]);
    const audio = await importMedia(p.id, await fs.readFile(file), "voice.wav");
    const draft = {
      ...p.draft,
      shots: [shot(null, { template: "endcard", narrationAssetId: audio.id })],
    };
    expect(() => validateRender(p.id, draft)).toThrow("Narration is longer");
    draft.shots[0].duration = 5;
    expect(() => validateRender(p.id, draft)).not.toThrow();
    draft.shots[0].mode = "hybrid";
    expect(() => validateRender(p.id, draft)).toThrow("generated take");
  });
  it("rejects an AI plan with invented asset references", () => {
    const p = createProject("Plan");
    expect(() =>
      applyPlan(p.draft, [], {
        shots: [{ assetId: "invented" }, { assetId: "invented" }],
      }),
    ).toThrow("outside");
  });
});

describe("jobs and spending", () => {
  it("reserves budget atomically and deduplicates a repeated request", () => {
    const p = createProject("Budget");
    editProject(p.id, 1, { ...p.draft, budgetCents: 30 });
    const first = enqueue(
      p.id,
      "generate",
      { model: "gen4_turbo" },
      "same-request",
      25,
    );
    expect(
      enqueue(p.id, "generate", { model: "gen4_turbo" }, "same-request", 25).id,
    ).toBe(first.id);
    expect(budget(p.id).reserved).toBe(25);
    expect(() => enqueue(p.id, "generate", {}, "another-request", 25)).toThrow(
      "spending limit",
    );
    expect(() => enqueue(p.id, "render", {}, "same-request")).toThrow(
      "Idempotency conflict",
    );
    updateJob(first, {
      state: "completed",
      reservedCents: 0,
      chargedCents: 25,
    });
    expect(budget(p.id).spent).toBe(25);
  });
  it("does not retry a submission with an unknown provider outcome", () => {
    const p = createProject("Recovery");
    const j = enqueue(p.id, "generate", {}, "interrupted-call", 25);
    updateJob(j, { state: "submitting", leaseUntil: 0 });
    expect(claimJob()).toBeNull();
    expect(budget(p.id).reserved).toBe(25);
    expect(
      (db.prepare("SELECT state FROM jobs WHERE id=?").get(j.id) as any).state,
    ).toBe("unknown");
  });
  it("requires an explicit provider-history check to release an uncertain reservation", async () => {
    const p = createProject("Reconcile"),
      j = enqueue(p.id, "generate", {}, "unknown-result", 25);
    updateJob(j, { state: "unknown" });
    expect(
      (
        await call(`jobs/${j.id}/reconcile`, "POST", {
          outcome: "not-submitted",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(`jobs/${j.id}/reconcile`, "POST", {
          outcome: "not-submitted",
          checkedProvider: true,
        })
      ).status,
    ).toBe(200);
    expect(budget(p.id).reserved).toBe(0);
  });
  it("deduplicates takes when retrieval resumes", () => {
    const p = createProject("Takes");
    const value = {
      id: randomUUID(),
      projectId: p.id,
      shotId: "one",
      assetId: "asset",
      jobId: "job",
      prompt: "move",
      model: "test",
      sourceHash: "hash",
      createdAt: now(),
    };
    addTake(value);
    addTake({ ...value, id: randomUUID() });
    expect(takes(p.id)).toHaveLength(1);
  });
});

describe("media and resumable uploads", () => {
  it("checks actual bytes, strips unsafe URLs, and deduplicates imports", async () => {
    const p = createProject("Images"),
      bytes = await png();
    const a = await importMedia(p.id, bytes, "screen.png", {
      url: "https://site.test/view?token=secret&tab=overview",
      colors: ["#df603c", "junk"],
    });
    expect(a.metadata.url).toBe("https://site.test/view?tab=overview");
    expect(a.metadata.colors).toEqual(["#df603c"]);
    expect((await importMedia(p.id, bytes, "screen.png", a.metadata)).id).toBe(
      a.id,
    );
    await expect(
      importMedia(p.id, Buffer.from("<script>no</script>"), "fake.png"),
    ).rejects.toThrow("Choose a PNG");
    await expect(
      importMedia(p.id, Buffer.from([0]), "fake.mp4"),
    ).rejects.toThrow("Choose a PNG");
  });
  it("normalizes duration-less recorder WebM and rejects trims past its end", async () => {
    const p = createProject("Recording");
    const { stdout } = await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=orange:s=160x90:r=15:d=2",
        "-c:v",
        "libvpx-vp9",
        "-f",
        "webm",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 1048576 },
    );
    const a = await importMedia(
      p.id,
      stdout as unknown as Buffer,
      "recording.webm",
    );
    expect(a.mime).toBe("video/mp4");
    expect(a.duration).toBeCloseTo(2, 1);
    expect(() =>
      validateRender(p.id, { ...p.draft, shots: [shot(a.id)] }),
    ).toThrow("beyond");
    expect(() =>
      validateRender(p.id, {
        ...p.draft,
        shots: [shot(a.id, { duration: 1, trimStart: 0.5 })],
      }),
    ).not.toThrow();
  });
  it("supports chunk retry, rejects wrong checksums, and finishes idempotently", async () => {
    const p = createProject("Upload"),
      bytes = await png();
    const init = await (
      await call(`projects/${p.id}/uploads`, "POST", {
        name: "chunk.png",
        bytes: bytes.length,
        hash: hash(bytes),
      })
    ).json();
    const route = `uploads/${init.id}/chunks/0`;
    const upload = () =>
      handle(
        new Request(`${origin}/api/${route}`, {
          method: "PUT",
          headers: { origin, authorization: `Bearer ${sessionSecret}` },
          body: bytes,
        }),
        route.split("/"),
      );
    expect((await upload()).status).toBe(200);
    expect((await upload()).status).toBe(200);
    const first = await (
      await call(`uploads/${init.id}/complete`, "POST")
    ).json();
    const second = await (
      await call(`uploads/${init.id}/complete`, "POST")
    ).json();
    expect(first.asset.id).toBe(second.asset.id);
    expect(assets(p.id)).toHaveLength(1);
    const bad = await (
      await call(`projects/${p.id}/uploads`, "POST", {
        name: "bad.png",
        bytes: bytes.length,
        hash: "a".repeat(64),
      })
    ).json();
    await fs.mkdir(path.join(dataDir, "uploads", bad.id), { recursive: true });
    await fs.writeFile(path.join(dataDir, "uploads", bad.id, "0.part"), bytes);
    expect((await call(`uploads/${bad.id}/complete`, "POST")).status).toBe(400);
  });
  it("serves byte ranges for seekable video/audio and rejects invalid ranges", async () => {
    const p = createProject("Ranges"),
      a = await importMedia(p.id, await png(), "range.png");
    const partial = await call(`assets/${a.id}`, "GET", undefined, {
      range: "bytes=0-9",
    });
    expect(partial.status).toBe(206);
    expect((await partial.arrayBuffer()).byteLength).toBe(10);
    expect(
      (
        await call(`assets/${a.id}`, "GET", undefined, {
          range: "bytes=999999-",
        })
      ).status,
    ).toBe(416);
  });
});

describe("route capture scope", () => {
  it("keeps meaningful state and removes tracking", () => {
    expect(
      normalizeRoute(
        "/app?tab=board&utm_source=x#activity",
        "https://site.test",
      ),
    ).toBe("https://site.test/app?tab=board#activity");
    expect(family("https://site.test/projects/123")).toBe("/projects/:id");
  });
  it("excludes outside origins, logout and downloads", () => {
    for (const href of [
      "https://elsewhere.test",
      "/logout",
      "/delete/account",
      "/file.pdf",
      "javascript:alert(1)",
    ])
      expect(normalizeRoute(href, "https://site.test")).toBeNull();
  });
});

describe("creative direction", () => {
  it("retains excluded captures for editing without sending them to the planner", async () => {
    const { evidenceAssets, starterStoryboard } =
      await import("../packages/director");
    const p = createProject("Direction");
    const a = await importMedia(p.id, await png(), "one.png");
    const b = await importMedia(
      p.id,
      await sharp({
        create: { width: 48, height: 48, channels: 3, background: "#000000" },
      })
        .png()
        .toBuffer(),
      "two.png",
    );
    const draft = { ...p.draft, excludedAssetIds: [b.id] };
    expect(evidenceAssets(draft, assets(p.id)).map((a) => a.id)).toEqual([
      a.id,
    ]);
    const minimal = starterStoryboard(
      { ...draft, treatment: "minimal" },
      assets(p.id),
    );
    const energetic = starterStoryboard(
      { ...draft, treatment: "energetic" },
      assets(p.id),
    );
    expect(minimal.shots[0].motion).toBe("still");
    expect(energetic.shots[0].duration).toBeLessThan(minimal.shots[0].duration);
    expect(energetic.shots[0].transition).toBe("cut");
  });
});
