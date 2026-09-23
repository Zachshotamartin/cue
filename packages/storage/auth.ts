import { randomBytes } from "node:crypto";
import { db, project, tx } from "./db";
import { hash } from "./media";
import { origin, safeEqual, sessionSecret } from "./config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requestOrigin(req: Request) {
  return req.headers.get("origin") || "";
}
export function isExtension(value: string) {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(value);
}
export function assertHost(req: Request) {
  const h = req.headers.get("host") || new URL(req.url).host;
  if (h !== new URL(origin).host)
    throw new HttpError(
      403,
      "This private installation only accepts its configured host.",
    );
}
export function assertOwner(req: Request) {
  assertHost(req);
  const cookie =
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("cue_session="))
      ?.slice(12) || "";
  const bearer =
    req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!safeEqual(cookie, sessionSecret) && !safeEqual(bearer, sessionSecret))
    throw new HttpError(401, "Open Cue on this computer to start a session.");
  if (!["GET", "HEAD"].includes(req.method) && requestOrigin(req) !== origin)
    throw new HttpError(403, "Request origin is not allowed.");
  return "local";
}
export function createPairing(id: string) {
  project(id);
  const code = randomBytes(6).toString("hex").toUpperCase();
  db.prepare("DELETE FROM pairing WHERE projectId=? OR expiresAt<?").run(
    id,
    Date.now(),
  );
  db.prepare("INSERT INTO pairing VALUES(?,?,?)").run(
    code,
    id,
    Date.now() + 10 * 60 * 1000,
  );
  return { code, expiresIn: 600, origin };
}
export function exchangePairing(code: string) {
  return tx(() => {
    const r: any = db
      .prepare("SELECT * FROM pairing WHERE code=? AND expiresAt>?")
      .get(code.toUpperCase().replaceAll(" ", ""), Date.now());
    if (!r) throw new HttpError(403, "Pairing code expired or is incorrect.");
    db.prepare("DELETE FROM pairing WHERE code=?").run(r.code);
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO capture_tokens VALUES(?,?,?)").run(
      hash(token),
      r.projectId,
      Date.now() + 24 * 60 * 60 * 1000,
    );
    return {
      token,
      projectId: r.projectId,
      title: project(r.projectId).draft.title,
      expiresIn: 86400,
    };
  });
}
export function assertCapture(req: Request, projectId: string) {
  assertHost(req);
  const o = requestOrigin(req);
  if (o === origin) return assertOwner(req);
  if (!isExtension(o))
    throw new HttpError(403, "Capture must come from your paired extension.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const row: any = db
    .prepare(
      "SELECT projectId FROM capture_tokens WHERE tokenHash=? AND expiresAt>?",
    )
    .get(hash(token), Date.now());
  if (row?.projectId !== projectId)
    throw new HttpError(
      403,
      "Pair the extension again to capture into this project.",
    );
}
