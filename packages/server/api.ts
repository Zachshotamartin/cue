import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { ZipArchive } from "archiver";
import { z } from "zod";
import {
  assets,
  budget,
  createProject,
  db,
  editProject,
  enqueue,
  event,
  getAsset,
  getJob,
  jobs,
  project,
  projects,
  snapshot,
  takes,
  tx,
  updateJob,
  validateReferences,
  validateRender,
} from "../storage/db";
import {
  createProjectSchema,
  draftSchema,
  editSchema,
  providerSchema,
  type Asset,
} from "../contracts";
import {
  assetSignature,
  dataDir,
  origin,
  root,
  safeEqual,
} from "../storage/config";
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
import {
  assetPath,
  hash,
  importMedia,
  maxBytes,
  readBounded,
} from "../storage/media";
import {
  credential,
  credentialStatus,
  putCredential,
  removeCredential,
} from "../storage/credentials";
import { starterStoryboard, inferredPalette } from "../director";
import { videoPrice } from "../providers";

const json = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request) {
  const bytes = await readBounded(req.body, 2 * 1024 * 1024);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new HttpError(400, "Request must contain valid JSON.");
  }
}
function idempotency(req: Request) {
  const k = req.headers.get("idempotency-key");
  if (!k || k.length < 8 || k.length > 120)
    throw new HttpError(400, "An idempotency key is required for this job.");
  return k;
}
function cleanName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 100) || "download";
}
function srt(draft: ReturnType<typeof draftSchema.parse>) {
  let at = 0;
  const time = (s: number) =>
    new Date(Math.round(s * 1000))
      .toISOString()
      .slice(11, 23)
      .replace(".", ",");
  return draft.shots
    .map((s, i) => {
      const start = at;
      at += s.duration;
      return `${i + 1}\n${time(start)} --> ${time(at)}\n${s.caption.replace(/[\r\n]+/g, " ")}\n`;
    })
    .join("\n");
}
async function serveAsset(req: Request, asset: Asset) {
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
  const o = requestOrigin(req);
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
    if (isExtension(o)) {
      response.headers.set("Access-Control-Allow-Origin", o);
      response.headers.set("Vary", "Origin");
    }
    return response;
  } catch (e: any) {
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
    const r = json({ error: message }, status);
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
    return json(exchangePairing(b.code));
  }
  if (p[0] === "assets" && p[1] && method === "GET") {
    const signature = new URL(req.url).searchParams.get("signature") || "";
    if (!safeEqual(signature, assetSignature(p[1]))) assertOwner(req);
    return serveAsset(req, getAsset(p[1]));
  }
  if (p[0] === "uploads" && p[1]) {
    const row: any = db.prepare("SELECT * FROM uploads WHERE id=?").get(p[1]);
    if (!row) throw new HttpError(404, "Upload not found.");
    assertCapture(req, row.projectId);
    const state = JSON.parse(row.data);
    if (method === "GET") return json({ ...state, id: row.id });
    if (state.assetId) return json({ asset: getAsset(state.assetId) });
    const dir = path.join(dataDir, "uploads", row.id);
    await fs.mkdir(dir, { recursive: true });
    if (p[2] === "chunks" && method === "PUT") {
      const index = Number(p[3]);
      if (!Number.isInteger(index) || index < 0 || index >= state.chunks)
        throw new HttpError(400, "Invalid upload chunk.");
      const chunk = await readBounded(req.body, 1024 * 1024);
      const expected = Math.min(1024 * 1024, state.bytes - index * 1024 * 1024);
      if (chunk.length !== expected)
        throw new HttpError(400, "Upload chunk has the wrong length.");
      await fs.writeFile(path.join(dir, `${index}.part`), chunk);
      return json({ received: index, hash: hash(chunk) });
    }
    if (p[2] === "complete" && method === "POST") {
      const buffers = await Promise.all(
        Array.from({ length: state.chunks }, (_, i) =>
          fs.readFile(path.join(dir, `${i}.part`)),
        ),
      );
      const buffer = Buffer.concat(buffers);
      if (buffer.length !== state.bytes || hash(buffer) !== state.hash)
        throw new HttpError(
          400,
          "Upload checksum did not match. Retry the missing chunks.",
        );
      const asset = await importMedia(
        row.projectId,
        buffer,
        state.name,
        state.metadata,
      );
      db.prepare("UPDATE uploads SET data=? WHERE id=?").run(
        JSON.stringify({ ...state, assetId: asset.id }),
        row.id,
      );
      await fs.rm(dir, { recursive: true, force: true });
      return json({ asset });
    }
    throw new HttpError(404, "Upload operation not found.");
  }
  if (
    p[0] === "projects" &&
    p[1] &&
    ["media", "uploads"].includes(p[2]) &&
    method === "POST"
  ) {
    assertCapture(req, p[1]);
    project(p[1]);
    if (p[2] === "uploads") {
      const b = z
        .object({
          name: z.string().min(1).max(160),
          bytes: z.number().int().positive().max(maxBytes),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          metadata: z.record(z.string(), z.unknown()).default({}),
        })
        .parse(await body(req));
      const state = { ...b, chunks: Math.ceil(b.bytes / (1024 * 1024)) },
        id = randomUUID();
      db.prepare("INSERT INTO uploads VALUES(?,?,?,?)").run(
        id,
        p[1],
        JSON.stringify(state),
        Date.now(),
      );
      return json({ id, ...state });
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
  assertOwner(req);
  if (p[0] === "health")
    return json({ ok: true, mode: "private-local", origin });
  if (p[0] === "settings") {
    if (method === "GET")
      return json({
        providers: credentialStatus(),
        mode: "private-local",
        voiceId: process.env.ELEVENLABS_VOICE_ID || "",
        origin,
      });
    const b = z
      .object({
        provider: providerSchema,
        key: z.string().min(12).max(1024).optional(),
      })
      .parse(await body(req));
    if (method === "DELETE") removeCredential("local", b.provider);
    else if (method === "PUT" && b.key)
      putCredential("local", b.provider, b.key);
    else throw new HttpError(400, "Enter a provider key.");
    return json({ providers: credentialStatus() });
  }
  if (p[0] === "projects" && !p[1]) {
    if (method === "GET")
      return json({
        projects: projects().map((x) => ({
          ...x,
          assetCount: assets(x.id).length,
          thumbnail: assets(x.id).find((a) => a.kind === "image")?.id || null,
        })),
      });
    if (method === "POST") {
      const b = createProjectSchema.parse(await body(req));
      if (b.siteUrl && !/^https?:\/\//.test(b.siteUrl))
        throw new HttpError(
          400,
          "Use a complete http:// or https:// website address.",
        );
      return json({ project: createProject(b.title, b.siteUrl) }, 201);
    }
  }
  if (p[0] === "jobs" && p[1] && p[2] === "reconcile" && method === "POST") {
    const j = getJob(p[1]);
    project(j.projectId);
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
      job: updateJob(j, {
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
    const j = getJob(p[1]);
    project(j.projectId);
    if (j.state === "unknown")
      throw new HttpError(
        400,
        "Check provider history and resolve this uncertain submission first.",
      );
    if (["completed", "failed", "cancelled"].includes(j.state))
      return json({ job: j });
    return json({
      job: updateJob(j, {
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
    current = project(id);
  if (!p[2] && method === "GET") return json(snapshot(id));
  if (p[2] === "pairing" && method === "POST") return json(createPairing(id));
  if (p[2] === "revoke-pairing" && method === "POST") {
    db.prepare("DELETE FROM capture_tokens WHERE projectId=?").run(id);
    db.prepare("DELETE FROM pairing WHERE projectId=?").run(id);
    return json({ revoked: true });
  }
  if (p[2] === "edits" && method === "POST") {
    const b = editSchema.parse(await body(req));
    return json({ project: editProject(id, b.revision, b.draft, b.label) });
  }
  if (p[2] === "restore" && method === "POST") {
    const b = z
      .object({ revision: z.number().int(), target: z.number().int() })
      .parse(await body(req));
    const row: any = db
      .prepare("SELECT draft FROM revisions WHERE projectId=? AND revision=?")
      .get(id, b.target);
    if (!row) throw new HttpError(404, "Revision not found.");
    return json({
      project: editProject(
        id,
        b.revision,
        JSON.parse(row.draft),
        `Restore revision ${b.target}`,
      ),
    });
  }
  if (p[2] === "palette" && method === "GET")
    return json({ palette: inferredPalette(assets(id)) });
  if (p[2] === "storyboard" && method === "POST") {
    const b = z.object({ revision: z.number().int() }).parse(await body(req));
    return json({
      project: editProject(
        id,
        b.revision,
        starterStoryboard(current.draft, assets(id)),
        "Create starter storyboard",
      ),
    });
  }
  if (p[2] === "plan" && method === "POST") {
    credential("local", "gemini");
    const b = z.object({ revision: z.number().int() }).parse(await body(req));
    if (b.revision !== current.revision)
      throw new HttpError(409, "Revision conflict.");
    if (!assets(id).length) throw new HttpError(400, "Capture a screen first.");
    return json(
      {
        job: enqueue(
          id,
          "plan",
          { draft: current.draft, revision: b.revision },
          idempotency(req),
          25,
        ),
      },
      202,
    );
  }
  if (p[2] === "apply-plan" && method === "POST") {
    const b = z
      .object({ revision: z.number().int(), jobId: z.string() })
      .parse(await body(req));
    const j = getJob(b.jobId);
    if (
      j.projectId !== id ||
      j.kind !== "plan" ||
      j.state !== "completed" ||
      !j.payload.result
    )
      throw new HttpError(400, "No completed proposal found.");
    return json({
      project: editProject(
        id,
        b.revision,
        j.payload.result,
        "Apply AI storyboard",
      ),
    });
  }
  if (p[2] === "generate" && method === "POST") {
    credential("local", "runway");
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
    const a = getAsset(shot.assetId);
    if (a.kind !== "image")
      throw new HttpError(400, "Generation needs a still image reference.");
    const cost = videoPrice(b.model, b.seconds);
    if (cost > b.maxCostCents)
      throw new HttpError(400, "The generation exceeds the approved cost.");
    return json(
      {
        job: enqueue(
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
  if (p[2] === "narrate" && method === "POST") {
    credential("local", "elevenlabs");
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
        job: enqueue(
          id,
          "narrate",
          {
            shotId: s.id,
            shotTitle: s.title,
            text: s.narration,
            voiceId: b.voiceId,
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
    validateRender(id, current.draft);
    return json(
      {
        job: enqueue(
          id,
          "render",
          { draft: current.draft, revision: current.revision },
          idempotency(req),
        ),
      },
      202,
    );
  }
  if (p[2] === "captions" && method === "GET")
    return new Response(srt(current.draft), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${cleanName(current.draft.title)}.srt"`,
      },
    });
  if (p[2] === "archive" && method === "GET") {
    const archive = new ZipArchive({ zlib: { level: 1 } });
    archive.append(
      JSON.stringify(
        { version: 1, project: current, assets: assets(id), takes: takes(id) },
        null,
        2,
      ),
      { name: "project.json" },
    );
    for (const a of assets(id))
      archive.file(assetPath(a), { name: `assets/${a.path}` });
    archive.finalize();
    return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${cleanName(current.draft.title)}.zip"`,
      },
    });
  }
  if (p[2] === "events" && method === "GET") {
    let cursor = Number(
        req.headers.get("last-event-id") ||
          new URL(req.url).searchParams.get("after") ||
          0,
      ),
      timer: ReturnType<typeof setInterval>;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = () => {
          const rows = db
            .prepare(
              "SELECT * FROM events WHERE projectId=? AND id>? ORDER BY id LIMIT 50",
            )
            .all(id, cursor) as any[];
          try {
            if (!rows.length)
              controller.enqueue(encoder.encode(": keepalive\n\n"));
            for (const r of rows) {
              controller.enqueue(
                encoder.encode(
                  `id: ${r.id}\ndata: ${JSON.stringify({ type: r.type, ...JSON.parse(r.data) })}\n\n`,
                ),
              );
              cursor = Number(r.id);
            }
          } catch {
            clearInterval(timer);
          }
        };
        send();
        timer = setInterval(send, 1500);
        req.signal.addEventListener(
          "abort",
          () => {
            clearInterval(timer);
            try {
              controller.close();
            } catch {}
          },
          { once: true },
        );
      },
      cancel() {
        clearInterval(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
  throw new HttpError(404, "Endpoint not found.");
}
