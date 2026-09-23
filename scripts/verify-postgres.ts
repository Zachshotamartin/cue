import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  initializeDatabase,
  db,
  tx,
  rateLimit,
} from "../packages/storage/client";
import {
  createProject,
  project,
  editProject,
  enqueue,
  claimSpecificJob,
  budget,
  updateJob,
  getJob,
  addAsset,
  snapshot,
} from "../packages/storage/db";
if (process.env.CUE_VERIFY_DATABASE !== "1" || !process.env.DATABASE_URL)
  throw new Error(
    "Set CUE_VERIFY_DATABASE=1 and a dedicated test DATABASE_URL.",
  );
const owner = `verify-${randomUUID()}`;
let id: string | undefined;
try {
  await initializeDatabase();
  const p = await createProject("SQL verification", "", owner);
  id = p.id;
  const edits = await Promise.allSettled([
    editProject(id, 1, { ...p.draft, title: "A" }),
    editProject(id, 1, { ...p.draft, title: "B" }),
  ]);
  assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await project(id, owner)).revision, 2);
  await assert.rejects(project(id, "another-owner"), /not found/);
  const key = randomUUID();
  const result = await Promise.all([
    enqueue(id, "plan", {}, key, 25),
    enqueue(id, "plan", {}, key, 25),
  ]);
  assert.equal(result[0].id, result[1].id);
  assert.equal((await budget(id)).reserved, 25);
  const claims = await Promise.all([
    claimSpecificJob(result[0].id),
    claimSpecificJob(result[0].id),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  await updateJob(result[0], { providerTaskId: "test-task", state: "running" });
  assert.equal((await getJob(result[0].id)).providerTaskId, "test-task");
  const rateKey = `verify:${owner}`;
  const limits = await Promise.all(
    Array.from({ length: 8 }, () => rateLimit(rateKey, 3, 60000)),
  );
  assert.equal(limits.filter(Boolean).length, 3);
  const snap = await snapshot(id);
  assert.equal(snap.revisions.length, 2);
  assert.equal(snap.jobs.length, 1);
  await db.prepare("DELETE FROM request_limits WHERE key=?").run(rateKey);
  console.log(
    "Postgres: migrations, owner isolation, concurrent revisions, budget/idempotency, exclusive claims, rate limits and snapshots passed.",
  );
} finally {
  if (id)
    await db
      .prepare("DELETE FROM projects WHERE id=? AND owner=?")
      .run(id, owner);
  await db.close();
}
