import { randomUUID } from "node:crypto";
import {
  claimJob,
  getJob,
  updateJob,
  assets,
  project,
  editProject,
  getAsset,
  addTake,
  now,
  db,
  event,
} from "../../packages/storage/db";
import {
  applyPlan,
  storyboardPrompt,
  evidenceAssets,
} from "../../packages/director";
import {
  cancelVideo,
  downloadOutput,
  planStoryboard,
  pollVideo,
  ProviderError,
  submitVideo,
  synthesize,
} from "../../packages/providers";
import { importMedia } from "../../packages/storage/media";
import { renderFilm } from "./render";
import type { Job } from "../../packages/contracts";

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
    if (job.kind === "generate") {
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
      job = await updateJob(job, { state: "submitting", progress: 20 });
      const captured = evidenceAssets(
        job.payload.draft,
        await assets(job.projectId),
      );
      const result = await planStoryboard(
        owner,
        storyboardPrompt(job.payload.draft, captured),
        captured,
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
    } else if (job.kind === "narrate") {
      job = await updateJob(job, { state: "submitting", progress: 20 });
      const buffer = await synthesize(
        owner,
        job.payload.text,
        job.payload.voiceId,
      );
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
        state: fresh.cancelRequested
          ? "cancelled"
          : uncertain
            ? "unknown"
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
