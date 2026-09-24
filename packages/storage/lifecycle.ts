import { randomUUID } from "node:crypto";
import {
  assets,
  jobs,
  project,
  projects,
  db,
  tx,
  createProject,
  editProject,
  getAsset,
  addAsset,
  takes,
  addTake,
} from "./db";
import { lockAccount } from "./client";
import { draftSchema, type Asset, type Draft } from "../contracts";
import type { EvidenceAnalysis } from "../contracts/evidence";

const active = (state: string) =>
  !["completed", "cancelled", "failed"].includes(state);
export function referencedMedia(draft: Draft) {
  return new Set(
    [
      draft.brand.logoAssetId,
      draft.musicAssetId,
      ...draft.soundCues.map((c) => c.assetId),
      ...draft.shots.flatMap((s) => [
        s.assetId,
        s.secondaryAssetId,
        s.narrationAssetId,
        ...s.evidenceIds,
      ]),
    ].filter(Boolean),
  );
}
async function queueObjects(asset: Asset) {
  const candidates = [
    asset.path,
    ...((asset.metadata.analysis as EvidenceAnalysis | undefined)?.frames.map(
      (f) => f.path,
    ) || []),
  ];
  for (const object of candidates)
    await db
      .prepare(
        "INSERT INTO garbage VALUES(?,?,?) ON CONFLICT(object_path) DO NOTHING",
      )
      .run(object, asset.path === object ? "asset" : "object", Date.now());
}
export async function deleteUnusedAsset(id: string, owner: string) {
  return tx(async () => {
    await lockAccount(owner);
    const asset = await getAsset(id);
    await project(asset.projectId, owner);
    if ((await jobs(asset.projectId)).some((j) => active(j.state)))
      throw new Error("Finish or reconcile active jobs before removing media.");
    const revisions = await db
      .prepare("SELECT draft FROM revisions WHERE projectId=?")
      .all(asset.projectId);
    const used = revisions.some((r) =>
      referencedMedia(draftSchema.parse(JSON.parse(r.draft))).has(id),
    );
    if (used || (await takes(asset.projectId)).some((t) => t.assetId === id))
      throw new Error(
        "This media belongs to saved history or a generated take. Delete the project to remove its full history, or keep this source for restoration.",
      );
    await queueObjects(asset);
    await db.prepare("DELETE FROM assets WHERE id=?").run(id);
    return { removed: true };
  });
}
export async function deleteProject(id: string, owner: string) {
  return tx(async () => {
    await lockAccount(owner);
    await project(id, owner);
    if ((await jobs(id)).some((j) => active(j.state)))
      throw new Error(
        "Finish or reconcile active jobs before deleting the project.",
      );
    for (const a of await assets(id)) await queueObjects(a);
    await db.prepare("DELETE FROM projects WHERE id=?").run(id);
    return { removed: true };
  });
}
export async function duplicateProject(id: string, owner: string) {
  return tx(async () => {
    await lockAccount(owner);
    if ((await projects(owner)).length >= 100)
      throw new Error("Remove a project before adding another.");
    const source = await project(id, owner);
    const target = await createProject(
      `${source.draft.title} · copy`.slice(0, 100),
      source.draft.siteUrl,
      owner,
    );
    const map = new Map<string, string>();
    for (const a of await assets(id)) {
      const next = { ...a, id: randomUUID(), projectId: target.id };
      map.set(a.id, next.id);
      await addAsset(next);
    }
    const ref = (id: string | null) => (id ? map.get(id) || null : null);
    for (const a of await assets(target.id)) {
      if (typeof a.metadata.supersededBy === "string")
        await db.prepare("UPDATE assets SET data=? WHERE id=?").run(
          JSON.stringify({
            ...a,
            metadata: {
              ...a.metadata,
              supersededBy: ref(a.metadata.supersededBy),
            },
          }),
          a.id,
        );
    }
    const takeMap = new Map<string, string>();
    for (const t of await takes(id)) {
      const next = {
        ...t,
        id: randomUUID(),
        projectId: target.id,
        assetId: ref(t.assetId)!,
      };
      takeMap.set(t.id, next.id);
      await addTake(next);
    }
    const draft = structuredClone(source.draft);
    draft.title = target.draft.title;
    draft.brand.logoAssetId = ref(draft.brand.logoAssetId);
    draft.musicAssetId = ref(draft.musicAssetId);
    draft.excludedAssetIds = draft.excludedAssetIds
      .map((id) => ref(id)!)
      .filter(Boolean);
    draft.soundCues = draft.soundCues.map((c) => ({
      ...c,
      assetId: ref(c.assetId)!,
    }));
    draft.shots = draft.shots.map((s) => ({
      ...s,
      assetId: ref(s.assetId),
      secondaryAssetId: ref(s.secondaryAssetId),
      narrationAssetId: ref(s.narrationAssetId),
      evidenceIds: s.evidenceIds.map((id) => ref(id)!).filter(Boolean),
      selectedTakeId: s.selectedTakeId
        ? takeMap.get(s.selectedTakeId) || null
        : null,
    }));
    return editProject(target.id, 1, draft, "Duplicate film");
  });
}

/** Explicitly discard old history; the current film and every saved export survive. */
export async function pruneHistory(
  id: string,
  owner: string,
  revision: number,
) {
  return tx(async () => {
    await lockAccount(owner);
    const current = await project(id, owner);
    if (current.revision !== revision)
      throw Error("Revision conflict. Reload before cleaning history.");
    if ((await jobs(id)).some((j) => active(j.state)))
      throw Error("Finish or reconcile active jobs before cleaning history.");
    const selected = new Set(current.draft.shots.map((s) => s.selectedTakeId));
    const keep = referencedMedia(current.draft);
    for (const t of await takes(id)) {
      if (selected.has(t.id)) keep.add(t.assetId);
      else await db.prepare("DELETE FROM takes WHERE id=?").run(t.id);
    }
    let removedBytes = 0,
      removed = 0;
    for (const a of await assets(id)) {
      if (
        keep.has(a.id) ||
        ["export", "export-poster"].includes(String(a.metadata.state))
      )
        continue;
      await queueObjects(a);
      await db.prepare("DELETE FROM assets WHERE id=?").run(a.id);
      removedBytes += a.bytes;
      removed++;
    }
    const remaining = new Set((await assets(id)).map((a) => a.id));
    const draft = {
      ...current.draft,
      excludedAssetIds: current.draft.excludedAssetIds.filter((a) =>
        remaining.has(a),
      ),
    };
    const saved = await editProject(
      id,
      revision,
      draft,
      "Clean old media and history",
    );
    await db
      .prepare("DELETE FROM revisions WHERE projectId=? AND revision<?")
      .run(id, saved.revision);
    return { removed, removedBytes };
  });
}

export async function deleteAccountData(owner: string) {
  return tx(async () => {
    await lockAccount(owner);
    for (const p of await projects(owner)) await deleteProject(p.id, owner);
    await db.prepare("DELETE FROM credentials WHERE owner=?").run(owner);
    await db.prepare("DELETE FROM credential_checks WHERE owner=?").run(owner);
  });
}
