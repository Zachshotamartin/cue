import { accountReadiness } from "./diagnostics";
import { z } from "zod";
import { json, body } from "./http";
import { removeAccount } from "./account";
import { deleteUnusedAsset } from "../storage/lifecycle";
import { verifyConnection } from "../providers/connections";
import { listVoices } from "../providers/audio";
import { assertOwner, HttpError } from "../storage/auth";
import { rateLimit } from "../storage/client";
import { db, getAsset, project, updateAssetMetadata } from "../storage/db";
import {
  credentialStatus,
  putCredential,
  removeCredential,
} from "../storage/credentials";
import { providerSchema } from "../contracts";
import { origin } from "../storage/config";
export async function settingsRoutes(
  req: Request,
  p: string[],
  owner: string,
): Promise<Response | null> {
  const method = req.method;
  if (p[0] === "assets" && p[1] && p[2] === "rights" && method === "PATCH") {
    const asset = await getAsset(p[1]);
    await project(asset.projectId, owner);
    const rights = z
      .object({
        credit: z.string().max(500),
        license: z.string().max(500),
        sourceUrl: z.union([
          z.literal(""),
          z
            .string()
            .url()
            .max(2048)
            .refine((v) => /^https?:\/\//.test(v)),
        ]),
      })
      .parse(await body(req));
    await updateAssetMetadata(asset.id, { rights });
    return json({ ok: true });
  }
  if (p[0] === "account" && method === "DELETE")
    return json(await removeAccount(owner, await body(req)));
  if (p[0] === "assets" && p[1] && method === "DELETE")
    return json(await deleteUnusedAsset(p[1], owner));
  if (p[0] === "settings" && p[1] === "verify" && method === "POST") {
    await assertOwner(req, true);
    if (!(await rateLimit(`verify:${owner}`, 10, 60000)))
      throw new HttpError(429, "Wait before checking another connection.");
    const { provider } = z
      .object({ provider: providerSchema })
      .parse(await body(req));
    const result = await verifyConnection(owner, provider);
    await db
      .prepare(
        "INSERT INTO credential_checks VALUES(?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at",
      )
      .run(owner, provider, result.status, result.checkedAt);
    return json(result);
  }
  if (p[0] === "health") return json(await accountReadiness(owner));
  if (p[0] === "settings" && p[1] === "voices" && method === "GET") {
    if (!(await rateLimit(`voices:${owner}`, 15, 60000)))
      throw new HttpError(429, "Wait a moment before refreshing voices.");
    return json({ voices: await listVoices(owner) });
  }
  if (p[0] === "settings") {
    if (method === "GET")
      return json({
        providers: await credentialStatus(owner),
        mode: "account",
        accountId: owner,
        voiceId: process.env.ELEVENLABS_VOICE_ID || "",
        origin,
      });
    await assertOwner(req, true);
    const b = z
      .object({
        provider: providerSchema,
        key: z.string().min(12).max(1024).optional(),
      })
      .parse(await body(req));
    await db
      .prepare("DELETE FROM credential_checks WHERE owner=? AND provider=?")
      .run(owner, b.provider);
    if (method === "DELETE") await removeCredential(owner, b.provider);
    else if (method === "PUT" && b.key)
      await putCredential(owner, b.provider, b.key);
    else throw new HttpError(400, "Enter a provider key.");
    return json({ providers: await credentialStatus(owner) });
  }
  return null;
}
