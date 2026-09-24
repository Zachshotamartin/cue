import { randomUUID } from "node:crypto";
import type { Job } from "../../packages/contracts";
import {
  applyPlan,
  evidenceAssets,
  storyboardPrompt,
  rankCaptures,
} from "../../packages/director";
import {
  analysisCurrent,
  analyzeAsset,
} from "../../packages/director/analysis";
import {
  cancelVideo,
  downloadOutput,
  planStoryboard,
  pollVideo,
  ProviderError,
  submitVideo,
  synthesize,
} from "../../packages/providers";
import { generateSound, timedSpeech } from "../../packages/providers/audio";
import {
  addTake,
  assets,
  event,
  getAsset,
  getJob,
  now,
  project,
  updateJob,
} from "../../packages/storage/db";
import { importMedia } from "../../packages/storage/media";
import { redactMedia } from "../../packages/storage/redaction";
import { renderFilm } from "./render";

export async function runJob(start: Job) {
  let job = start;
  const heartbeat = setInterval(async () => {
    try {
      job = await updateJob(job, { leaseUntil: Date.now() + 60000 });
    } catch {}
  }, 20000);
  try {
    const owner = (await project(job.projectId)).owner;
    if (job.cancelRequested) {
      if (job.providerTaskId) await cancelVideo(owner, job.providerTaskId);
      await updateJob(job, {
        state: "cancelled",
        reservedCents: 0,
        chargedCents: job.providerTaskId
          ? job.chargedCents || job.reservedCents
          : job.chargedCents,
        leaseUntil: 0,
      });
      return;
    }
    if (job.kind === "redact") {
      job = await updateJob(job, { state: "running", progress: 10 });
      const source = await getAsset(job.payload.assetId);
      if (source.projectId !== job.projectId)
        throw Error("Source belongs to another film.");
      const result = await redactMedia(source, job.payload);
      await updateJob(job, {
        state: (await getJob(job.id)).cancelRequested
          ? "cancelled"
          : "completed",
        progress: 100,
        outputAssetId: result.id,
        leaseUntil: 0,
      });
    } else if (job.kind === "analyze") {
      for (const ref of job.payload.evidence || []) {
        const asset = await getAsset(ref.id);
        if (asset.projectId !== job.projectId || asset.hash !== ref.hash)
          throw new Error("Source evidence changed.");
        if ((await getJob(job.id)).cancelRequested) {
          await updateJob(job, { state: "cancelled", leaseUntil: 0 });
          return;
        }
        if (asset.kind === "video" && !analysisCurrent(asset)) {
          await analyzeAsset(asset);
          await updateJob(job, {
            state: "running",
            progress: Math.min(90, job.progress + 10),
            leaseUntil: 0,
          });
          return;
        }
      }
      await updateJob(job, {
        state: "completed",
        progress: 100,
        leaseUntil: 0,
      });
    } else if (job.kind === "generate") {
      if (!job.providerTaskId) {
        job = await updateJob(job, { state: "submitting", progress: 5 });
        const taskId = await submitVideo(
          owner,
          await getAsset(job.payload.sourceAssetId),
          job.payload.prompt,
          job.payload.model,
          job.payload.seconds,
          job.payload.format,
        );
        job = await updateJob(job, {
          state: "running",
          providerTaskId: taskId,
          chargedCents: job.reservedCents,
          reservedCents: 0,
          progress: 15,
        });
      }
      const result = await pollVideo(owner, job.providerTaskId!);
      if (result.status === "FAILED" || result.status === "CANCELLED")
        throw new ProviderError(
          `The video provider ${result.status === "FAILED" ? "could not generate this take" : "cancelled this take"}. The original scene is unchanged.`,
          true,
        );
      if (result.status !== "SUCCEEDED") {
        await updateJob(job, {
          state: "running",
          progress:
            typeof result.progress === "number"
              ? Math.max(15, Math.min(85, result.progress * 85))
              : 20,
          leaseUntil: Date.now() + 8000,
        });
        return;
      }
      if (!result.output?.[0])
        throw new ProviderError(
          "The completed task has no downloadable video.",
        );
      job = await updateJob(job, { state: "retrieving", progress: 90 });
      const asset = await importMedia(
        job.projectId,
        await downloadOutput(result.output[0]),
        `${job.payload.shotTitle}-take.mp4`,
        { state: "generated", title: job.payload.shotTitle },
      );
      if (
        asset.kind !== "video" ||
        !asset.duration ||
        asset.duration < job.payload.seconds - 0.2
      )
        throw new ProviderError(
          "The provider returned an invalid or incomplete video.",
          true,
        );
      await addTake({
        id: randomUUID(),
        projectId: job.projectId,
        shotId: job.payload.shotId,
        assetId: asset.id,
        jobId: job.id,
        prompt: job.payload.prompt,
        model: job.payload.model,
        sourceHash: job.payload.sourceHash,
        createdAt: now(),
      });
      await updateJob(job, {
        state: "completed",
        error: null,
        progress: 100,
        outputAssetId: asset.id,
        leaseUntil: 0,
      });
    } else if (job.kind === "plan") {
      if (job.payload.result) {
        await updateJob(job, {
          state: "completed",
          progress: 100,
          leaseUntil: 0,
        });
        return;
      }
      job = await updateJob(job, { state: "running", progress: 5 });
      const captured = [];
      const manifest =
        job.payload.evidence ||
        evidenceAssets(job.payload.draft, await assets(job.projectId)).map(
          (a) => ({ id: a.id, hash: a.hash }),
        );
      for (const ref of manifest) {
        const source = await getAsset(ref.id);
        if (source.metadata.privacyPending || source.metadata.supersededBy)
          throw Error(
            "The source was excluded for privacy. Use a safe copy in a new proposal.",
          );
        if (source.projectId !== job.projectId || source.hash !== ref.hash)
          throw new Error("Source evidence changed. Create a new proposal.");
        if ((await getJob(job.id)).cancelRequested) {
          await updateJob(job, {
            state: "cancelled",
            reservedCents: 0,
            leaseUntil: 0,
          });
          return;
        }
        if (source.kind === "video" && !analysisCurrent(source)) {
          await analyzeAsset(source);
          await updateJob(job, {
            state: "running",
            progress: Math.min(18, job.progress + 1),
            leaseUntil: 0,
          });
          return;
        }
        captured.push(source);
      }
      job = await updateJob(job, { state: "submitting", progress: 20 });
      const selectedEvidence = rankCaptures(job.payload.draft, captured, 12);
      const result = await planStoryboard(
        owner,
        storyboardPrompt(job.payload.draft, selectedEvidence) +
          (job.payload.scopeShotId
            ? `\nOVERRIDE: return four alternative versions of this ONE scene, not four consecutive scenes. Scene: ${JSON.stringify(job.payload.draft.shots.find((s: { id: string }) => s.id === job.payload.scopeShotId))}. Requested change: ${job.payload.instruction || "Improve clarity"}. Each alternative must independently show the same scene with an improved edit. Do not add an opening or endcard unless this scene already has that role.`
            : ""),
        selectedEvidence,
        job.payload.provider || "gemini",
        job.payload.model,
      );
      let proposed;
      try {
        proposed = applyPlan(job.payload.draft, captured, result);
      } catch {
        throw new ProviderError(
          "The planner returned an invalid proposal. Your film is unchanged.",
          true,
          true,
        );
      }
      job = await updateJob(job, {
        state: "running",
        payload: { ...job.payload, result: proposed },
        chargedCents: job.reservedCents,
        reservedCents: 0,
      });
      await updateJob(job, {
        state: "completed",
        progress: 100,
        leaseUntil: 0,
      });
      await event(job.projectId, "plan.ready", { jobId: job.id });
    } else if (job.kind === "music" || job.kind === "sound") {
      const kind = job.kind;
      job = await updateJob(job, { state: "submitting", progress: 20 });
      const buffer = await generateSound(
        owner,
        kind,
        job.payload.prompt,
        job.payload.seconds,
      );
      const asset = await importMedia(
        job.projectId,
        buffer,
        `${job.kind}-${job.id.slice(0, 8)}.mp3`,
        { state: job.kind, title: job.payload.prompt },
      );
      await updateJob(job, {
        state: "completed",
        progress: 100,
        outputAssetId: asset.id,
        chargedCents: job.reservedCents,
        reservedCents: 0,
        leaseUntil: 0,
      });
    } else if (job.kind === "narrate") {
      job = await updateJob(job, { state: "submitting", progress: 20 });
      const timed = job.payload.timed
        ? await timedSpeech(
            owner,
            job.payload.text,
            job.payload.voiceId,
            job.payload.pronunciationDictionaries || [],
          )
        : null;
      const buffer =
        timed?.buffer ||
        (await synthesize(owner, job.payload.text, job.payload.voiceId));
      const asset = await importMedia(
        job.projectId,
        buffer,
        `${job.payload.shotTitle}-narration.mp3`,
        { state: "narration" },
      );
      await updateJob(job, {
        state: "completed",
        error: null,
        progress: 100,
        outputAssetId: asset.id,
        payload: { ...job.payload, speechCues: timed?.cues || [] },
        chargedCents: job.reservedCents,
        reservedCents: 0,
        leaseUntil: 0,
      });
    } else {
      job = await updateJob(job, { state: "running", progress: 3 });
      const asset = await renderFilm(job);
      await updateJob(job, {
        state: "completed",
        error: null,
        progress: 100,
        outputAssetId: asset.id,
        leaseUntil: 0,
      });
    }
  } catch (e: any) {
    const fresh = await getJob(job.id);
    const uncertain =
      fresh.state === "submitting" &&
      !(e instanceof ProviderError && e.definitive);
    const retryable =
      fresh.kind === "generate" &&
      !!fresh.providerTaskId &&
      !(e instanceof ProviderError && e.definitive) &&
      !fresh.cancelRequested;
    if (retryable && Number(fresh.payload.retries || 0) < 5)
      await updateJob(fresh, {
        state: "running",
        payload: {
          ...fresh.payload,
          retries: Number(fresh.payload.retries || 0) + 1,
        },
        error:
          "Connection interrupted. Checking the existing provider task again.",
        leaseUntil: Date.now() + 30000,
      });
    else
      await updateJob(fresh, {
        state: uncertain
          ? "unknown"
          : fresh.cancelRequested
            ? "cancelled"
            : "failed",
        error: uncertain
          ? "The provider submission could not be confirmed. Check the provider dashboard before creating another request."
          : String(e.message || "The job failed.").slice(0, 500),
        reservedCents: uncertain ? fresh.reservedCents : 0,
        chargedCents:
          e instanceof ProviderError && e.billable
            ? fresh.chargedCents + fresh.reservedCents
            : fresh.chargedCents,
        leaseUntil: 0,
      });
  } finally {
    clearInterval(heartbeat);
  }
}
