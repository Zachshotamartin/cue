import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export function authConfiguration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase authentication is not configured.");
  return { url, key };
}
export const authCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: !!process.env.VERCEL,
  path: "/",
});
export async function getAuth() {
  const { url, key } = authConfiguration();
  const jar = await cookies();
  // A client belongs to one request. Sharing it could share authentication state.
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values)
            jar.set(name, value, { ...options, ...authCookieOptions() });
        } catch {
          // Server Components cannot write cookies; the proxy refreshes them first.
        }
      },
    },
  });
}
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email || "",
    name: String(user.user_metadata?.name || ""),
    emailVerified: !!user.email_confirmed_at,
  };
}
export async function currentUser() {
  const { data, error } = await (await getAuth()).auth.getUser();
  return error || !data.user ? null : publicUser(data.user);
}
