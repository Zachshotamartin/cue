import type { Job } from "../contracts";
import { getJob, updateJob } from "../storage/db";
// The Workflow implementation is loaded only by the deployed app, not the local CLI worker.
export async function dispatchJob(id: string) {
  if (!process.env.VERCEL) return;
  const { start, getRun } = await import("workflow/api");
  const { processJob } = await import("../../apps/editor/workflows/job");
  const job = await getJob(id);
  if (["completed", "failed", "cancelled", "unknown"].includes(job.state))
    return;
  try {
    if (job.workflowId) {
      try {
        const state = await getRun(job.workflowId).status;
        if (state === "running" || state === "pending") return;
      } catch {}
    }
    const run = await start(processJob, [id]);
    await updateJob(job, {
      workflowId: run.runId,
    });
  } catch {
    await updateJob(job, {
      error: "Saved in the queue. Background dispatch will retry.",
    });
  }
}
