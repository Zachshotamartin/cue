import crypto from "node:crypto";
import { db, now } from "./db";
import { localSecret } from "./config";
import { providerSchema, type Provider } from "../contracts";
const envKeys: Record<Provider, string> = {
  runway: "RUNWAYML_API_SECRET",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
};
function master() {
  const hex =
    process.env.CUE_MASTER_KEY ||
    (process.env.NODE_ENV === "test" ? localSecret("encryption.key") : "");
  if (!/^[a-f0-9]{64}$/i.test(hex))
    throw new Error("CUE_MASTER_KEY must be 32 bytes encoded as hex.");
  return Buffer.from(hex, "hex");
}
export function encryptCredential(
  owner: string,
  provider: Provider,
  key: string,
) {
  const nonce = crypto.randomBytes(12),
    c = crypto.createCipheriv("aes-256-gcm", master(), nonce);
  c.setAAD(Buffer.from(`${owner}:${provider}:v1`));
  const ciphertext = Buffer.concat([c.update(key, "utf8"), c.final()]);
  return JSON.stringify({
    version: 1,
    nonce: nonce.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64"),
  });
}
export function decryptCredential(
  owner: string,
  provider: Provider,
  encrypted: string,
) {
  const x = JSON.parse(encrypted);
  if (x.version !== 1) throw new Error("Unsupported credential version.");
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    master(),
    Buffer.from(x.nonce, "base64"),
  );
  d.setAAD(Buffer.from(`${owner}:${provider}:v1`));
  d.setAuthTag(Buffer.from(x.tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(x.data, "base64")),
    d.final(),
  ]).toString("utf8");
}
export async function putCredential(
  owner: string,
  provider: Provider,
  key: string,
) {
  await db
    .prepare(
      "INSERT INTO credentials VALUES(?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET encrypted=excluded.encrypted,suffix=excluded.suffix,updatedAt=excluded.updatedAt",
    )
    .run(
      owner,
      provider,
      encryptCredential(owner, provider, key),
      key.slice(-4),
      now(),
    );
}
export async function removeCredential(owner: string, provider: Provider) {
  await db
    .prepare("DELETE FROM credentials WHERE owner=? AND provider=?")
    .run(owner, provider);
}
export async function credential(owner: string, provider: Provider) {
  const row: any = await db
    .prepare("SELECT encrypted FROM credentials WHERE owner=? AND provider=?")
    .get(owner, provider);
  if (row) return decryptCredential(owner, provider, row.encrypted);
  if (
    process.env.CUE_ALLOW_LOCAL_PROVIDER_KEYS === "1" &&
    owner === "local" &&
    process.env[envKeys[provider]]
  )
    return process.env[envKeys[provider]]!;
  throw new Error(
    `Configure your ${provider} API key in Settings before continuing.`,
  );
}
export async function credentialStatus(owner = "local") {
  return Promise.all(
    providerSchema.options.map(async (provider) => {
      const row: any = await db
        .prepare(
          "SELECT suffix,updatedAt FROM credentials WHERE owner=? AND provider=?",
        )
        .get(owner, provider);
      return {
        provider,
        configured:
          !!row ||
          (process.env.CUE_ALLOW_LOCAL_PROVIDER_KEYS === "1" &&
            owner === "local" &&
            !!process.env[envKeys[provider]]),
        suffix: row?.suffix || null,
        source: row
          ? "encrypted"
          : process.env.CUE_ALLOW_LOCAL_PROVIDER_KEYS === "1" &&
              owner === "local" &&
              process.env[envKeys[provider]]
            ? "environment"
            : null,
      };
    }),
  );
}
