/** Roll out CUE_MASTER_KEY=new and CUE_MASTER_KEY_PREVIOUS=old first. Never print either key. */
import { db, tx } from "../packages/storage/db";
import { lockAccount } from "../packages/storage/client";
import {
  decryptCredential,
  encryptCredential,
} from "../packages/storage/credentials";
import { providerSchema } from "../packages/contracts";
if (
  process.env.CUE_ROTATE_CREDENTIALS !== "1" ||
  !process.env.CUE_MASTER_KEY_PREVIOUS
)
  throw Error(
    "Configure both encryption keys and set CUE_ROTATE_CREDENTIALS=1 to rotate saved credentials.",
  );
let count = 0;
try {
  const rows = await db.prepare("SELECT owner,provider FROM credentials").all();
  for (const row of rows)
    await tx(async () => {
      await lockAccount(row.owner);
      const current = await db
        .prepare(
          "SELECT encrypted FROM credentials WHERE owner=? AND provider=? FOR UPDATE",
        )
        .get(row.owner, row.provider);
      if (!current) return;
      const provider = providerSchema.parse(row.provider),
        plain = decryptCredential(row.owner, provider, current.encrypted),
        encrypted = encryptCredential(row.owner, provider, plain);
      if (decryptCredential(row.owner, provider, encrypted) !== plain)
        throw Error("Rotation verification failed.");
      await db
        .prepare(
          "UPDATE credentials SET encrypted=? WHERE owner=? AND provider=?",
        )
        .run(encrypted, row.owner, provider);
      count++;
    });
  console.log(
    `Verified and re-encrypted ${count} account connections. Retain the previous key until all app instances use the new key and the database backup has completed.`,
  );
} finally {
  await db.close();
}
