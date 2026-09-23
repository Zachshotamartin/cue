/** Explicit one-way import. Never removes or updates the original local database. */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { initializeDatabase, db, tx } from "../packages/storage/client";
import { writeObject } from "../packages/storage/objects";
import { root } from "../packages/storage/config";
const email = process.argv[2],
  source = process.argv[3] || path.join(root, ".data");
if (!process.env.DATABASE_URL || !email)
  throw new Error(
    "Usage: npm run import:local -- VERIFIED_ACCOUNT_EMAIL [local-data-directory]. Configure the target database first.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  'SELECT id,email,"emailVerified" FROM neon_auth."user" WHERE lower(email)=lower($1)',
  [email],
);
await pool.end();
const user = rows[0];
if (!user?.emailVerified)
  throw new Error(
    "Create and verify your Cue account before importing local projects.",
  );
const local = new DatabaseSync(path.join(source, "cue.sqlite"), {
  readOnly: true,
});
await initializeDatabase();
let imported = 0,
  skipped = 0;
for (const p of local.prepare("SELECT * FROM projects").all() as any[]) {
  const existing = await db
    .prepare("SELECT owner FROM projects WHERE id=?")
    .get(p.id);
  if (existing) {
    if (existing.owner !== user.id)
      throw new Error(
        "An existing project belongs to another account. Import stopped.",
      );
    skipped++;
    continue;
  }
  const files = local
    .prepare("SELECT data FROM assets WHERE projectId=?")
    .all(p.id) as any[];
  const migrated: import("../packages/contracts").Asset[] = [];
  for (const row of files) {
    const a = JSON.parse(row.data),
      bytes = await fs.readFile(path.join(source, "assets", a.path));
    const objectPath = `projects/${p.id}/assets/${a.id}${path.extname(a.path)}`;
    await writeObject(objectPath, bytes, a.mime, true);
    migrated.push({ ...a, path: objectPath });
  }
  await tx(async () => {
    await db
      .prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)")
      .run(p.id, user.id, p.revision, p.draft, p.createdAt, p.updatedAt);
    for (const r of local
      .prepare("SELECT * FROM revisions WHERE projectId=?")
      .all(p.id) as any[])
      await db
        .prepare("INSERT INTO revisions VALUES(?,?,?,?,?)")
        .run(p.id, r.revision, r.draft, r.label, r.createdAt);
    for (const a of migrated)
      await db
        .prepare("INSERT INTO assets VALUES(?,?,?)")
        .run(a.id, p.id, JSON.stringify(a));
    for (const r of local
      .prepare("SELECT * FROM jobs WHERE projectId=?")
      .all(p.id) as any[]) {
      const job = JSON.parse(r.data);
      job.leaseUntil = 0;
      delete job.workflowId;
      delete job.sandboxId;
      delete job.commandId;
      if (
        !["completed", "failed", "cancelled", "unknown"].includes(job.state)
      ) {
        job.state = "unknown";
        job.error =
          "Imported an unfinished local job. Review provider history before retrying. No paid request was replayed by the import.";
      }
      await db
        .prepare("INSERT INTO jobs VALUES(?,?,?,?,?,?)")
        .run(job.id, p.id, job.state, 0, JSON.stringify(job), r.idem);
    }
    for (const r of local
      .prepare("SELECT * FROM takes WHERE projectId=?")
      .all(p.id) as any[])
      await db
        .prepare("INSERT INTO takes VALUES(?,?,?)")
        .run(r.id, p.id, r.data);
  });
  imported++;
}
local.close();
await db.close();
console.log(
  JSON.stringify({
    imported,
    skipped,
    credentials:
      "Not imported. Add your provider keys through your verified Cue account.",
    originalData: "Preserved unchanged.",
  }),
);
