import { it, expect, afterAll } from "vitest";
import fs from "node:fs/promises";
import {
  db,
  createProject,
  enqueue,
  updateJob,
  claimJob,
  claimSpecificJob,
} from "../packages/storage/db";
import { dataDir } from "../packages/storage/config";
afterAll(async () => {
  await db.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});
it("limits active work while allowing another account to advance and keeping oldest-first order", async () => {
  const a = await createProject("A", "", "a"),
    b = await createProject("B", "", "b");
  const one = await enqueue(a.id, "analyze", {}, "one"),
    two = await enqueue(a.id, "analyze", {}, "two"),
    three = await enqueue(a.id, "analyze", {}, "three"),
    four = await enqueue(b.id, "analyze", {}, "four");
  for (const [i, j] of [one, two, three, four].entries())
    await updateJob(j, { createdAt: new Date(i * 1000).toISOString() });
  expect((await claimJob())?.id).toBe(one.id);
  expect((await claimJob())?.id).toBe(four.id); // The unrepresented account gets its turn.
  expect((await claimJob())?.id).toBe(two.id);
  expect(await claimSpecificJob(three.id)).toBeNull();
  await updateJob(one, { state: "completed", leaseUntil: 0 });
  expect((await claimSpecificJob(three.id))?.id).toBe(three.id);
  for (const j of [two, three, four])
    await updateJob(j, { state: "completed", leaseUntil: 0 });
});
it("never resubmits a paid call interrupted before its task ID was saved", async () => {
  const p = await createProject("Uncertain", "", "uncertain"),
    j = await enqueue(p.id, "narrate", {}, "uncertain");
  await updateJob(j, { state: "submitting", leaseUntil: 0 });
  expect(await claimSpecificJob(j.id)).toBeNull();
  expect(
    JSON.parse(
      (await db.prepare("SELECT data FROM jobs WHERE id=?").get(j.id)).data,
    ).state,
  ).toBe("unknown");
});

it("reserves across projects under the same daily account allowance", async () => {
  const old = process.env.CUE_ACCOUNT_DAILY_CENTS;
  process.env.CUE_ACCOUNT_DAILY_CENTS = "40";
  try {
    const a = await createProject("First", "", "daily-owner"),
      b = await createProject("Second", "", "daily-owner");
    await enqueue(a.id, "plan", {}, "first", 25);
    await expect(enqueue(b.id, "plan", {}, "second", 25)).rejects.toThrow(
      "daily estimated",
    );
  } finally {
    if (old === undefined) delete process.env.CUE_ACCOUNT_DAILY_CENTS;
    else process.env.CUE_ACCOUNT_DAILY_CENTS = old;
  }
});
