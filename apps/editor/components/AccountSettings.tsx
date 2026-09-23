"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
export function AccountSettings() {
  const { data } = authClient.useSession();
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function signOut() {
    const r = await authClient.signOut();
    if (r.error) {
      setMessage(r.error.message || "Sign out failed.");
      return;
    }
    try {
      for (const k of Object.keys(localStorage))
        if (k.startsWith("cue:recovery:")) localStorage.removeItem(k);
    } catch {
      /* Sign out succeeds even when local storage is unavailable. */
    }
    router.push("/auth/sign-in");
    router.refresh();
  }
  return (
    <section className="account-settings">
      <div>
        <p className="eyebrow">Your account</p>
        <h2>{data?.user.name || "Account"}</h2>
        <p>
          {data?.user.email} ·{" "}
          {data?.user.emailVerified ? "Email verified" : "Verification needed"}
        </p>
      </div>
      <div className="account-actions">
        {data?.user && !data.user.emailVerified && (
          <button
            className="button secondary"
            onClick={async () => {
              const r = await authClient.sendVerificationEmail({
                email: data.user.email,
                callbackURL: `${location.origin}/settings`,
              });
              setMessage(r.error?.message || "Verification email sent.");
            }}
          >
            Verify email
          </button>
        )}
        <button
          className="button secondary"
          onClick={async () => {
            const r = await authClient.revokeOtherSessions();
            setMessage(r.error?.message || "Signed out of other sessions.");
          }}
        >
          Sign out other devices
        </button>
        <button className="button secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
