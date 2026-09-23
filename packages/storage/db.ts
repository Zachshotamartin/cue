import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir } from "./config";
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

export const db = new DatabaseSync(path.join(dataDir, "cue.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
);
db.exec(`
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL, draft TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, revision INTEGER NOT NULL, draft TEXT NOT NULL, label TEXT NOT NULL, createdAt TEXT NOT NULL, PRIMARY KEY(projectId,revision));
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, state TEXT NOT NULL, leaseUntil INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, idem TEXT NOT NULL, UNIQUE(projectId,idem));
CREATE TABLE IF NOT EXISTS takes (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, projectId TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS credentials (owner TEXT NOT NULL, provider TEXT NOT NULL, encrypted TEXT NOT NULL, suffix TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY(owner,provider));
CREATE TABLE IF NOT EXISTS pairing (code TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, expiresAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS capture_tokens (tokenHash TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, expiresAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_project ON events(projectId,id);
CREATE INDEX IF NOT EXISTS jobs_state ON jobs(state,leaseUntil);
`);
export const now = () => new Date().toISOString();
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function event(projectId: string, type: string, data: unknown = {}) {
  db.prepare(
    "INSERT INTO events(projectId,type,data,createdAt) VALUES(?,?,?,?)",
  ).run(projectId, type, JSON.stringify(data), now());
}
export function project(id: string, owner = "local"): Project {
  const r: any = db
    .prepare("SELECT * FROM projects WHERE id=? AND owner=?")
    .get(id, owner);
  if (!r) throw new Error("Project not found.");
  return { ...r, draft: draftSchema.parse(JSON.parse(r.draft)) };
}
export function projects(owner = "local"): Project[] {
  return (
    db
      .prepare("SELECT * FROM projects WHERE owner=? ORDER BY updatedAt DESC")
      .all(owner) as any[]
  ).map((r) => ({ ...r, draft: draftSchema.parse(JSON.parse(r.draft)) }));
}
export function createProject(title: string, siteUrl = "", owner = "local") {
  const p: Project = {
    id: randomUUID(),
    owner,
    revision: 1,
    draft: defaultDraft(title, siteUrl),
    createdAt: now(),
    updatedAt: now(),
  };
  tx(() => {
    db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run(
      p.id,
      p.owner,
      1,
      JSON.stringify(p.draft),
      p.createdAt,
      p.updatedAt,
    );
    db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?)").run(
      p.id,
      1,
      JSON.stringify(p.draft),
      "Create project",
      p.createdAt,
    );
    event(p.id, "project.created");
  });
  return p;
}
export function assets(id: string): Asset[] {
  return (
    db.prepare("SELECT data FROM assets WHERE projectId=?").all(id) as any[]
  ).map((r) => JSON.parse(r.data));
}
export function getAsset(id: string): Asset {
  const r: any = db.prepare("SELECT data FROM assets WHERE id=?").get(id);
  if (!r) throw new Error("Asset not found.");
  return JSON.parse(r.data);
}
export function addAsset(asset: Asset) {
  db.prepare("INSERT INTO assets VALUES(?,?,?)").run(
    asset.id,
    asset.projectId,
    JSON.stringify(asset),
  );
  event(asset.projectId, "asset.added", { id: asset.id });
}
export function jobs(id: string): Job[] {
  return (
    db
      .prepare(
        "SELECT data FROM jobs WHERE projectId=? ORDER BY rowid DESC LIMIT 100",
      )
      .all(id) as any[]
  ).map((r) => JSON.parse(r.data));
}
export function getJob(id: string): Job {
  const r: any = db.prepare("SELECT data FROM jobs WHERE id=?").get(id);
  if (!r) throw new Error("Job not found.");
  return JSON.parse(r.data);
}
export function updateJob(job: Job, patch: Partial<Job>) {
  const next = { ...getJob(job.id), ...patch, updatedAt: now() };
  db.prepare("UPDATE jobs SET state=?,leaseUntil=?,data=? WHERE id=?").run(
    next.state,
    next.leaseUntil,
    JSON.stringify(next),
    next.id,
  );
  event(next.projectId, "job.updated", {
    id: next.id,
    state: next.state,
    progress: next.progress,
  });
  return next;
}
export function budget(id: string) {
  const all = (
    db.prepare("SELECT data FROM jobs WHERE projectId=?").all(id) as any[]
  ).map((r) => JSON.parse(r.data) as Job);
  return {
    spent: all.reduce((n, j) => n + j.chargedCents, 0),
    reserved: all.reduce((n, j) => n + j.reservedCents, 0),
    limit: project(id).draft.budgetCents,
  };
}
export function enqueue(
  id: string,
  kind: Job["kind"],
  payload: Job["payload"],
  idem: string,
  reservedCents = 0,
) {
  return tx(() => {
    const previous: any = db
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
    const b = budget(id);
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
    db.prepare("INSERT INTO jobs VALUES(?,?,?,?,?,?)").run(
      job.id,
      id,
      job.state,
      0,
      JSON.stringify(job),
      idem,
    );
    event(id, "job.queued", { id: job.id });
    return job;
  });
}
export function claimJob(): Job | null {
  return tx(() => {
    const row: any = db
      .prepare(
        "SELECT data FROM jobs WHERE state IN ('queued','running','retrieving','submitting') AND leaseUntil<? ORDER BY rowid LIMIT 1",
      )
      .get(Date.now());
    if (!row) return null;
    const j: Job = JSON.parse(row.data);
    if (j.state === "submitting" && !j.providerTaskId) {
      updateJob(j, {
        state: "unknown",
        error:
          "Submission was interrupted before a provider task ID was saved. Check provider billing before retrying.",
        leaseUntil: 0,
      });
      return null;
    }
    return updateJob(j, { leaseUntil: Date.now() + 60000 });
  });
}
export function takes(id: string): Take[] {
  return (
    db.prepare("SELECT data FROM takes WHERE projectId=?").all(id) as any[]
  ).map((r) => JSON.parse(r.data));
}
export function addTake(take: Take) {
  const existing = takes(take.projectId).find((t) => t.jobId === take.jobId);
  if (existing) return existing;
  db.prepare("INSERT INTO takes VALUES(?,?,?)").run(
    take.id,
    take.projectId,
    JSON.stringify(take),
  );
  event(take.projectId, "take.added", { id: take.id });
  return take;
}
export function validateReferences(id: string, draft: Draft) {
  const owned = new Map(assets(id).map((a) => [a.id, a]));
  const knownTakes = new Map(takes(id).map((t) => [t.id, t]));
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
export function editProject(
  id: string,
  expectedRevision: number,
  raw: unknown,
  label = "Edit project",
) {
  const draft = draftSchema.parse(raw);
  return tx(() => {
    const p = project(id);
    if (p.revision !== expectedRevision)
      throw new Error(
        "Revision conflict. Reload the latest project before saving.",
      );
    validateReferences(id, draft);
    const r = p.revision + 1,
      at = now();
    db.prepare(
      "UPDATE projects SET revision=?,draft=?,updatedAt=? WHERE id=?",
    ).run(r, JSON.stringify(draft), at, id);
    db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?)").run(
      id,
      r,
      JSON.stringify(draft),
      label,
      at,
    );
    event(id, "project.updated", { revision: r });
    return project(id);
  });
}
export function snapshot(id: string): Snapshot {
  const cursor: any = db
    .prepare("SELECT MAX(id) AS n FROM events WHERE projectId=?")
    .get(id);
  return {
    project: project(id),
    assets: assets(id),
    jobs: jobs(id),
    takes: takes(id),
    revisions: db
      .prepare(
        "SELECT revision,label,createdAt FROM revisions WHERE projectId=? ORDER BY revision DESC LIMIT 100",
      )
      .all(id) as any,
    budget: budget(id),
    eventsCursor: Number(cursor.n || 0),
  };
}

export function validateRender(id: string, draft: Draft) {
  validateReferences(id, draft);
  if (!draft.shots.length) throw new Error("Add scenes before exporting.");
  const owned = new Map(assets(id).map((a) => [a.id, a]));
  const knownTakes = new Map(takes(id).map((t) => [t.id, t]));
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
