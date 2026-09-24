import { z } from "zod";
import { dimensions } from "../contracts";
import { assetSignature, origin } from "../storage/config";
import { assets, getJob, takes, tx, updateJob } from "../storage/db";
import { attachExportManifest, validateExportInput } from "../storage/manifest";
import { importMedia, readBounded } from "../storage/media";
import { readObject, writeObject } from "../storage/objects";
import { validWorkerToken } from "./worker-token";
export async function renderCallback(req: Request, id: string, op: string[]) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!validWorkerToken(id, token))
    return Response.json(
      { error: "Invalid render capability." },
      { status: 403 },
    );
  const job = await getJob(id);
  if (job.kind !== "render" || job.cancelRequested)
    return Response.json({ error: "Render is not active." }, { status: 409 });
  const json = (x: unknown) =>
    Response.json(x, { headers: { "Cache-Control": "no-store" } });
  if (op[0] === "manifest" && req.method === "GET") {
    await validateExportInput(job);
    const media = (await assets(job.projectId)).filter(
      (a) =>
        !job.payload.manifest ||
        job.payload.manifest.sources.some(
          (ref: { id: string }) => ref.id === a.id,
        ),
    );
    return json({
      inputProps: {
        draft: job.payload.draft,
        assets: media,
        takes: await takes(job.projectId),
        urls: Object.fromEntries(
          media.map((a) => [
            a.id,
            `${origin}/api/assets/${a.id}?signature=${assetSignature(a.id)}`,
          ]),
        ),
      },
    });
  }
  if (req.method === "POST" && op[0] === "progress") {
    const b = z
      .object({ progress: z.number().min(0).max(99) })
      .parse(await req.json());
    if (job.state === "running")
      await updateJob(job, {
        progress: Math.max(job.progress, b.progress),
        leaseUntil: Date.now() + 60000,
      });
    return json({ ok: true });
  }
  const kind = op[1];
  if (
    op[0] === "chunks" &&
    req.method === "PUT" &&
    ["video", "poster"].includes(kind)
  ) {
    const n = Number(op[2]);
    if (!Number.isInteger(n) || n < 0 || n > 63)
      return Response.json({ error: "Invalid chunk." }, { status: 400 });
    await writeObject(
      `renders/${id}/${kind}/${n}.part`,
      await readBounded(req.body, 1048576),
      "application/octet-stream",
      true,
    );
    return json({ ok: true });
  }
  if (
    op[0] === "complete" &&
    req.method === "POST" &&
    ["video", "poster"].includes(kind)
  ) {
    const b = z
      .object({
        bytes: z
          .number()
          .int()
          .positive()
          .max(64 * 1048576),
      })
      .parse(await req.json());
    const data = Buffer.concat(
      await Promise.all(
        Array.from({ length: Math.ceil(b.bytes / 1048576) }, (_, i) =>
          readObject(`renders/${id}/${kind}/${i}.part`),
        ),
      ),
    );
    if (data.length !== b.bytes) throw new Error("Incomplete output upload.");
    return tx(async () => {
      const fresh = await getJob(id);
      if (kind === "video" && fresh.outputAssetId)
        return json({ assetId: fresh.outputAssetId });
      const asset = await importMedia(
        job.projectId,
        data,
        `${job.payload.draft.title}-${kind === "video" ? job.payload.draft.format + ".mp4" : "poster.png"}`,
        { state: kind === "video" ? "export" : "export-poster", jobId: id },
      );
      if (kind === "video") {
        const size = dimensions(job.payload.draft.format),
          duration = job.payload.draft.shots.reduce(
            (n: number, s: any) => n + s.duration,
            0,
          );
        if (
          asset.kind !== "video" ||
          asset.width !== size.width ||
          asset.height !== size.height ||
          Math.abs((asset.duration || 0) - duration) > 0.2
        )
          throw new Error("Export validation failed.");
        await attachExportManifest(asset.id, job);
        await updateJob(fresh, {
          state: "retrieving",
          outputAssetId: asset.id,
          progress: 98,
          leaseUntil: Date.now() + 60000,
        });
      }
      return json({ assetId: asset.id });
    });
  }
  if (op[0] === "finished" && req.method === "POST") {
    if (!job.outputAssetId) throw new Error("No saved export.");
    await updateJob(job, {
      state: "completed",
      progress: 100,
      error: null,
      leaseUntil: 0,
    });
    return json({ ok: true });
  }
  if (op[0] === "failed" && req.method === "POST") {
    await updateJob(job, {
      state: job.outputAssetId ? "completed" : "failed",
      progress: job.outputAssetId ? 100 : job.progress,
      error: job.outputAssetId
        ? null
        : "The cloud renderer could not finish. Your project and sources are saved.",
      leaseUntil: 0,
    });
    return json({ ok: true });
  }
  return Response.json({ error: "Operation not found." }, { status: 404 });
}
