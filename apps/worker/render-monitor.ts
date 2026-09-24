import { getJob, updateJob } from "../../packages/storage/db";
import type { Job } from "../../packages/contracts";

/** Remotion does not await progress callbacks. Coalesce them into one DB write. */
export function createRenderMonitor(
  job: Pick<Job, "id" | "progress">,
  cancel: () => void,
) {
  let progress = job.progress;
  let pending: Promise<void> | undefined;
  let failure: unknown;
  const timer = setInterval(() => {
    if (pending || failure) return;
    pending = (async () => {
      const current = await getJob(job.id);
      if (current.cancelRequested) {
        cancel();
        return;
      }
      if (progress > current.progress)
        await updateJob(current, {
          progress,
          leaseUntil: Date.now() + 60000,
        });
    })()
      .catch((error) => {
        failure = error;
        cancel();
      })
      .finally(() => {
        pending = undefined;
      });
  }, 1000);
  return {
    onProgress(value: { progress: number }) {
      progress = Math.max(progress, Math.round(value.progress * 90));
    },
    async stop() {
      clearInterval(timer);
      await pending;
      if (failure) throw failure;
    },
  };
}
