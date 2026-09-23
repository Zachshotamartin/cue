import type { PoolConfig } from "pg";

/** Supabase's pooler uses its own CA. Verify both the chain and hostname. */
export function postgresConfiguration(
  connectionString = process.env.DATABASE_URL,
  caBase64 = process.env.DATABASE_CA_BASE64,
): PoolConfig {
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  if (!caBase64) return { connectionString };
  const ca = Buffer.from(caBase64, "base64").toString("utf8");
  if (!ca.includes("-----BEGIN CERTIFICATE-----"))
    throw new Error("DATABASE_CA_BASE64 must contain a PEM certificate.");
  const url = new URL(connectionString);
  // pg-connection-string replaces explicit ssl options when these are present.
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.href,
    ssl: { ca, rejectUnauthorized: true },
  };
}
