import { credential } from "../storage/credentials";
import type { Provider } from "../contracts";
export async function verifyConnection(owner: string, provider: Provider) {
  const key = await credential(owner, provider);
  const endpoints: Record<
    Provider,
    { url: string; headers: Record<string, string> }
  > = {
    openai: {
      url: "https://api.openai.com/v1/models",
      headers: { Authorization: `Bearer ${key}` },
    },
    anthropic: {
      url: "https://api.anthropic.com/v1/models",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    },
    gemini: {
      url: "https://generativelanguage.googleapis.com/v1beta/models",
      headers: { "x-goog-api-key": key },
    },
    runway: {
      url: "https://api.dev.runwayml.com/v1/organization",
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
      },
    },
    elevenlabs: {
      url: "https://api.elevenlabs.io/v1/user",
      headers: { "xi-api-key": key },
    },
  };
  const { url, headers } = endpoints[provider];
  try {
    const r = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    await r.body?.cancel();
    return {
      verified: r.ok,
      status: r.ok
        ? "verified"
        : r.status === 401 || r.status === 403
          ? "rejected"
          : r.status === 429
            ? "rate-limited"
            : "unavailable",
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      verified: false,
      status: "unavailable",
      checkedAt: new Date().toISOString(),
    };
  }
}
