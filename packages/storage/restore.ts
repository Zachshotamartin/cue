import { randomUUID } from "node:crypto";
import { z } from "zod";
import { draftSchema } from "../contracts";
import { assets, project, editProject, addTake, tx, now, db } from "./db";
import { lockAccount } from "./client";
export const restoreSchema = z.object({
  revision: z.number().int(),
  draft: draftSchema,
  mapping: z
    .record(z.string(), z.string())
    .refine((m) => Object.keys(m).length <= 1000),
  sources: z
    .array(
      z.object({
        id: z.string(),
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        privacyPending: z.boolean().optional(),
        supersededBy: z.string().optional(),
      }),
    )
    .max(1000),
  takes: z
    .array(
      z.object({
        id: z.string(),
        shotId: z.string(),
        assetId: z.string(),
        prompt: z.string().max(1000),
        model: z.string().max(100),
        sourceHash: z.string().max(64),
      }),
    )
    .max(1000),
});
export async function restoreArchive(id: string, owner: string, raw: unknown) {
  const input = restoreSchema.parse(raw);
  return tx(async () => {
    await lockAccount(owner);
    const target = await project(id, owner);
    if (target.revision !== input.revision || target.draft.shots.length)
      throw Error("Restore into an empty film at its current revision.");
    const owned = new Map((await assets(id)).map((a) => [a.id, a]));
    for (const source of input.sources) {
      const a = owned.get(input.mapping[source.id]);
      if (
        !a ||
        (a.hash !== source.hash && a.metadata.originalHash !== source.hash)
      )
        throw Error(
          "Archive media is missing or has changed. Re-select the complete extracted archive folder.",
        );
    }
    const ref = (value: string | null) => {
      if (!value) return null;
      const mapped = input.mapping[value];
      if (!mapped || !owned.has(mapped))
        throw Error("Archive references missing media.");
      return mapped;
    };
    const takeMap = new Map<string, string>();
    // Import normalizes untrusted metadata. Restore only validated privacy references;
    // never reuse analysis paths or signed URLs from the original account.
    for (const source of input.sources) {
      const a = owned.get(input.mapping[source.id])!;
      if (source.privacyPending || source.supersededBy) {
        const supersededBy = source.supersededBy
          ? ref(source.supersededBy)
          : undefined;
        await db.prepare("UPDATE assets SET data=? WHERE id=?").run(
          JSON.stringify({
            ...a,
            metadata: {
              ...a.metadata,
              privacyPending: !!source.privacyPending,
              ...(supersededBy ? { supersededBy } : {}),
            },
          }),
          a.id,
        );
      }
    }
    for (const t of input.takes) {
      const takeId = randomUUID();
      await addTake({
        ...t,
        id: takeId,
        projectId: id,
        assetId: ref(t.assetId)!,
        jobId: `restored:${takeId}`,
        createdAt: now(),
      });
      takeMap.set(t.id, takeId);
    }
    for (const shot of input.draft.shots) {
      if (shot.selectedTakeId && !takeMap.has(shot.selectedTakeId))
        throw Error("Archive is missing a selected generated take.");
    }
    const draft = structuredClone(input.draft);
    draft.brand.logoAssetId = ref(draft.brand.logoAssetId);
    draft.musicAssetId = ref(draft.musicAssetId);
    draft.excludedAssetIds = draft.excludedAssetIds.map((a) => ref(a)!);
    draft.soundCues = draft.soundCues.map((c) => ({
      ...c,
      assetId: ref(c.assetId)!,
    }));
    draft.shots = draft.shots.map((s) => ({
      ...s,
      assetId: ref(s.assetId),
      secondaryAssetId: ref(s.secondaryAssetId),
      narrationAssetId: ref(s.narrationAssetId),
      evidenceIds: s.evidenceIds.map((a) => ref(a)!),
      selectedTakeId: s.selectedTakeId
        ? takeMap.get(s.selectedTakeId) || null
        : null,
    }));
    return editProject(id, input.revision, draft, "Restore portable archive");
  });
}
