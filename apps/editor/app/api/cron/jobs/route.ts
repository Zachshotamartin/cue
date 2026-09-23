import { cleanupTemporaryObjects } from "../../../../../../packages/cloud/cleanup";
import { db } from "../../../../../../packages/storage/db";
import { dispatchJob } from "../../../../../../packages/cloud/dispatch";
import { safeEqual } from "../../../../../../packages/storage/config";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    !safeEqual(
      req.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return new Response(null, { status: 403 });
  const rows = await db
    .prepare(
      "SELECT id FROM jobs WHERE state IN ('queued','running','submitting','retrieving') AND leaseUntil<? LIMIT 20",
    )
    .all(Date.now());
  for (const row of rows) await dispatchJob(row.id);
  const cleaned = await cleanupTemporaryObjects();
  return Response.json({ checked: rows.length, cleaned });
}
