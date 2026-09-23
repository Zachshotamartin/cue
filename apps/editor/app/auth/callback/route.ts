import { NextResponse } from "next/server";
import { getAuth } from "../../../lib/auth-server";
import {
  HttpError,
  trustedRequestOrigin,
} from "../../../../../packages/storage/auth";
export async function GET(request: Request) {
  let publicOrigin: string;
  try {
    publicOrigin = trustedRequestOrigin(request);
  } catch (e) {
    if (e instanceof HttpError)
      return new Response(e.message, { status: e.status });
    throw e;
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next =
    url.searchParams.get("next") === "/auth/reset-password" ||
    type === "recovery"
      ? "/auth/reset-password"
      : "/projects";
  try {
    const auth = (await getAuth()).auth;
    const result = code
      ? await auth.exchangeCodeForSession(code)
      : tokenHash && ["signup", "email", "recovery"].includes(type || "")
        ? await auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email" | "recovery",
          })
        : null;
    if (result && !result.error)
      return NextResponse.redirect(new URL(next, publicOrigin));
  } catch {
    /* Show an actionable expired-link error without exposing provider details. */
  }
  return NextResponse.redirect(
    new URL("/auth/sign-in?error=expired-link", publicOrigin),
  );
}
