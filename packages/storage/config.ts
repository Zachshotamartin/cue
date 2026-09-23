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
  throw new Error("Run Cue from its project directory or set CUE_ROOT.");
}
export const root = process.env.CUE_ROOT || findRoot();
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {}
export const dataDir = path.resolve(root, process.env.CUE_DATA_DIR || ".data");
export const origin = process.env.CUE_ORIGIN || "http://127.0.0.1:5303";
export const port = Number(process.env.CUE_PORT || 5303);
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(path.join(dataDir, "assets"), { recursive: true });
export function localSecret(name: string, bytes = 32) {
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
export const sessionSecret = localSecret("session.key");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function assetSignature(id: string) {
  return crypto
    .createHmac("sha256", sessionSecret)
    .update(`asset:${id}`)
    .digest("hex");
}
