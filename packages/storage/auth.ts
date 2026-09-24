import { randomBytes, createHash } from "node:crypto";
import { db, project, tx } from "./db";
import { rateLimit } from "./client";
import { origin } from "./config";
import { currentUser } from "../../apps/editor/lib/auth-server";
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
  trustedRequestOrigin(req);
}
export function trustedRequestOrigin(req: Request) {
  const configured = new URL(origin);
  const actual = req.headers.get("host") || new URL(req.url).host;
  // Next may rewrite req.url to localhost behind the development server or proxy.
  // Only configured hosts determine the public origin; forwarded headers cannot.
  if (actual === configured.host) return configured.origin;
  if (process.env.VERCEL_URL && actual === process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;
  throw new HttpError(403, "Request host is not allowed.");
}
export function assertSameOrigin(req: Request) {
  const expected = trustedRequestOrigin(req);
  if (requestOrigin(req) !== expected)
    throw new HttpError(403, "Request origin is not allowed.");
  return expected;
}
export async function sessionUser() {
  if (!process.env.SUPABASE_URL && process.env.NODE_ENV !== "test")
    throw new HttpError(
      503,
      "Account setup is awaiting the database connection. No local access bypass is enabled.",
    );
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to your Cue account.");
  return user;
}
export async function assertOwner(req: Request, verified = false) {
  if (["GET", "HEAD"].includes(req.method)) assertHost(req);
  else assertSameOrigin(req);
  const user = await sessionUser();
  if (verified && !user.emailVerified)
    throw new HttpError(
      403,
      "Verify your email before adding keys or starting a job.",
    );
  return user.id;
}
const digest = (x: string) => createHash("sha256").update(x).digest("hex");
export async function createPairing(id: string, owner: string) {
  await project(id, owner);
  if (!(await rateLimit(`pair:${owner}`, 10, 600000)))
    throw new HttpError(429, "Wait before pairing another extension.");
  const code = randomBytes(6).toString("hex").toUpperCase();
  await db
    .prepare("DELETE FROM pairing WHERE projectId=? OR expiresAt<?")
    .run(id, Date.now());
  await db
    .prepare("INSERT INTO pairing VALUES(?,?,?)")
    .run(digest(code), id, Date.now() + 600000);
  return { code, expiresIn: 600, origin };
}
export async function exchangePairing(code: string, request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!(await rateLimit(`exchange:${digest(ip)}`, 20, 600000)))
    throw new HttpError(429, "Too many pairing attempts. Try again later.");
  return tx(async () => {
    const r = await db
      .prepare("SELECT * FROM pairing WHERE code=? AND expiresAt>? FOR UPDATE")
      .get(digest(code.toUpperCase().replaceAll(" ", "")), Date.now());
    if (!r) throw new HttpError(403, "Pairing code expired or is incorrect.");
    await db.prepare("DELETE FROM pairing WHERE code=?").run(r.code);
    const token = randomBytes(32).toString("hex");
    await db
      .prepare("INSERT INTO capture_tokens VALUES(?,?,?)")
      .run(digest(token), r.projectId, Date.now() + 86400000);
    return {
      token,
      projectId: r.projectId,
      title: (await project(r.projectId)).draft.title,
      journey: (await project(r.projectId)).draft.journey,
      expiresIn: 86400,
    };
  });
}
export async function assertCapture(req: Request, id: string) {
  const expected = trustedRequestOrigin(req);
  const o = requestOrigin(req);
  if (o === expected) {
    const owner = await assertOwner(req);
    await project(id, owner);
    return owner;
  }
  if (!isExtension(o))
    throw new HttpError(403, "Capture must come from your paired extension.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const row = await db
    .prepare(
      "SELECT projectId FROM capture_tokens WHERE tokenHash=? AND expiresAt>?",
    )
    .get(digest(token), Date.now());
  if (row?.projectId !== id)
    throw new HttpError(
      403,
      "Pair the extension again to capture into this project.",
    );
  return (await project(id)).owner;
}
