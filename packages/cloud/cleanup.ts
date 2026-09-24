import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../storage/config";
import { cloudObjects } from "../storage/objects";
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
  const garbage = await db
    .prepare("SELECT * FROM garbage ORDER BY created_at LIMIT 50")
    .all();
  const referenced = new Set<string>();
  for (const row of await db.prepare("SELECT data FROM assets").all()) {
    const asset = JSON.parse(row.data);
    referenced.add(asset.path);
    for (const f of asset.metadata.analysis?.frames || [])
      referenced.add(f.path);
  }
  for (const row of garbage) {
    if (referenced.has(row.object_path)) continue;
    try {
      if (row.kind === "asset" && !cloudObjects())
        await fs
          .unlink(path.join(dataDir, "assets", row.object_path))
          .catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
      else await deleteObject(row.object_path);
      await db
        .prepare("DELETE FROM garbage WHERE object_path=?")
        .run(row.object_path);
      count++;
    } catch {
      /* Retry deletion on the next sweep. */
    }
  }
  return count;
}
