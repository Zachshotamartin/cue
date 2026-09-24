import { ZipArchive } from "archiver";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { dispatchJob } from "../cloud/dispatch";
import { speechSrt } from "../compositor/captions";
import {
  createProjectSchema,
  editSchema,
  plannerProviderSchema,
  planners,
  type Asset,
} from "../contracts";
import {
  evidenceAssets,
  inferredPalette,
  starterStoryboard,
} from "../director";
import { inspectFilm } from "../director/quality";
import { mergeStory, replaceScene } from "../director/revisions";
import { plannerModel, videoPrice } from "../providers";
import {
  assertCapture,
  assertHost,
  assertOwner,
  createPairing,
  exchangePairing,
  HttpError,
  isExtension,
  requestOrigin,
} from "../storage/auth";
import { lockAccount, rateLimit } from "../storage/client";
import { origin, validAssetSignature } from "../storage/config";
import { credential } from "../storage/credentials";
import {
  assets,
  createProject,
  db,
  editProject,
  enqueue,
  getAsset,
  getJob,
  jobInputHash,
  project,
  projects,
  projectStorage,
  takes,
  tx,
  updateJob,
  updateAssetMetadata,
  validateRender,
} from "../storage/db";
import { exportManifest } from "../storage/manifest";
import {
  assetPath,
  hash,
  importMedia,
  maxBytes,
  readBounded,
} from "../storage/media";
import {
  cloudObjects,
  readObject,
  streamObject,
  writeObject,
} from "../storage/objects";
import { redactionSchema } from "../storage/redaction";
import { body, cleanName, idempotency, json } from "./http";
import { lifecycleRoutes } from "./lifecycle-routes";
import { settingsRoutes } from "./settings-routes";

async function serveAsset(req: Request, asset: Asset) {
  if (cloudObjects()) {
    const { stream, headers: remote } = await streamObject(
      asset.path,
      req.headers.get("range"),
    );
    const headers = new Headers({
      "Content-Type": asset.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    });
    for (const k of ["content-length", "content-range"])
      if (remote.has(k)) headers.set(k, remote.get(k)!);
    if (new URL(req.url).searchParams.has("download"))
      headers.set(
        "Content-Disposition",
        `attachment; filename="${cleanName(asset.name)}"`,
      );
    return new Response(stream, {
      status: remote.has("content-range") ? 206 : 200,
      headers,
    });
  }
  const file = assetPath(asset),
    stat = await fs.stat(file),
    range = req.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": asset.mime,
    "Content-Length": String(stat.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (new URL(req.url).searchParams.has("download"))
    headers["Content-Disposition"] =
      `attachment; filename="${cleanName(asset.name)}"`;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2])),
      end = m[1]
        ? Math.min(m[2] ? Number(m[2]) : stat.size - 1, stat.size - 1)
        : stat.size - 1;
    if (start > end || start >= stat.size)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    return new Response(
      Readable.toWeb(
        createReadStream(file, { start, end }),
      ) as ReadableStream<Uint8Array>,
      {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        },
      },
    );
  }
  return new Response(
    Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>,
    { headers },
  );
}
export async function handle(req: Request, parts: string[]): Promise<Response> {
  const o = requestOrigin(req),
    requestId = randomUUID();
  try {
    assertHost(req);
    if (req.method === "OPTIONS") {
      if (!isExtension(o) && o !== origin)
        throw new HttpError(403, "Origin not allowed.");
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": o,
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers":
            "Authorization,Content-Type,Idempotency-Key,X-Cue-Metadata,X-Cue-Name",
          Vary: "Origin",
        },
      });
    }
    const response = await dispatch(req, parts);
    response.headers.set("X-Cue-Request-Id", requestId);
    if (isExtension(o)) {
      response.headers.set("Access-Control-Allow-Origin", o);
      response.headers.set("Vary", "Origin");
    }
    return response;
  } catch (e: any) {
    console.warn("cue.request.failed", {
      requestId,
      method: req.method,
      domain: parts[0],
      category:
        e instanceof z.ZodError
          ? "validation"
          : e instanceof HttpError
            ? `http-${e.status}`
            : "internal",
    });
    if (e.code && typeof e.code === "string")
      return json(
        {
          error:
            "Storage is temporarily unavailable. Your saved work is unchanged. Please retry.",
        },
        503,
      );
    const status =
      e instanceof HttpError
        ? e.status
        : e instanceof z.ZodError
          ? 400
          : /not found/i.test(e.message)
            ? 404
            : /conflict/i.test(e.message)
              ? 409
              : 400;
    const message =
      e instanceof z.ZodError
        ? e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .slice(0, 4)
            .join("; ")
        : String(e.message || "The request failed.").slice(0, 600);
    const r = json({ error: message, requestId }, status);
    r.headers.set("X-Cue-Request-Id", requestId);
    if (isExtension(o)) r.headers.set("Access-Control-Allow-Origin", o);
    return r;
  }
}
async function dispatch(req: Request, p: string[]): Promise<Response> {
  const method = req.method;
  if (p[0] === "pairing" && p[1] === "exchange" && method === "POST") {
    if (!isExtension(requestOrigin(req)) && requestOrigin(req) !== origin)
      throw new HttpError(403, "Use the Cue extension to pair.");
    const b = z.object({ code: z.string().length(12) }).parse(await body(req));
    return json(await exchangePairing(b.code, req));
  }
  if (p[0] === "assets" && p[1] && method === "GET") {
    const signature = new URL(req.url).searchParams.get("signature") || "";
    const asset = await getAsset(p[1]);
    if (!signature || !validAssetSignature(p[1], signature))
      await project(asset.projectId, await assertOwner(req));
    if (p[2] === "frame") {
      await project(asset.projectId, await assertOwner(req));
      const frames = (
          asset.metadata.analysis as { frames?: { path: string }[] } | undefined
        )?.frames,
        index = Number(p[3]);
      if (!Number.isInteger(index) || index < 0 || !frames?.[index])
        throw new HttpError(404, "Analyzed frame not found.");
      return new Response(
        new Uint8Array(await readObject(frames[index].path)),
        {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    return serveAsset(req, asset);
  }
  if (p[0] === "uploads" && p[1]) {
    const row: any = await db
      .prepare("SELECT * FROM uploads WHERE id=?")
      .get(p[1]);
    if (!row) throw new HttpError(404, "Upload not found.");
    await assertCapture(req, row.projectId);
    const state = JSON.parse(row.data);
    if (method === "GET")
      return json({
        ...state,
        id: row.id,
        received: (
          await db
            .prepare("SELECT chunk_index FROM upload_chunks WHERE upload_id=?")
            .all(row.id)
        ).map((r) => Number(r.chunk_index)),
      });
    if (state.assetId) return json({ asset: await getAsset(state.assetId) });
    if (Date.now() - Number(row.createdAt) > 86400000)
      throw new HttpError(410, "Upload expired. Start a new upload.");
    if (p[2] === "chunks" && method === "PUT") {
      const index = Number(p[3]);
      if (!Number.isInteger(index) || index < 0 || index >= state.chunks)
        throw new HttpError(400, "Invalid upload chunk.");
      const chunk = await readBounded(req.body, 1024 * 1024);
      const expected = Math.min(1024 * 1024, state.bytes - index * 1024 * 1024);
      if (chunk.length !== expected)
        throw new HttpError(400, "Upload chunk has the wrong length.");
      const objectPath = `uploads/${row.projectId}/${row.id}/${index}.part`;
      await writeObject(objectPath, chunk, "application/octet-stream", true);
      await db
        .prepare(
          "INSERT INTO upload_chunks VALUES(?,?,?,?) ON CONFLICT(upload_id,chunk_index) DO UPDATE SET object_path=excluded.object_path,hash=excluded.hash",
        )
        .run(row.id, index, objectPath, hash(chunk));
      return json({ received: index, hash: hash(chunk) });
    }
    if (p[2] === "complete" && method === "POST") {
      const buffers = await Promise.all(
        Array.from({ length: state.chunks }, (_, i) =>
          readObject(`uploads/${row.projectId}/${row.id}/${i}.part`),
        ),
      );
      const buffer = Buffer.concat(buffers);
      if (buffer.length !== state.bytes || hash(buffer) !== state.hash)
        throw new HttpError(
          400,
          "Upload checksum did not match. Retry the missing chunks.",
        );
      return tx(async () => {
        const fresh = await db
          .prepare("SELECT data FROM uploads WHERE id=? FOR UPDATE")
          .get(row.id);
        const current = JSON.parse(fresh.data);
        if (current.assetId)
          return json({ asset: await getAsset(current.assetId) });
        const asset = await importMedia(
          row.projectId,
          buffer,
          state.name,
          state.metadata,
        );
        await db
          .prepare("UPDATE uploads SET data=? WHERE id=?")
          .run(JSON.stringify({ ...state, assetId: asset.id }), row.id);
        // Chunks remain until the expiry sweep so parallel completion requests stay safe.
        return json({ asset });
      });
    }
    throw new HttpError(404, "Upload operation not found.");
  }
  if (
    p[0] === "projects" &&
    p[1] &&
    ["media", "uploads"].includes(p[2]) &&
    method === "POST"
  ) {
    const captureOwner = await assertCapture(req, p[1]);
    await project(p[1]);
    if (!(await rateLimit(`upload:${captureOwner}`, 60, 60000)))
      throw new HttpError(429, "Please wait before uploading more media.");
    if ((await projectStorage(captureOwner)) > 960 * 1048576)
      throw new HttpError(
        400,
        "Your account has reached its 1 GiB media limit.",
      );
    if (p[2] === "uploads") {
      const b = z
        .object({
          name: z.string().min(1).max(160),
          bytes: z.number().int().positive().max(maxBytes),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          metadata: z.record(z.string(), z.unknown()).default({}),
        })
        .parse(await body(req));
      return tx(async () => {
        await lockAccount(captureOwner);
        const pending = await db
          .prepare(
            "SELECT u.id,u.projectId,u.data FROM uploads u JOIN projects p ON p.id=u.projectId WHERE p.owner=? AND u.createdAt>?",
          )
          .all(captureOwner, Date.now() - 86400000);
        const matching = pending.find((r) => {
          const state = JSON.parse(r.data);
          return (
            r.projectId === p[1] &&
            state.name === b.name &&
            state.hash === b.hash &&
            state.bytes === b.bytes &&
            jobInputHash("metadata", state.metadata) ===
              jobInputHash("metadata", b.metadata)
          );
        });
        if (matching) {
          const state = JSON.parse(matching.data);
          const valid =
            !state.assetId ||
            (await db
              .prepare("SELECT id FROM assets WHERE id=? AND projectId=?")
              .get(state.assetId, p[1]));
          if (valid)
            return json({
              ...state,
              id: matching.id,
              received: (
                await db
                  .prepare(
                    "SELECT chunk_index FROM upload_chunks WHERE upload_id=?",
                  )
                  .all(matching.id)
              ).map((r) => Number(r.chunk_index)),
            });
        }
        const unfinished = pending
          .map((r) => JSON.parse(r.data))
          .filter((x) => !x.assetId);
        if (
          unfinished.length >= 20 ||
          unfinished.reduce((n, x) => n + x.bytes, 0) +
            (await projectStorage(captureOwner)) +
            b.bytes >
            1024 * 1048576
        )
          throw new HttpError(
            400,
            "Finish existing uploads or wait for incomplete uploads to expire before adding more media.",
          );
        const state = { ...b, chunks: Math.ceil(b.bytes / 1048576) },
          id = randomUUID();
        await db
          .prepare("INSERT INTO uploads VALUES(?,?,?,?)")
          .run(id, p[1], JSON.stringify(state), Date.now());
        return json({ id, ...state });
      });
    }
    const bytes = await readBounded(req.body),
      name = decodeURIComponent(req.headers.get("x-cue-name") || "capture.png");
    let metadata = {};
    try {
      metadata = JSON.parse(
        decodeURIComponent(req.headers.get("x-cue-metadata") || "{}"),
      );
    } catch {
      throw new HttpError(400, "Invalid capture metadata.");
    }
    return json({ asset: await importMedia(p[1], bytes, name, metadata) }, 201);
  }
  const owner = await assertOwner(req);
  if (
    !["GET", "HEAD"].includes(method) &&
    !(await rateLimit(`writes:${owner}`, 120, 60000))
  )
    throw new HttpError(429, "Too many requests. Try again shortly.");
  const settingsResponse = await settingsRoutes(req, p, owner);
  if (settingsResponse) return settingsResponse;
  if (p[0] === "projects" && !p[1]) {
    if (method === "GET")
      return json({
        projects: await Promise.all(
          (await projects(owner)).map(async (x) => ({
            ...x,
            archived: !!(await db
              .prepare(
                "SELECT projectId FROM project_archive WHERE projectId=?",
              )
              .get(x.id)),
            assetCount: (await assets(x.id)).length,
            thumbnail:
              (await assets(x.id)).find((a) => a.kind === "image")?.id || null,
          })),
        ),
      });
    if (method === "POST") {
      if ((await projects(owner)).length >= 100)
        throw new HttpError(400, "Each account can have up to 100 projects.");
      const b = createProjectSchema.parse(await body(req));
      if (b.siteUrl && !/^https?:\/\//.test(b.siteUrl))
        throw new HttpError(
          400,
          "Use a complete http:// or https:// website address.",
        );
      return json(
        { project: await createProject(b.title, b.siteUrl, owner) },
        201,
      );
    }
  }
  if (p[0] === "jobs" && p[1] && p[2] === "reconcile" && method === "POST") {
    const j = await getJob(p[1]);
    await project(j.projectId, owner);
    if (j.state !== "unknown")
      throw new HttpError(
        400,
        "Only uncertain submissions need reconciliation.",
      );
    const b = z
      .object({
        outcome: z.enum(["charged", "not-submitted"]),
        checkedProvider: z.literal(true),
      })
      .parse(await body(req));
    return json({
      job: await updateJob(j, {
        state: "failed",
        chargedCents:
          b.outcome === "charged" ? j.reservedCents : j.chargedCents,
        reservedCents: 0,
        error:
          b.outcome === "charged"
            ? "Marked charged after checking provider history. Create a new take when ready."
            : "Confirmed not submitted. You can safely create a new request.",
      }),
    });
  }
  if (p[0] === "jobs" && p[1] && p[2] === "cancel" && method === "POST") {
    const j = await getJob(p[1]);
    await project(j.projectId, owner);
    if (j.state === "unknown")
      throw new HttpError(
        400,
        "Check provider history and resolve this uncertain submission first.",
      );
    if (["completed", "failed", "cancelled"].includes(j.state))
      return json({ job: j });
    return json({
      job: await updateJob(j, {
        cancelRequested: true,
        ...(j.state === "queued"
          ? { state: "cancelled" as const, reservedCents: 0 }
          : {}),
      }),
    });
  }
  if (p[0] !== "projects" || !p[1])
    throw new HttpError(404, "Endpoint not found.");
  const id = p[1],
    current = await project(id, owner);
  const lifecycleResponse = await lifecycleRoutes(req, p, owner, current);
  if (lifecycleResponse) return lifecycleResponse;
  if (p[2] === "pairing" && method === "POST")
    return json(await createPairing(id, owner));
  if (p[2] === "revoke-pairing" && method === "POST") {
    await db.prepare("DELETE FROM capture_tokens WHERE projectId=?").run(id);
    await db.prepare("DELETE FROM pairing WHERE projectId=?").run(id);
    return json({ revoked: true });
  }
  if (p[2] === "edits" && method === "POST") {
    const b = editSchema.parse(await body(req));
    return json({
      project: await editProject(id, b.revision, b.draft, b.label),
    });
  }
  if (p[2] === "restore" && method === "POST") {
    const b = z
      .object({ revision: z.number().int(), target: z.number().int() })
      .parse(await body(req));
    const row: any = await db
      .prepare("SELECT draft FROM revisions WHERE projectId=? AND revision=?")
      .get(id, b.target);
    if (!row) throw new HttpError(404, "Revision not found.");
    return json({
      project: await editProject(
        id,
        b.revision,
        JSON.parse(row.draft),
        `Restore revision ${b.target}`,
      ),
    });
  }
  if (p[2] === "palette" && method === "GET")
    return json({ palette: inferredPalette(await assets(id)) });
  if (p[2] === "storyboard" && method === "POST") {
    const b = z.object({ revision: z.number().int() }).parse(await body(req));
    return json({
      project: await editProject(
        id,
        b.revision,
        starterStoryboard(current.draft, await assets(id)),
        "Create starter storyboard",
      ),
    });
  }
  if (
    [
      "plan",
      "generate",
      "narrate",
      "render",
      "analyze",
      "music",
      "sound",
    ].includes(p[2]) &&
    method === "POST"
  )
    await assertOwner(req, true);
  if (p[2] === "redact" && method === "POST") {
    const b = redactionSchema.parse(await body(req));
    const source = await getAsset(b.assetId);
    if (source.projectId !== id || source.kind === "audio")
      throw new HttpError(400, "Choose a visual source in this film.");
    const job = await tx(async () => {
      await lockAccount(owner);
      const queued = await enqueue(id, "redact", b, idempotency(req));
      await updateAssetMetadata(source.id, { privacyPending: true });
      return queued;
    });
    await dispatchJob(job.id);
    return json({ job }, 202);
  }
  if (p[2] === "analyze" && method === "POST") {
    return json(
      {
        job: await queue(
          id,
          "analyze",
          {
            evidence: evidenceAssets(current.draft, await assets(id)).map(
              (a) => ({ id: a.id, hash: a.hash }),
            ),
          },
          idempotency(req),
        ),
      },
      202,
    );
  }
  if (p[2] === "quality" && method === "GET")
    return json({
      issues: inspectFilm(current.draft, await assets(id), await takes(id)),
    });
  if (p[2] === "plan" && method === "POST") {
    const b = z
      .object({
        revision: z.number().int(),
        provider: plannerProviderSchema.optional(),
        scopeShotId: z.string().max(100).optional(),
        instruction: z.string().max(600).optional(),
      })
      .parse(await body(req));
    if (
      b.scopeShotId &&
      !current.draft.shots.some((s) => s.id === b.scopeShotId && !s.locked)
    )
      throw new HttpError(400, "Choose an unlocked scene to revise.");
    const provider = b.provider || current.draft.plannerProvider;
    const captured = evidenceAssets(current.draft, await assets(id));
    // Planning creates the first timeline: require available evidence, not
    // an already assembled scene that the director has yet to produce.
    if (
      current.draft.objective === "demonstration" &&
      !captured.some((a) => a.kind === "video")
    )
      throw new HttpError(
        400,
        "Add a real product workflow recording with its result, or choose a teaser in Brief.",
      );
    await credential(owner, provider);
    if (b.revision !== current.revision)
      throw new HttpError(409, "Revision conflict.");
    if (!evidenceAssets(current.draft, await assets(id)).length)
      throw new HttpError(400, "Capture a screen first.");
    return json(
      {
        job: await queue(
          id,
          "plan",
          {
            draft: { ...current.draft, plannerProvider: provider },
            revision: b.revision,
            provider,
            model: plannerModel(provider),
            evidence: captured.map((a) => ({ id: a.id, hash: a.hash })),
            schemaVersion: 2,
            scopeShotId: b.scopeShotId,
            instruction: b.instruction,
          },
          idempotency(req),
          planners[provider].reserveCents,
        ),
      },
      202,
    );
  }
  if (p[2] === "apply-plan" && method === "POST") {
    const b = z
      .object({
        revision: z.number().int(),
        jobId: z.string(),
        sceneId: z.string().optional(),
      })
      .parse(await body(req));
    const j = await getJob(b.jobId);
    if (
      j.projectId !== id ||
      j.kind !== "plan" ||
      j.state !== "completed" ||
      !j.payload.result
    )
      throw new HttpError(400, "No completed proposal found.");
    return json({
      project: await editProject(
        id,
        b.revision,
        j.payload.scopeShotId
          ? replaceScene(
              current.draft,
              j.payload.draft,
              j.payload.result,
              j.payload.scopeShotId,
              b.sceneId || "",
            )
          : mergeStory(current.draft, j.payload.result),
        "Apply AI storyboard",
      ),
    });
  }
  if (p[2] === "generate" && method === "POST") {
    await credential(owner, "runway");
    const b = z
      .object({
        revision: z.number().int(),
        shotId: z.string(),
        model: z.enum(["gen4_turbo", "gen4.5"]),
        seconds: z.union([z.literal(5), z.literal(10)]),
        maxCostCents: z.number().int().nonnegative(),
      })
      .parse(await body(req));
    if (b.revision !== current.revision)
      throw new HttpError(409, "Save the latest project before generating.");
    const shot = current.draft.shots.find((s) => s.id === b.shotId);
    if (!shot?.assetId || !shot.prompt)
      throw new HttpError(400, "Select an image and write a motion prompt.");
    const a = await getAsset(shot.assetId);
    if (a.kind !== "image")
      throw new HttpError(400, "Generation needs a still image reference.");
    const cost = videoPrice(b.model, b.seconds);
    if (cost > b.maxCostCents)
      throw new HttpError(400, "The generation exceeds the approved cost.");
    return json(
      {
        job: await queue(
          id,
          "generate",
          {
            sourceAssetId: a.id,
            sourceHash: a.hash,
            shotId: shot.id,
            shotTitle: shot.title,
            prompt: shot.prompt,
            format: current.draft.format,
            model: b.model,
            seconds: b.seconds,
            revision: current.revision,
          },
          idempotency(req),
          cost,
        ),
      },
      202,
    );
  }
  if (["music", "sound"].includes(p[2]) && method === "POST") {
    await credential(owner, "elevenlabs");
    const b = z
      .object({
        revision: z.number().int(),
        prompt: z.string().trim().min(3).max(1000),
        seconds: z
          .number()
          .min(p[2] === "music" ? 3 : 0.5)
          .max(p[2] === "music" ? 90 : 30),
        maxCostCents: z.number().int(),
      })
      .parse(await body(req));
    if (b.revision !== current.revision)
      throw new HttpError(409, "Save before generating audio.");
    const reserve = p[2] === "music" ? 200 : 50;
    if (b.maxCostCents < reserve)
      throw new HttpError(400, "Approve the audio budget reservation first.");
    return json(
      {
        job: await queue(
          id,
          p[2] as "music" | "sound",
          {
            prompt: b.prompt,
            seconds: b.seconds,
            revision: current.revision,
            model: p[2] === "music" ? "music_v1" : "eleven_text_to_sound_v2",
          },
          idempotency(req),
          reserve,
        ),
      },
      202,
    );
  }
  if (p[2] === "narrate" && method === "POST") {
    await credential(owner, "elevenlabs");
    const b = z
      .object({
        revision: z.number().int(),
        shotId: z.string(),
        voiceId: z.string().min(8).max(80),
      })
      .parse(await body(req));
    if (b.revision !== current.revision)
      throw new HttpError(409, "Save before generating narration.");
    const s = current.draft.shots.find((s) => s.id === b.shotId);
    if (!s?.narration) throw new HttpError(400, "Write the narration first.");
    return json(
      {
        job: await queue(
          id,
          "narrate",
          {
            shotId: s.id,
            shotTitle: s.title,
            text: s.narration,
            voiceId: b.voiceId,
            timed: true,
            pronunciationDictionaries: current.draft.pronunciationDictionaries,
            model: "eleven_multilingual_v2",
          },
          idempotency(req),
          Math.max(5, Math.ceil(s.narration.length * 0.04)),
        ),
      },
      202,
    );
  }
  if (p[2] === "render" && method === "POST") {
    const b = z.object({ revision: z.number().int() }).parse(await body(req));
    if (b.revision !== current.revision)
      throw new HttpError(409, "Save before exporting.");
    await validateRender(id, current.draft);
    return json(
      {
        job: await queue(
          id,
          "render",
          {
            draft: current.draft,
            revision: current.revision,
            manifest: await exportManifest(id, current.draft, current.revision),
          },
          idempotency(req),
        ),
      },
      202,
    );
  }
  if (p[2] === "captions" && method === "GET")
    return new Response(speechSrt(current.draft), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${cleanName(current.draft.title)}.srt"`,
      },
    });
  if (p[2] === "archive" && method === "GET") {
    const archive = new ZipArchive({ zlib: { level: 1 } });
    const archivedAssets = await assets(id);
    archive.append(
      JSON.stringify(
        {
          version: 1,
          project: current,
          assets: archivedAssets,
          takes: await takes(id),
        },
        null,
        2,
      ),
      { name: "project.json" },
    );
    for (const a of [
      ...new Map(archivedAssets.map((a) => [a.path, a])).values(),
    ]) {
      // Open one source lazily when archiver consumes it; never buffer the whole project.
      const source = Readable.from(
        (async function* () {
          if (cloudObjects()) {
            const { stream } = await streamObject(a.path);
            yield* Readable.fromWeb(stream as any);
          } else yield* createReadStream(assetPath(a));
        })(),
      );
      source.on("error", (error) => archive.destroy(error));
      archive.append(source, {
        name: `assets/${path.basename(a.path)}`,
      });
    }
    void archive.finalize().catch((error) => archive.destroy(error));
    return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${cleanName(current.draft.title)}.zip"`,
      },
    });
  }
  if (p[2] === "events" && method === "GET")
    return json({
      events: await db
        .prepare(
          "SELECT * FROM events WHERE projectId=? AND id>? ORDER BY id LIMIT 50",
        )
        .all(id, Number(new URL(req.url).searchParams.get("after") || 0)),
    });
  if (p[2] === "archive" && method === "POST") {
    await db
      .prepare(
        "INSERT INTO project_archive VALUES(?,?) ON CONFLICT(projectId) DO NOTHING",
      )
      .run(id, new Date().toISOString());
    return json({ archived: true });
  }
  if (p[2] === "unarchive" && method === "POST") {
    await db.prepare("DELETE FROM project_archive WHERE projectId=?").run(id);
    return json({ archived: false });
  }
  throw new HttpError(404, "Endpoint not found.");
}
async function queue(...args: Parameters<typeof enqueue>) {
  const job = await enqueue(...args);
  await dispatchJob(job.id);
  return job;
}
