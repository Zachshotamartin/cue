"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Logo } from "./Logo";
export function AccountForm({ mode }: { mode: string }) {
  const router = useRouter(),
    params = useSearchParams();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      params.get("error") === "expired-link"
        ? "That link expired or was already used. Request a new verification or reset email."
        : "",
    );
  const titles: Record<string, string> = {
    "sign-in": "Welcome back.",
    "sign-up": "Your own creative space.",
    "forgot-password": "Find your way back.",
    "reset-password": "A fresh start.",
    "verify-email": "Check your inbox.",
  };
  async function submit(form: FormData) {
    setBusy(true);
    setMessage("");
    const email = String(form.get("email") || ""),
      password = String(form.get("password") || "");
    try {
      let r: any;
      const next = params.get("next");
      const destination =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/projects";
      if (mode === "sign-up") {
        r = await authClient.signUp.email({
          email,
          password,
          name: String(form.get("name")),
          callbackURL: `${window.location.origin}/projects`,
        });
        if (r.error) throw new Error(r.error.message);
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      if (mode === "forgot-password") {
        r = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (r.error) throw new Error(r.error.message);
        setMessage(
          "If this address has an account, a password reset link is on its way.",
        );
        return;
      }
      if (mode === "reset-password") {
        r = await authClient.resetPassword({ newPassword: password });
        if (r.error) throw new Error(r.error.message);
        router.push("/auth/sign-in");
        return;
      }
      if (mode === "verify-email") {
        r = await authClient.sendVerificationEmail({
          email,
          callbackURL: `${window.location.origin}/projects`,
        });
        if (r.error) throw new Error(r.error.message);
        setMessage(
          "Verification email sent. Open the link to activate your account.",
        );
        return;
      }
      r = await authClient.signIn.email({ email, password });
      if (r.error) throw new Error(r.error.message);
      router.push(destination);
      router.refresh();
    } catch (e: any) {
      setMessage(
        e.message || "Unable to complete this request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout page-shell">
      <div className="auth-intro theme-dark">
        <Logo />
        <h1>{titles[mode] || titles["sign-in"]}</h1>
        <p>
          Your projects, captures and finished films stay with your account.
          Pick up where you left off, from any browser.
        </p>
        <Link href="/">Back to Cue ↗</Link>
      </div>
      <section className="auth-panel">
        <h2>
          {mode === "sign-up"
            ? "Create an account"
            : mode === "forgot-password"
              ? "Reset your password"
              : mode === "verify-email"
                ? "Verify your email"
                : mode === "reset-password"
                  ? "Choose a new password"
                  : "Sign in"}
        </h2>
        <form action={submit}>
          {mode === "sign-up" && (
            <label>
              Your name
              <Input name="name" autoComplete="name" required maxLength={100} />
            </label>
          )}
          {mode !== "reset-password" && (
            <label>
              Email address
              <Input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={params.get("email") || ""}
                required
                maxLength={254}
              />
            </label>
          )}
          {!["forgot-password", "verify-email"].includes(mode) && (
            <label>
              Password
              <Input
                name="password"
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                minLength={mode === "sign-in" ? 1 : 12}
                maxLength={128}
                required
              />
              <small>
                {mode !== "sign-in" ? "Use at least 12 characters." : ""}
              </small>
            </label>
          )}
          <Button type="submit" className="button" disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "sign-up"
                ? "Create account"
                : mode === "forgot-password"
                  ? "Send reset link"
                  : mode === "reset-password"
                    ? "Save new password"
                    : mode === "verify-email"
                      ? "Resend verification email"
                      : "Sign in"}
          </Button>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </form>
        <div className="auth-links">
          {mode === "sign-in" ? (
            <>
              <Link href="/auth/forgot-password">Forgot your password?</Link>
              <Link href="/auth/sign-up">Create an account ↗</Link>
            </>
          ) : (
            <Link href="/auth/sign-in">Back to sign in</Link>
          )}
        </div>
        <p className="fine-print">
          API keys are private to your account. Cue never shares one account’s
          provider credits with another.
        </p>
      </section>
    </main>
  );
}
