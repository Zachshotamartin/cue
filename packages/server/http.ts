import { readBounded } from "../storage/media";
import { HttpError } from "../storage/auth";
export const json = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { "Cache-Control": "no-store" } });
export async function body(req: Request) {
  const bytes = await readBounded(req.body, 2 * 1024 * 1024);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new HttpError(400, "Request must contain valid JSON.");
  }
}
export function idempotency(req: Request) {
  const k = req.headers.get("idempotency-key");
  if (!k || k.length < 8 || k.length > 120)
    throw new HttpError(400, "An idempotency key is required for this job.");
  return k;
}
export function cleanName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 100) || "download";
}
