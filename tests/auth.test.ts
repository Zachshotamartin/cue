import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("../apps/editor/lib/auth-server", () => ({
  getAuth: mocks.getAuth,
  currentUser: mocks.currentUser,
}));
vi.mock("../packages/storage/client", () => ({ rateLimit: mocks.rateLimit }));
import { GET, POST } from "../apps/editor/app/api/auth/[...path]/route";
import { GET as callback } from "../apps/editor/app/auth/callback/route";
import { boundedText, RequestTooLarge } from "../packages/server/request-body";
import { postgresConfiguration } from "../packages/storage/postgres";
import { assertOwner, assertSameOrigin } from "../packages/storage/auth";
const origin = "http://127.0.0.1:5303";
const context = (action: string) => ({
  params: Promise.resolve({ path: [action] }),
});
const request = (action: string, body: unknown, source = origin) =>
  new Request(`${origin}/api/auth/${action}`, {
    method: "POST",
    headers: { origin: source },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  mocks.rateLimit.mockResolvedValue(true);
  mocks.currentUser.mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("server-only Supabase authentication", () => {
  const proxiedRequest = (source = origin, host = "127.0.0.1:5303") =>
    new Request("http://localhost:5303/api/auth/sign-in", {
      method: "POST",
      headers: { host, origin: source },
      body: JSON.stringify({
        email: "test@example.com",
        password: "test-password",
      }),
    });
  it("accepts the configured browser origin when Next rewrites the internal URL", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    mocks.getAuth.mockResolvedValue({ auth: { signInWithPassword } });
    const r = await POST(proxiedRequest(), context("sign-in"));
    expect(r.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledOnce();
  });
  it.each([
    "http://localhost:5303",
    "http://127.0.0.1:5304",
    "https://127.0.0.1:5303",
    "null",
    "",
    "https://evil.test",
  ])(
    "rejects the mismatched browser origin %s before auth or storage",
    async (source) => {
      const r = await POST(proxiedRequest(source), context("sign-in"));
      expect(r.status).toBe(403);
      expect(mocks.getAuth).not.toHaveBeenCalled();
      expect(mocks.rateLimit).not.toHaveBeenCalled();
    },
  );
  it("does not trust forwarded hosts or an unconfigured request host", () => {
    const req = proxiedRequest("https://evil.test", "evil.test");
    req.headers.set("x-forwarded-host", "127.0.0.1:5303");
    req.headers.set("x-forwarded-proto", "http");
    expect(() => assertSameOrigin(req)).toThrow("Request host is not allowed.");
    const configured = proxiedRequest("https://evil.test");
    configured.headers.set("x-forwarded-host", "evil.test");
    expect(() => assertSameOrigin(configured)).toThrow(
      "Request origin is not allowed.",
    );
  });
  it("allows only HTTPS same-origin requests on the configured Vercel deployment", () => {
    vi.stubEnv("VERCEL_URL", "cue-preview.vercel.app");
    expect(
      assertSameOrigin(
        proxiedRequest(
          "https://cue-preview.vercel.app",
          "cue-preview.vercel.app",
        ),
      ),
    ).toBe("https://cue-preview.vercel.app");
    expect(() =>
      assertSameOrigin(
        proxiedRequest(
          "http://cue-preview.vercel.app",
          "cue-preview.vercel.app",
        ),
      ),
    ).toThrow();
    expect(() =>
      assertSameOrigin(proxiedRequest(origin, "cue-preview.vercel.app")),
    ).toThrow();
  });
  it("uses the same origin guard for authenticated editor writes", async () => {
    mocks.currentUser.mockResolvedValue({
      id: "test-owner",
      emailVerified: true,
    });
    expect(await assertOwner(proxiedRequest(), true)).toBe("test-owner");
    await expect(
      assertOwner(proxiedRequest("http://localhost:5303")),
    ).rejects.toThrow("Request origin is not allowed.");
  });
  it("keeps email links and callback redirects on the browser host", async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null });
    mocks.getAuth.mockResolvedValue({
      auth: { signUp, verifyOtp: vi.fn().mockResolvedValue({ error: null }) },
    });
    const req = new Request("http://localhost:5303/api/auth/sign-up", {
      method: "POST",
      headers: { host: "127.0.0.1:5303", origin },
      body: JSON.stringify({
        email: "test@example.com",
        name: "Test",
        password: "long-test-password",
      }),
    });
    expect((await POST(req, context("sign-up"))).status).toBe(200);
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${origin}/auth/callback`,
    );
    const redirected = await callback(
      new Request(
        "http://localhost:5303/auth/callback?token_hash=test&type=signup",
        { headers: { host: "127.0.0.1:5303" } },
      ),
    );
    expect(redirected.headers.get("location")).toBe(`${origin}/projects`);
  });
  it("does not call auth or the database for cross-origin writes", async () => {
    const r = await POST(
      request("sign-in", {}, "https://elsewhere.test"),
      context("sign-in"),
    );
    expect(r.status).toBe(403);
    expect(mocks.getAuth).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });
  it("does not return provider sessions or tokens in JSON", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "private-access",
          refresh_token: "private-refresh",
        },
      },
      error: null,
    });
    mocks.getAuth.mockResolvedValue({ auth: { signInWithPassword } });
    const r = await POST(
      request("sign-in", {
        email: "test@example.com",
        password: "long-test-password",
      }),
      context("sign-in"),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { ok: true } });
  });
  it("rejects short passwords before submitting sign-up", async () => {
    const signUp = vi.fn();
    mocks.getAuth.mockResolvedValue({ auth: { signUp } });
    const r = await POST(
      request("sign-up", {
        email: "test@example.com",
        name: "Test",
        password: "short",
      }),
      context("sign-up"),
    );
    expect(r.status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
  });
  it("derives the verification callback from this origin, not a caller URL", async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null });
    mocks.getAuth.mockResolvedValue({ auth: { signUp } });
    await POST(
      request("sign-up", {
        email: "test@example.com",
        name: "Test",
        password: "long-test-password",
        callbackURL: "https://evil.test",
      }),
      context("sign-up"),
    );
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${origin}/auth/callback`,
    );
  });
  it("rejects password reset without an authenticated recovery session", async () => {
    const updateUser = vi.fn();
    mocks.getAuth.mockResolvedValue({ auth: { updateUser } });
    const r = await POST(
      request("reset-password", { newPassword: "long-test-password" }),
      context("reset-password"),
    );
    expect(r.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("rate limits without sending an email", async () => {
    mocks.rateLimit.mockResolvedValue(false);
    const r = await POST(
      request("forgot-password", { email: "test@example.com" }),
      context("forgot-password"),
    );
    expect(r.status).toBe(429);
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });
  it("does not cache session responses", async () => {
    const r = await GET(
      new Request(`${origin}/api/auth/session`),
      context("session"),
    );
    expect(await r.json()).toEqual({ data: null });
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("ignores an external redirect after a successful email callback", async () => {
    mocks.getAuth.mockResolvedValue({
      auth: { verifyOtp: vi.fn().mockResolvedValue({ error: null }) },
    });
    const r = await callback(
      new Request(
        `${origin}/auth/callback?token_hash=test&type=signup&next=https://evil.test`,
      ),
    );
    expect(r.headers.get("location")).toBe(`${origin}/projects`);
  });
  it("routes recovery links to password reset and rejects expired tokens", async () => {
    const verifyOtp = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("expired") });
    mocks.getAuth.mockResolvedValue({ auth: { verifyOtp } });
    const req = new Request(
      `${origin}/auth/callback?token_hash=test&type=recovery`,
    );
    expect((await callback(req)).headers.get("location")).toBe(
      `${origin}/auth/reset-password`,
    );
    expect((await callback(req)).headers.get("location")).toBe(
      `${origin}/auth/sign-in?error=expired-link`,
    );
  });
  it("bounds streamed bodies by bytes, even without Content-Length", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      pull(c) {
        c.enqueue(new Uint8Array(3000));
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request(origin, {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(boundedText(req, 4096)).rejects.toBeInstanceOf(
      RequestTooLarge,
    );
    expect(cancelled).toBe(true);
  });
  it("keeps certificate verification enabled when using a provider CA", () => {
    const ca = Buffer.from(
      "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
    ).toString("base64");
    const config = postgresConfiguration(
      "postgresql://test:pass@localhost/db?sslmode=no-verify",
      ca,
    );
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
  });
});
