import { db } from "../storage/db";
import { deleteObject } from "../storage/objects";
/** Delete only known temporary upload chunks; project assets are never retention candidates. */
export async function cleanupTemporaryObjects() {
  const rows = await db
    .prepare("SELECT * FROM uploads WHERE createdAt<? LIMIT 25")
    .all(Date.now() - 86400000);
  let count = 0;
  for (const r of rows) {
    const state = JSON.parse(r.data);
    try {
      for (let i = 0; i < state.chunks; i++)
        await deleteObject(`uploads/${r.projectId}/${r.id}/${i}.part`);
      await db.prepare("DELETE FROM uploads WHERE id=?").run(r.id);
      count++;
    } catch {
      /* Retain metadata and retry next sweep if object storage is temporarily unavailable. */
    }
  }
  return count;
}
