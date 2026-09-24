import {
  compositorVersion,
  directorSchemaVersion,
} from "../compositor/version";
import {
  assets,
  takes,
  jobInputHash,
  validateRender,
  updateAssetMetadata,
} from "./db";
import { referencedMedia } from "./lifecycle";
import type { Draft, Job } from "../contracts";
export async function exportManifest(
  projectId: string,
  draft: Draft,
  revision: number,
) {
  const media = await assets(projectId),
    savedTakes = await takes(projectId),
    refs = referencedMedia(draft);
  for (const s of draft.shots) {
    const t = savedTakes.find((t) => t.id === s.selectedTakeId);
    if (t) refs.add(t.assetId);
  }
  return {
    version: 1,
    revision,
    compositorVersion,
    directorSchemaVersion,
    sourceCommit:
      process.env.CUE_RENDER_REF ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local-working-tree",
    draftHash: jobInputHash("draft", draft),
    sources: media
      .filter((a) => refs.has(a.id))
      .map((a) => ({
        id: a.id,
        hash: a.hash,
        name: a.name,
        rights: a.metadata.rights || null,
      })),
    takes: savedTakes.filter((t) =>
      draft.shots.some((s) => s.selectedTakeId === t.id),
    ),
  };
}
export async function validateExportInput(job: Job) {
  await validateRender(job.projectId, job.payload.draft);
  const manifest = job.payload.manifest;
  if (!manifest) return; // Legacy queued exports remain readable.
  const media = await assets(job.projectId);
  if (
    manifest.draftHash !== jobInputHash("draft", job.payload.draft) ||
    manifest.sources.some(
      (ref: { id: string; hash: string }) =>
        !media.some((a) => a.id === ref.id && a.hash === ref.hash),
    )
  )
    throw Error("The frozen export input failed integrity validation.");
}

export async function attachExportManifest(id: string, job: Job) {
  await updateAssetMetadata(id, {
    manifest: job.payload.manifest,
    jobId: job.id,
  });
}
