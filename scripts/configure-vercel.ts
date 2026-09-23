/** Upload infrastructure secrets over stdin. Never print values or place them in argv. */
import { spawnSync } from "node:child_process";
import { root } from "../packages/storage/config";
const target = process.argv[2] || "production";
if (!["production", "preview"].includes(target))
  throw new Error("Choose production or preview.");
for (const key of [
  "CUE_MASTER_KEY",
  "CUE_SIGNING_SECRET",
  "CRON_SECRET",
  "BLOB_READ_WRITE_TOKEN",
]) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is missing.`);
  const r = spawnSync(
    "npx",
    [
      "--yes",
      "vercel@59.11.2",
      "env",
      "add",
      key,
      target,
      "--sensitive",
      "--yes",
      "--force",
      "--scope",
      "zach-2267",
    ],
    { cwd: root, input: value, encoding: "utf8" },
  );
  if (r.status !== 0)
    throw new Error(
      `Vercel rejected ${key}. Check project access; values were not logged.`,
    );
  console.log(`${key}: configured as sensitive (${target})`);
}
