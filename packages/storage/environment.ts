export function assertDataEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV === "test") return;
  const expected = env.VERCEL_ENV || "development";
  const actual = env.CUE_DATA_ENVIRONMENT;
  if (actual && actual !== expected)
    throw new Error(
      `Cue ${expected} cannot use ${actual} data. Configure a separate database and media store.`,
    );
  if (!env.VERCEL && env.DATABASE_URL) {
    const host = new URL(env.DATABASE_URL).hostname;
    if (
      !["localhost", "127.0.0.1", "::1"].includes(host) &&
      actual !== "development"
    )
      throw new Error(
        "Remote development data must be explicitly marked CUE_DATA_ENVIRONMENT=development. Never load production environment files into localhost.",
      );
  }
  if (env.VERCEL_ENV === "preview" && actual !== "preview")
    throw new Error(
      "Preview deployments require isolated data marked CUE_DATA_ENVIRONMENT=preview.",
    );
  if (
    env.VERCEL &&
    (env.CUE_LOCAL_DATABASE === "1" || env.CUE_STORAGE === "local")
  )
    throw new Error("Hosted Cue requires durable database and object storage.");
}
