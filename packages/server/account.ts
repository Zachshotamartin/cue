import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  authConfiguration,
  currentUser,
  getAuth,
} from "../../apps/editor/lib/auth-server";
import { deleteAccountData } from "../storage/lifecycle";
import { tx, db } from "../storage/db";
import { lockAccount, rateLimit } from "../storage/client";
import { HttpError } from "../storage/auth";

/** The identity and Cue tables must share the same Supabase database for atomic removal. */
export function assertIdentityDatabase(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.CUE_SHARED_AUTH_READ_ONLY === "1")
    throw new HttpError(
      403,
      "Manage your account on production. Local development cannot delete the shared sign-in account.",
    );
  const auth = new URL(env.SUPABASE_URL || "http://invalid");
  const database = new URL(env.DATABASE_URL || "postgres://invalid");
  const reference = auth.hostname.split(".")[0];
  if (
    !auth.hostname.endsWith(".supabase.co") ||
    !(
      database.hostname === `db.${reference}.supabase.co` ||
      decodeURIComponent(database.username) === `postgres.${reference}`
    )
  )
    throw new HttpError(
      503,
      "Account deletion requires an identity database configured for this environment.",
    );
}
export async function removeAccount(owner: string, raw: unknown) {
  assertIdentityDatabase();
  if (!(await rateLimit(`account-delete:${owner}`, 4, 3600000)))
    throw new HttpError(429, "Wait before trying account deletion again.");
  const input = z
    .object({ email: z.string().email(), password: z.string().min(1).max(128) })
    .parse(raw);
  const user = await currentUser();
  if (!user || user.id !== owner || user.email !== input.email)
    throw new HttpError(400, "Type your account email exactly.");
  const config = authConfiguration();
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword(input);
  if (error || data.user?.id !== owner)
    throw new HttpError(403, "The password was not accepted.");
  try {
    await tx(async () => {
      await lockAccount(owner);
      await deleteAccountData(owner);
      const identity = await db
        .prepare("SELECT id FROM auth.users WHERE id=? FOR UPDATE")
        .get(owner);
      if (!identity)
        throw Error("Account identity was not found. No data was removed.");
      await db.prepare("DELETE FROM auth.users WHERE id=?").run(owner);
    });
  } finally {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
  }
  await (await getAuth()).auth.signOut({ scope: "local" });
  return { removed: true };
}
