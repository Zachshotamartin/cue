export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch(`/api${url}`, {
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const x = await r.json();
  if (!r.ok) {
    if (r.status === 401 && !location.pathname.startsWith("/auth/"))
      location.assign(
        `/auth/sign-in?next=${encodeURIComponent(location.pathname)}`,
      );
    const e = new Error(x.error || "The request could not be completed.");
    Object.assign(e, { status: r.status });
    throw e;
  }
  return x;
}
export function jobOptions(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  };
}
export const assetUrl = (id: string) => `/api/assets/${id}`;
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
