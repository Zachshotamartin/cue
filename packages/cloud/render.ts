import { Sandbox } from "@vercel/sandbox";
import { getJob, updateJob } from "../storage/db";
import { origin } from "../storage/config";
import { workerToken } from "./worker-token";
import type { Job } from "../contracts";
export async function advanceRender(job: Job) {
  let sandbox: Sandbox | undefined;
  try {
    if (job.sandboxId) {
      sandbox = await Sandbox.get({ name: job.sandboxId, resume: false });
      if (job.cancelRequested) {
        await sandbox.stop();
        await updateJob(job, { state: "cancelled", leaseUntil: 0 });
        return;
      }
      if (Date.now() - Date.parse(job.createdAt) > 1800000)
        throw new Error("Render exceeded its 30-minute time limit.");
      if (sandbox.status !== "running")
        throw new Error("Render compute is no longer running.");
      if (!job.commandId) {
        await startRenderer(sandbox, job);
        return;
      }
      if (job.commandId) {
        const command = await sandbox.getCommand(job.commandId);
        if (command.exitCode === 0) {
          const fresh = await getJob(job.id);
          if (fresh.outputAssetId) {
            await updateJob(fresh, {
              state: "completed",
              progress: 100,
              error: null,
              leaseUntil: 0,
            });
            await sandbox.stop();
            return;
          }
          throw new Error("Renderer exited without a saved export.");
        }
        if (command.exitCode !== null && command.exitCode !== 0)
          throw new Error(
            "Render compute stopped before producing an export. Your sources and edits are saved.",
          );
      }
      await updateJob(job, { leaseUntil: Date.now() + 10000 });
      return;
    }
    const ref = process.env.CUE_RENDER_REF || process.env.VERCEL_GIT_COMMIT_SHA;
    if (!ref) throw new Error("Rendering is not configured for this release.");
    sandbox = await Sandbox.getOrCreate({
      name: `cue-${job.id}`,
      runtime: "node24",
      source: {
        type: "git",
        url: "https://github.com/Zachshotamartin/cue.git",
        revision: ref,
      },
      resources: { vcpus: 4 },
      timeout: 1800000,
    });
    job = await updateJob(job, {
      state: "running",
      sandboxId: sandbox.name,
      progress: 5,
    });
    await startRenderer(sandbox, job);
  } catch (e: any) {
    await sandbox?.stop().catch(() => {});
    const fresh = await getJob(job.id);
    if (fresh.state !== "completed")
      await updateJob(fresh, {
        state: fresh.outputAssetId ? "completed" : "failed",
        progress: fresh.outputAssetId ? 100 : fresh.progress,
        leaseUntil: 0,
        error: fresh.outputAssetId
          ? null
          : "Unable to finish cloud rendering. Your project and any completed exports are saved. Retry the export from your library.",
      });
    console.error("render.failed", {
      jobId: job.id,
      kind: e?.constructor?.name,
    });
  }
}
export async function stopRender(id: string) {
  const j = await getJob(id);
  if (j.sandboxId) {
    const sandbox = await Sandbox.get({ name: j.sandboxId, resume: false });
    if (sandbox.status === "running") await sandbox.stop();
  }
}

async function startRenderer(sandbox: Sandbox, job: Job) {
  const token = workerToken(job.id);
  const command = await sandbox.runCommand({
    cmd: "bash",
    args: ["scripts/sandbox-bootstrap.sh"],
    env: {
      CUE_JOB_URL: `${origin}/api/worker/jobs/${job.id}`,
      CUE_WORKER_TOKEN: token,
    },
    detached: true,
  });
  await updateJob(job, {
    commandId: command.cmdId,
    leaseUntil: Date.now() + 15000,
  });
}
