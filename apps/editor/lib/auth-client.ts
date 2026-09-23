"use client";
import { useEffect, useState } from "react";
type Account = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};
async function request(path: string, body?: unknown) {
  const r = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return r.json() as Promise<{
    data?: { user: Account } | null;
    error?: { message: string };
  }>;
}
export const authClient = {
  signUp: {
    email: (body: {
      email: string;
      password: string;
      name: string;
      callbackURL: string;
    }) => request("sign-up", body),
  },
  signIn: {
    email: (body: { email: string; password: string }) =>
      request("sign-in", body),
  },
  signOut: () => request("sign-out", {}),
  requestPasswordReset: (body: { email: string; redirectTo: string }) =>
    request("forgot-password", body),
  resetPassword: (body: { newPassword: string }) =>
    request("reset-password", body),
  sendVerificationEmail: (body: { email: string; callbackURL: string }) =>
    request("verify-email", body),
  revokeOtherSessions: () => request("revoke-others", {}),
  useSession() {
    const [data, setData] = useState<{ user: Account } | null>(null);
    useEffect(() => {
      let active = true;
      request("session")
        .then((r) => {
          if (active) setData(r.data || null);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []);
    return { data };
  },
};
