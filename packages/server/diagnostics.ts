import { db, projectStorage, accountJobs } from "../storage/db";
export async function accountReadiness(owner: string) {
  await db.prepare("SELECT 1 AS ready").get();
  const jobs = await accountJobs(owner),
    active = jobs.filter(
      (j) => !["completed", "failed", "cancelled", "unknown"].includes(j.state),
    );
  return {
    ok: true,
    database: "ready",
    dataEnvironment:
      process.env.CUE_DATA_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      "development",
    storage: process.env.CUE_STORAGE === "local" ? "local" : "private-cloud",
    email:
      process.env.CUE_PUBLIC_SIGNUP === "1"
        ? "configured-by-operator"
        : "not-verified",
    queue: {
      active: active.length,
      oldestSeconds: active.length
        ? Math.round(
            Math.max(
              ...active.map((j) => Date.now() - Date.parse(j.createdAt)),
            ) / 1000,
          )
        : 0,
      needsReconciliation: jobs.filter((j) => j.state === "unknown").length,
    },
    storageBytes: await projectStorage(owner),
    release:
      process.env.CUE_RENDER_REF ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local-working-tree",
  };
}
