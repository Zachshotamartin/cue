import { claimJob, db } from "../../packages/storage/db";
import { runJob } from "./runner";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log("Cue worker ready. Waiting for project jobs.");
while (!stopping) {
  const job = await claimJob();
  if (job) await runJob(job);
  else await new Promise((r) => setTimeout(r, 1200));
}
await db.close();
console.log("Cue worker stopped after saving its current job.");
