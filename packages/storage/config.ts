import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
function findRoot() {
  let at = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      if (
        JSON.parse(fs.readFileSync(path.join(at, "package.json"), "utf8"))
          .name === "cue"
      )
        return at;
    } catch {}
    const parent = path.dirname(at);
    if (parent === at) break;
    at = parent;
  }
  return process.cwd();
}
export const root = process.env.CUE_ROOT || findRoot();
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  for (const name of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(/* turbopackIgnore: true */ root, name));
    } catch {}
  }
}
export const cloud = !!process.env.DATABASE_URL;
export const dataDir = process.env.VERCEL
  ? "/tmp/cue"
  : path.resolve(root, process.env.CUE_DATA_DIR || ".data");
export const origin =
  process.env.CUE_ORIGIN ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://127.0.0.1:5303");
export const port = Number(process.env.CUE_PORT || 5303);
export function localSecret(name: string, bytes = 32) {
  if (process.env.VERCEL)
    throw new Error("Local secrets are disabled in production.");
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(/* turbopackIgnore: true */ dataDir, name);
  try {
    fs.writeFileSync(file, crypto.randomBytes(bytes).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e: any) {
    if (e.code !== "EEXIST") throw e;
  }
  return fs.readFileSync(/* turbopackIgnore: true */ file, "utf8").trim();
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function signingKey() {
  if (process.env.CUE_SIGNING_SECRET) return process.env.CUE_SIGNING_SECRET;
  if (process.env.NODE_ENV === "test" || process.env.CUE_LOCAL_DATABASE === "1")
    return localSecret("session.key");
  throw new Error("CUE_SIGNING_SECRET is required.");
}
export function assetSignature(
  id: string,
  expires = Math.floor(Date.now() / 1000) + 3600,
) {
  const mac = crypto
    .createHmac("sha256", signingKey())
    .update(`asset:${id}:${expires}`)
    .digest("hex");
  return `${expires}.${mac}`;
}
export function validAssetSignature(id: string, signature: string) {
  const [until] = signature.split(".");
  const n = Number(until);
  return (
    Number.isSafeInteger(n) &&
    n >= Date.now() / 1000 &&
    n <= Date.now() / 1000 + 7200 &&
    safeEqual(signature, assetSignature(id, n))
  );
}
