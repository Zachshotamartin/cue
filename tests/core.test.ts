// Install the auth mock before the API module initializes its client.
import { account } from "./auth-fixture";

import ffmpeg from "ffmpeg-static";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { family, normalizeRoute } from "../apps/extension/shared.js";
import { shotSchema } from "../packages/contracts";
import { applyPlan } from "../packages/director";
import { handle } from "../packages/server/api";
import {
  assertCapture,
  assertOwner,
  createPairing,
  exchangePairing,
} from "../packages/storage/auth";
import { dataDir, origin } from "../packages/storage/config";
import {
  credential,
  decryptCredential,
  encryptCredential,
  putCredential,
} from "../packages/storage/credentials";
import {
  addAsset,
  addTake,
  assets,
  budget,
  claimJob,
  createProject,
  db,
  editProject,
  enqueue,
  now,
  takes,
  updateJob,
  updateAssetMetadata,
  validateRender,
} from "../packages/storage/db";
import { hash, importMedia, run } from "../packages/storage/media";
import { writeObject } from "../packages/storage/objects";
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
      authorization: "Bearer forged-local-secret",
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
  await db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("account sessions and credentials", () => {
  it("rejects another website even when a session credential is supplied", async () => {
    await expect(
      assertOwner(
        request("projects", "POST", {}, { origin: "https://attacker.example" }),
      ),
    ).rejects.toThrow("origin");
    await expect(
      assertOwner(
        request("projects", "GET", undefined, { host: "attacker.example" }),
      ),
    ).rejects.toThrow("Request host");
  });
  it("requires a session for reads and never accepts a forged cookie", async () => {
    account.user = null;
    const response = await call("projects", "GET", undefined, {
      authorization: "",
      cookie: "cue_session=no",
    });
    expect(response.status).toBe(401);
    account.user = {
      id: "local",
      name: "Test",
      email: "test@example.test",
      emailVerified: true,
    };
  });
  it("makes pairing single-use, expiring, and scoped to one project", async () => {
    const a = await createProject("A"),
      b = await createProject("B");
    const { code } = await createPairing(a.id, "local"),
      pair = await exchangePairing(code, request("pairing/exchange", "POST"));
    await expect(
      exchangePairing(code, request("pairing/exchange", "POST")),
    ).rejects.toThrow("expired");
    const req = request(
      "uploads",
      "POST",
      {},
      {
        origin: `chrome-extension://${"a".repeat(32)}`,
        authorization: `Bearer ${pair.token}`,
      },
    );
    await expect(assertCapture(req, a.id)).resolves.toBe("local");
    await expect(assertCapture(req, b.id)).rejects.toThrow("Pair");
    await db.prepare("UPDATE capture_tokens SET expiresAt=0").run();
    await expect(assertCapture(req, a.id)).rejects.toThrow("Pair");
  });
  it("encrypts keys with owner/provider authentication and no cross-owner fallback", async () => {
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
    await expect(credential("local", "runway")).rejects.toThrow("Configure");
    await expect(credential("alice", "runway")).rejects.toThrow("Configure");
    delete process.env.RUNWAYML_API_SECRET;
  });
  it("returns only masked credential status", async () => {
    await putCredential("local", "gemini", "never-return-this-key-1234");
    const text = await (await call("settings")).text();
    expect(text).toContain("1234");
    expect(text).not.toContain("never-return");
  });
});

describe("saved films and render preflight", () => {
  it("preserves immutable history and rejects stale saves", async () => {
    const p = await createProject("Film");
    const updated = await editProject(p.id, 1, {
      ...p.draft,
      title: "Revised",
    });
    expect(updated.revision).toBe(2);
    await expect(editProject(p.id, 1, p.draft)).rejects.toThrow(
      "Revision conflict",
    );
    expect(
      JSON.parse(
        String(
          (
            (await db
              .prepare(
                "SELECT draft FROM revisions WHERE projectId=? AND revision=1",
              )
              .get(p.id)) as any
          ).draft,
        ),
      ).title,
    ).toBe("Film");
  });
  it("rejects cross-project assets and invalid crop bounds", async () => {
    const a = await createProject("A"),
      b = await createProject("B");
    const source = await importMedia(a.id, await png(), "screen.png");
    await expect(
      editProject(b.id, 1, { ...b.draft, shots: [shot(source.id)] }),
    ).rejects.toThrow("belong");
    expect(() =>
      shot(source.id, { focalRect: { x: 0.7, y: 0, width: 0.5, height: 1 } }),
    ).toThrow("Crop");
  });
  it("prevents audio truncation and incomplete generated scenes", async () => {
    const p = await createProject("Narration");
    const file = path.join(dataDir, "voice.wav");
    await run(ffmpeg!, [
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
    await expect(validateRender(p.id, draft)).rejects.toThrow(
      "Narration is longer",
    );
    draft.shots[0].duration = 5;
    await expect(validateRender(p.id, draft)).resolves.toBeUndefined();
    draft.shots[0].mode = "hybrid";
    await expect(validateRender(p.id, draft)).rejects.toThrow("generated take");
  });
  it("rejects an AI plan with invented asset references", async () => {
    const p = await createProject("Plan");
    expect(() =>
      applyPlan(p.draft, [], {
        shots: [{ assetId: "invented" }, { assetId: "invented" }],
      }),
    ).toThrow("outside");
  });
});

describe("jobs and spending", () => {
  it("reserves budget atomically and deduplicates a repeated request", async () => {
    const p = await createProject("Budget");
    await editProject(p.id, 1, { ...p.draft, budgetCents: 30 });
    const first = await enqueue(
      p.id,
      "generate",
      { model: "gen4_turbo" },
      "same-request",
      25,
    );
    expect(
      (
        await enqueue(
          p.id,
          "generate",
          { model: "gen4_turbo" },
          "same-request",
          25,
        )
      ).id,
    ).toBe(first.id);
    expect((await budget(p.id)).reserved).toBe(25);
    await expect(
      enqueue(p.id, "generate", {}, "another-request", 25),
    ).rejects.toThrow("spending limit");
    await expect(enqueue(p.id, "render", {}, "same-request")).rejects.toThrow(
      "Idempotency conflict",
    );
    await updateJob(first, {
      state: "completed",
      reservedCents: 0,
      chargedCents: 25,
    });
    expect((await budget(p.id)).spent).toBe(25);
  });
  it("does not retry a submission with an unknown provider outcome", async () => {
    const p = await createProject("Recovery");
    const j = await enqueue(p.id, "generate", {}, "interrupted-call", 25);
    await updateJob(j, { state: "submitting", leaseUntil: 0 });
    expect(await claimJob()).toBeNull();
    expect((await budget(p.id)).reserved).toBe(25);
    expect(
      ((await db.prepare("SELECT state FROM jobs WHERE id=?").get(j.id)) as any)
        .state,
    ).toBe("unknown");
  });
  it("requires an explicit provider-history check to release an uncertain reservation", async () => {
    const p = await createProject("Reconcile"),
      j = await enqueue(p.id, "generate", {}, "unknown-result", 25);
    await updateJob(j, { state: "unknown" });
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
    expect((await budget(p.id)).reserved).toBe(0);
  });
  it("deduplicates takes when retrieval resumes", async () => {
    const p = await createProject("Takes");
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
    await addTake(value);
    await addTake({ ...value, id: randomUUID() });
    expect(await takes(p.id)).toHaveLength(1);
  });
});

describe("media and resumable uploads", () => {
  it("checks actual bytes, strips unsafe URLs, and deduplicates imports", async () => {
    const p = await createProject("Images"),
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
    const p = await createProject("Recording");
    const { stdout } = await run(
      ffmpeg!,
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
    await expect(
      validateRender(p.id, { ...p.draft, shots: [shot(a.id)] }),
    ).rejects.toThrow("beyond");
    await expect(
      validateRender(p.id, {
        ...p.draft,
        shots: [shot(a.id, { duration: 1, trimStart: 0.5 })],
      }),
    ).resolves.toBeUndefined();
  });
  it("supports chunk retry, rejects wrong checksums, and finishes idempotently", async () => {
    const p = await createProject("Upload"),
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
          headers: { origin, authorization: "Bearer forged-local-secret" },
          body: bytes,
        }),
        route.split("/"),
      );
    expect((await upload()).status).toBe(200);
    expect((await upload()).status).toBe(200);
    const resumed = await (
      await call(`projects/${p.id}/uploads`, "POST", {
        name: "chunk.png",
        bytes: bytes.length,
        hash: hash(bytes),
      })
    ).json();
    expect(resumed.id).toBe(init.id);
    expect(resumed.received).toEqual([0]);
    const first = await (
      await call(`uploads/${init.id}/complete`, "POST")
    ).json();
    const second = await (
      await call(`uploads/${init.id}/complete`, "POST")
    ).json();
    expect(first.asset.id).toBe(second.asset.id);
    expect(await assets(p.id)).toHaveLength(1);
    const bad = await (
      await call(`projects/${p.id}/uploads`, "POST", {
        name: "bad.png",
        bytes: bytes.length,
        hash: "a".repeat(64),
      })
    ).json();
    await writeObject(`uploads/${p.id}/${bad.id}/0.part`, bytes);
    expect((await call(`uploads/${bad.id}/complete`, "POST")).status).toBe(400);
  });
  it("serves byte ranges for seekable video/audio and rejects invalid ranges", async () => {
    const p = await createProject("Ranges"),
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
    const p = await createProject("Direction");
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
    expect(evidenceAssets(draft, await assets(p.id)).map((a) => a.id)).toEqual([
      a.id,
    ]);
    const minimal = starterStoryboard(
      { ...draft, treatment: "minimal" },
      await assets(p.id),
    );
    const energetic = starterStoryboard(
      { ...draft, treatment: "energetic" },
      await assets(p.id),
    );
    expect(minimal.shots[0].motion).toBe("still");
    expect(energetic.shots[0].duration).toBeLessThan(minimal.shots[0].duration);
    expect(energetic.shots[0].transition).toBe("cut");
  });
});

it("scopes audio rights edits to the owner and preserves privacy flags", async () => {
  const p = await createProject("Rights fixture"),
    a = await importMedia(p.id, await png(), "rights.png", {});
  await db
    .prepare("UPDATE assets SET data=? WHERE id=?")
    .run(JSON.stringify({ ...a, metadata: { privacyPending: true } }), a.id);
  const route = `assets/${a.id}/rights`,
    rights = {
      credit: "Test creator",
      license: "Test permission",
      sourceUrl: "https://example.test/license",
    };
  const success = await call(route, "PATCH", rights);
  expect(success.status).toBe(200);
  expect((await assets(p.id))[0].metadata).toMatchObject({
    privacyPending: true,
    rights,
  });
  const original = account.user;
  account.user = { ...original!, id: "another-account" };
  try {
    expect((await call(route, "PATCH", rights)).status).toBe(404);
  } finally {
    account.user = original;
  }
  expect(
    (await call(route, "PATCH", rights, { origin: "https://wrong.example" }))
      .status,
  ).toBe(403);
});

it("plans a first demonstration from uploaded footage before any scene exists", async () => {
  const previousUser = account.user;
  const owner = `first-demo-${randomUUID()}`;
  account.user = {
    id: owner,
    name: "Fixture",
    email: "fixture@example.test",
    emailVerified: true,
  };
  try {
    const p = await createProject("First demo", "", owner);
    const saved = await editProject(p.id, p.revision, {
      ...p.draft,
      objective: "demonstration",
    });
    await putCredential(
      owner,
      "openai",
      "fixture-planner-key-no-provider-call",
    );
    const plan = () =>
      call(
        `projects/${p.id}/plan`,
        "POST",
        { revision: saved.revision, provider: "openai" },
        { "idempotency-key": randomUUID() },
      );
    expect((await plan()).status).toBe(400);
    const id = randomUUID();
    await addAsset({
      id,
      projectId: p.id,
      kind: "video",
      name: "Real workflow",
      mime: "video/mp4",
      path: `${id}.mp4`,
      bytes: 10,
      duration: 20,
      width: 1280,
      height: 720,
      hash: "a".repeat(64),
      metadata: {},
      createdAt: now(),
    });
    const response = await plan();
    expect(response.status).toBe(202);
    const { job } = await response.json();
    expect(job.payload.draft.shots).toHaveLength(0);
    expect(job.payload.evidence).toEqual([{ id, hash: "a".repeat(64) }]);
    await updateAssetMetadata(id, { privacyPending: true });
    expect((await plan()).status).toBe(400);
  } finally {
    account.user = previousUser;
  }
});
