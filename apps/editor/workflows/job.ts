import { sleep } from "workflow";
export async function processJob(id: string) {
  "use workflow";
  for (let i = 0; i < 360; i++) {
    if (await advance(id)) return;
    await sleep("15s");
  }
  await expire(id);
}
async function advance(id: string) {
  "use step";
  const { getJob, claimSpecificJob } =
    await import("../../../packages/storage/db");
  const current = await getJob(id);
  if (["completed", "failed", "cancelled", "unknown"].includes(current.state)) {
    if (current.sandboxId) {
      const { stopRender } = await import("../../../packages/cloud/render");
      await stopRender(id);
    }
    return true;
  }
  const job = await claimSpecificJob(id);
  if (!job) return false;
  if (job.kind === "render") {
    const { advanceRender } = await import("../../../packages/cloud/render");
    await advanceRender(job);
  } else {
    const { runJob } = await import("../../worker/runner");
    await runJob(job);
  }
  return false;
}
async function expire(id: string) {
  "use step";
  const { getJob, updateJob } = await import("../../../packages/storage/db");
  const job = await getJob(id);
  if (!["completed", "failed", "cancelled", "unknown"].includes(job.state))
    await updateJob(job, {
      state: job.state === "submitting" ? "unknown" : "failed",
      error:
        "The job exceeded its time limit. Saved provider task and outputs remain available for reconciliation.",
      leaseUntil: 0,
    });
  if (job.sandboxId) {
    const { stopRender } = await import("../../../packages/cloud/render");
    await stopRender(id);
  }
}
