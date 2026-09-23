import { randomUUID } from "node:crypto";
import {
  defaultDraft,
  draftSchema,
  type Project,
  type Asset,
  type Job,
  type Take,
  type Snapshot,
  type Draft,
} from "../contracts";

export { db, tx } from "./client";
import { db, tx, rowLock, lockAccount } from "./client";
export const now = () => new Date().toISOString();
export async function event(
  projectId: string,
  type: string,
  data: unknown = {},
) {
  await db
    .prepare(
      "INSERT INTO events(projectId,type,data,createdAt) VALUES(?,?,?,?)",
    )
    .run(projectId, type, JSON.stringify(data), now());
}
export async function project(id: string, owner?: string): Promise<Project> {
  const r: any = await db
    .prepare(
      "SELECT * FROM projects WHERE id=?" +
        (owner ? " AND owner=?" : "") +
        rowLock(),
    )
    .get(...(owner ? [id, owner] : [id]));
  if (!r) throw new Error("Project not found.");
  return { ...r, draft: draftSchema.parse(JSON.parse(r.draft)) };
}
export async function projects(owner = "local"): Promise<Project[]> {
  return (
    (await db
      .prepare("SELECT * FROM projects WHERE owner=? ORDER BY updatedAt DESC")
      .all(owner)) as any[]
  ).map((r) => ({ ...r, draft: draftSchema.parse(JSON.parse(r.draft)) }));
}
export async function createProject(
  title: string,
  siteUrl = "",
  owner = "local",
) {
  const p: Project = {
    id: randomUUID(),
    owner,
    revision: 1,
    draft: defaultDraft(title, siteUrl),
    createdAt: now(),
    updatedAt: now(),
  };
  await tx(async () => {
    await db
      .prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)")
      .run(p.id, p.owner, 1, JSON.stringify(p.draft), p.createdAt, p.updatedAt);
    await db
      .prepare("INSERT INTO revisions VALUES(?,?,?,?,?)")
      .run(p.id, 1, JSON.stringify(p.draft), "Create project", p.createdAt);
    await event(p.id, "project.created");
  });
  return p;
}
export async function assets(id: string): Promise<Asset[]> {
  return (
    (await db
      .prepare("SELECT data FROM assets WHERE projectId=?")
      .all(id)) as any[]
  ).map((r) => JSON.parse(r.data));
}
export async function getAsset(id: string): Promise<Asset> {
  const r: any = await db.prepare("SELECT data FROM assets WHERE id=?").get(id);
  if (!r) throw new Error("Asset not found.");
  return JSON.parse(r.data);
}
export async function addAsset(asset: Asset) {
  await db
    .prepare("INSERT INTO assets VALUES(?,?,?)")
    .run(asset.id, asset.projectId, JSON.stringify(asset));
  await event(asset.projectId, "asset.added", { id: asset.id });
}
export async function jobs(id: string): Promise<Job[]> {
  return (
    (await db
      .prepare("SELECT data FROM jobs WHERE projectId=? ORDER BY data DESC")
      .all(id)) as any[]
  )
    .map((r) => JSON.parse(r.data))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getJob(id: string): Promise<Job> {
  const r: any = await db
    .prepare("SELECT data FROM jobs WHERE id=?" + rowLock())
    .get(id);
  if (!r) throw new Error("Job not found.");
  return JSON.parse(r.data);
}
export async function updateJob(job: Job, patch: Partial<Job>) {
  return tx(async () => {
    const next = { ...(await getJob(job.id)), ...patch, updatedAt: now() };
    await db
      .prepare("UPDATE jobs SET state=?,leaseUntil=?,data=? WHERE id=?")
      .run(next.state, next.leaseUntil, JSON.stringify(next), next.id);
    await event(next.projectId, "job.updated", {
      id: next.id,
      state: next.state,
      progress: next.progress,
    });
    return next;
  });
}
export async function budget(id: string) {
  const all = (
    (await db
      .prepare("SELECT data FROM jobs WHERE projectId=?")
      .all(id)) as any[]
  ).map((r) => JSON.parse(r.data) as Job);
  return {
    spent: all.reduce((n, j) => n + j.chargedCents, 0),
    reserved: all.reduce((n, j) => n + j.reservedCents, 0),
    limit: (await project(id)).draft.budgetCents,
  };
}
export async function enqueue(
  id: string,
  kind: Job["kind"],
  payload: Job["payload"],
  idem: string,
  reservedCents = 0,
) {
  return await tx(async () => {
    const identity = await db
      .prepare("SELECT owner FROM projects WHERE id=?")
      .get(id);
    if (!identity) throw new Error("Project not found.");
    await lockAccount(identity.owner);
    const ownerProject = await project(id); // Locks the budget and idempotency namespace.
    const previous: any = await db
      .prepare("SELECT data FROM jobs WHERE projectId=? AND idem=?")
      .get(id, idem);
    if (previous) {
      const prior = JSON.parse(previous.data) as Job;
      if (
        prior.kind !== kind ||
        JSON.stringify(
          Object.fromEntries(
            Object.entries(prior.payload).filter(
              ([k]) => !["result", "retries"].includes(k),
            ),
          ),
        ) !== JSON.stringify(payload)
      )
        throw new Error(
          "Idempotency conflict: this request key already belongs to another job.",
        );
      return prior;
    }
    const active = (await accountJobs(ownerProject.owner)).filter(
      (j) => !["completed", "failed", "cancelled", "unknown"].includes(j.state),
    );
    if (active.length >= 3)
      throw new Error("Wait for one of your three active jobs to finish.");
    const recent = (await accountJobs(ownerProject.owner)).filter(
      (j) =>
        j.kind === "render" && Date.now() - Date.parse(j.createdAt) < 3600000,
    );
    if (kind === "render" && recent.length >= 5)
      throw new Error(
        "Cloud exports are limited to five per hour per account. Your edits are saved.",
      );
    if ((await projectStorage(ownerProject.owner)) > 900 * 1048576)
      throw new Error(
        "Your account is close to its 1 GiB media limit. Export and remove unused media before generating more.",
      );
    const b = await budget(id);
    if (b.spent + b.reserved + reservedCents > b.limit)
      throw new Error("This job exceeds the project spending limit.");
    const job: Job = {
      id: randomUUID(),
      projectId: id,
      kind,
      state: "queued",
      progress: 0,
      payload,
      providerTaskId: null,
      error: null,
      outputAssetId: null,
      reservedCents,
      chargedCents: 0,
      cancelRequested: false,
      leaseUntil: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    await db
      .prepare("INSERT INTO jobs VALUES(?,?,?,?,?,?)")
      .run(job.id, id, job.state, 0, JSON.stringify(job), idem);
    await event(id, "job.queued", { id: job.id });
    return job;
  });
}
export async function claimJob(): Promise<Job | null> {
  return await tx(async () => {
    const row: any = await db
      .prepare(
        "SELECT data FROM jobs WHERE state IN ('queued','running','retrieving','submitting') AND leaseUntil<? ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
      )
      .get(Date.now());
    if (!row) return null;
    const j: Job = JSON.parse(row.data);
    if (j.state === "submitting" && !j.providerTaskId) {
      await updateJob(j, {
        state: "unknown",
        error:
          "Submission was interrupted before a provider task ID was saved. Check provider billing before retrying.",
        leaseUntil: 0,
      });
      return null;
    }
    return await updateJob(j, { leaseUntil: Date.now() + 60000 });
  });
}
export async function takes(id: string): Promise<Take[]> {
  return (
    (await db
      .prepare("SELECT data FROM takes WHERE projectId=?")
      .all(id)) as any[]
  ).map((r) => JSON.parse(r.data));
}
export async function addTake(take: Take) {
  const existing = (await takes(take.projectId)).find(
    (t) => t.jobId === take.jobId,
  );
  if (existing) return existing;
  await db
    .prepare("INSERT INTO takes VALUES(?,?,?)")
    .run(take.id, take.projectId, JSON.stringify(take));
  await event(take.projectId, "take.added", { id: take.id });
  return take;
}
export async function validateReferences(id: string, draft: Draft) {
  const owned = new Map((await assets(id)).map((a) => [a.id, a]));
  const knownTakes = new Map((await takes(id)).map((t) => [t.id, t]));
  const ids = draft.shots.map((s) => s.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Scene IDs must be unique.");
  for (const a of [
    draft.brand.logoAssetId,
    draft.musicAssetId,
    ...draft.shots.flatMap((s) => [
      s.assetId,
      s.secondaryAssetId,
      s.narrationAssetId,
    ]),
  ])
    if (a && !owned.has(a))
      throw new Error("An asset does not belong to this project.");
  if (
    draft.brand.logoAssetId &&
    owned.get(draft.brand.logoAssetId)?.kind !== "image"
  )
    throw new Error("The brand mark must be an image.");
  if (draft.musicAssetId && owned.get(draft.musicAssetId)?.kind !== "audio")
    throw new Error("Choose an audio file for the soundtrack.");
  for (const s of draft.shots) {
    if (s.assetId && owned.get(s.assetId)?.kind === "audio")
      throw new Error("A scene needs an image or video.");
    if (s.narrationAssetId && owned.get(s.narrationAssetId)?.kind !== "audio")
      throw new Error("Narration needs audio.");
    if (s.selectedTakeId && knownTakes.get(s.selectedTakeId)?.shotId !== s.id)
      throw new Error("This take belongs to another scene.");
    if (
      s.selectedTakeId &&
      s.assetId &&
      knownTakes.get(s.selectedTakeId)?.sourceHash !==
        owned.get(s.assetId)?.hash
    )
      throw new Error(
        "The source has changed. Select or generate a take for this source.",
      );
  }
  if (draft.shots.reduce((n, s) => n + s.duration, 0) > 300)
    throw new Error("Films are limited to five minutes.");
}
export async function editProject(
  id: string,
  expectedRevision: number,
  raw: unknown,
  label = "Edit project",
) {
  const draft = draftSchema.parse(raw);
  return await tx(async () => {
    const p = await project(id);
    if (p.revision !== expectedRevision)
      throw new Error(
        "Revision conflict. Reload the latest project before saving.",
      );
    await validateReferences(id, draft);
    const r = p.revision + 1,
      at = now();
    await db
      .prepare("UPDATE projects SET revision=?,draft=?,updatedAt=? WHERE id=?")
      .run(r, JSON.stringify(draft), at, id);
    await db
      .prepare("INSERT INTO revisions VALUES(?,?,?,?,?)")
      .run(id, r, JSON.stringify(draft), label, at);
    await event(id, "project.updated", { revision: r });
    return await project(id);
  });
}
export async function snapshot(id: string): Promise<Snapshot> {
  const cursor: any = await db
    .prepare("SELECT MAX(id) AS n FROM events WHERE projectId=?")
    .get(id);
  return {
    project: await project(id),
    assets: await assets(id),
    jobs: await jobs(id),
    takes: await takes(id),
    revisions: (await db
      .prepare(
        "SELECT revision,label,createdAt FROM revisions WHERE projectId=? ORDER BY revision DESC LIMIT 100",
      )
      .all(id)) as any,
    budget: await budget(id),
    eventsCursor: Number(cursor.n || 0),
  };
}

export async function validateRender(id: string, draft: Draft) {
  await validateReferences(id, draft);
  if (!draft.shots.length) throw new Error("Add scenes before exporting.");
  const owned = new Map((await assets(id)).map((a) => [a.id, a]));
  const knownTakes = new Map((await takes(id)).map((t) => [t.id, t]));
  for (const s of draft.shots) {
    if (!s.assetId && s.template !== "endcard")
      throw new Error(`Choose a source for “${s.title}”.`);
    if (s.template === "comparison" && !s.secondaryAssetId)
      throw new Error(`Choose both sources for “${s.title}”.`);
    if (s.mode !== "exact-ui" && !s.selectedTakeId)
      throw new Error(
        `Choose a generated take for “${s.title}”, or change its mode to Exact UI.`,
      );
    const narration = s.narrationAssetId && owned.get(s.narrationAssetId);
    if (narration && (narration.duration || 0) > s.duration + 1 / 30)
      throw new Error(
        `Narration is longer than “${s.title}”. Lengthen the scene or use shorter audio.`,
      );
    const take = s.selectedTakeId && knownTakes.get(s.selectedTakeId);
    const sourceIds =
      s.mode === "generated-video" && take
        ? [take.assetId]
        : [
            s.assetId,
            s.secondaryAssetId,
            s.mode === "hybrid" && take ? take.assetId : null,
          ];
    for (const sourceId of sourceIds) {
      const a = sourceId && owned.get(sourceId);
      if (
        a &&
        a.kind === "video" &&
        s.trimStart + s.duration > (a.duration || 0) + 1 / 30
      )
        throw new Error(
          `“${s.title}” extends beyond its video. Reduce its duration or trim start.`,
        );
    }
  }
}

export async function claimSpecificJob(id: string) {
  return tx(async () => {
    const job = await getJob(id);
    if (
      ["completed", "failed", "cancelled", "unknown"].includes(job.state) ||
      job.leaseUntil > Date.now()
    )
      return null;
    if (job.state === "submitting" && !job.providerTaskId) {
      await updateJob(job, {
        state: "unknown",
        leaseUntil: 0,
        error:
          "Submission was interrupted before confirmation. Check provider history before retrying.",
      });
      return null;
    }
    return updateJob(job, { leaseUntil: Date.now() + 300000 });
  });
}

export async function projectStorage(owner: string) {
  const rows = await db
    .prepare(
      "SELECT a.data FROM assets a JOIN projects p ON p.id=a.projectId WHERE p.owner=?",
    )
    .all(owner);
  return rows.reduce((n, r) => n + Number(JSON.parse(r.data).bytes || 0), 0);
}
export async function accountJobs(owner: string) {
  return (
    await db
      .prepare(
        "SELECT j.data FROM jobs j JOIN projects p ON p.id=j.projectId WHERE p.owner=?",
      )
      .all(owner)
  ).map((r) => JSON.parse(r.data) as Job);
}
