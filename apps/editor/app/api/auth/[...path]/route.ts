import { z } from "zod";
import { getAuth, currentUser } from "../../../../lib/auth-server";
import {
  assertHost,
  assertSameOrigin,
  HttpError,
} from "../../../../../../packages/storage/auth";
import { rateLimit } from "../../../../../../packages/storage/client";
import { createHash } from "node:crypto";
import {
  boundedText,
  RequestTooLarge,
} from "../../../../../../packages/server/request-body";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const email = z.string().email().max(254);
const password = z.string().min(12).max(128);
export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    assertHost(req);
    if ((await ctx.params).path.join("/") !== "session")
      return json({ error: { message: "Not found." } }, 404);
    if (!process.env.SUPABASE_URL)
      return json(
        { error: { message: "Supabase account setup is not complete yet." } },
        503,
      );
    const user = await currentUser();
    return json({ data: user ? { user } : null });
  } catch (e) {
    if (e instanceof HttpError)
      return json({ error: { message: e.message } }, e.status);
    return json(
      { error: { message: "Account service is temporarily unavailable." } },
      503,
    );
  }
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const publicOrigin = assertSameOrigin(req);
    if (!process.env.SUPABASE_URL)
      return json(
        { error: { message: "Supabase account setup is not complete yet." } },
        503,
      );
    const action = (await ctx.params).path.join("/");
    if (
      process.env.CUE_SHARED_AUTH_READ_ONLY === "1" &&
      !["sign-in", "sign-out"].includes(action)
    )
      return json(
        {
          error: {
            message:
              "This development environment shares sign-in identity only. Manage your account on the production site, or configure a separate local Supabase instance.",
          },
        },
        403,
      );
    if (
      ![
        "sign-up",
        "sign-in",
        "sign-out",
        "forgot-password",
        "reset-password",
        "verify-email",
        "revoke-others",
      ].includes(action)
    )
      return json({ error: { message: "Not found." } }, 404);
    const ip = createHash("sha256")
      .update(req.headers.get("x-forwarded-for")?.split(",")[0] || "local")
      .digest("hex");
    const scarce = ["sign-up", "forgot-password", "verify-email"].includes(
      action,
    );
    if (
      !(await rateLimit(
        `auth:${action}:${ip}`,
        scarce ? 8 : 30,
        scarce ? 3600000 : 300000,
      ))
    )
      return json(
        {
          error: {
            message: "Too many attempts. Please wait before trying again.",
          },
        },
        429,
      );
    const text = await boundedText(req, 4096);
    const body = JSON.parse(text || "{}");
    const auth = (await getAuth()).auth;
    const callback = new URL("/auth/callback", publicOrigin);
    let result;
    switch (action) {
      case "sign-up": {
        if (process.env.CUE_PUBLIC_SIGNUP === "0")
          return json(
            {
              error: {
                message:
                  "Cue is currently invite-only. Sign in with your existing account or contact the owner for access.",
              },
            },
            403,
          );
        const b = z
          .object({ email, password, name: z.string().trim().min(1).max(100) })
          .parse(body);
        result = await auth.signUp({
          email: b.email,
          password: b.password,
          options: { data: { name: b.name }, emailRedirectTo: callback.href },
        });
        break;
      }
      case "sign-in": {
        const b = z
          .object({ email, password: z.string().min(1).max(128) })
          .parse(body);
        result = await auth.signInWithPassword(b);
        break;
      }
      case "forgot-password": {
        callback.searchParams.set("next", "/auth/reset-password");
        result = await auth.resetPasswordForEmail(email.parse(body.email), {
          redirectTo: callback.href,
        });
        break;
      }
      case "verify-email": {
        result = await auth.resend({
          type: "signup",
          email: email.parse(body.email),
          options: { emailRedirectTo: callback.href },
        });
        break;
      }
      case "reset-password": {
        if (!(await currentUser()))
          return json(
            {
              error: {
                message:
                  "Your reset link expired. Request a new link from the sign-in page.",
              },
            },
            401,
          );
        result = await auth.updateUser({
          password: password.parse(body.newPassword),
        });
        if (!result.error) await auth.signOut();
        break;
      }
      case "sign-out":
        result = await auth.signOut({ scope: "local" });
        break;
      case "revoke-others":
        result = await auth.signOut({ scope: "others" });
        break;
    }
    if (result?.error)
      return json({ error: { message: result.error.message } }, 400);
    // Tokens and refresh tokens never leave the server in JSON.
    return json({ data: { ok: true } });
  } catch (e) {
    if (e instanceof HttpError)
      return json({ error: { message: e.message } }, e.status);
    if (e instanceof RequestTooLarge)
      return json({ error: { message: "Request too large." } }, 413);
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return json(
        {
          error: {
            message: "Check your email, name, and password and try again.",
          },
        },
        400,
      );
    return json(
      {
        error: {
          message:
            "Account service is temporarily unavailable. Please try again.",
        },
      },
      503,
    );
  }
}
