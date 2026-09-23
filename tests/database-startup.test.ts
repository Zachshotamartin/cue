import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pg = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("pg", () => ({
  Pool: class {
    connect = pg.connect;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://test.invalid/cue");
  pg.connect.mockResolvedValue({ query: pg.query, release: pg.release });
});
afterEach(() => vi.unstubAllEnvs());

function schemaState(exists: boolean, applied: boolean) {
  pg.query.mockImplementation(async (sql: string) => {
    if (sql.includes("to_regclass"))
      return { rows: [{ name: exists ? "cue.schema_migrations" : null }] };
    if (sql.startsWith("SELECT version"))
      return { rows: applied ? [{ version: 1 }] : [] };
    return { rows: [] };
  });
}

describe("database cold starts", () => {
  it("does not take DDL locks on a migrated database during active jobs", async () => {
    schemaState(true, true);
    const { initializeDatabase } = await import("../packages/storage/client");
    await Promise.all([initializeDatabase(), initializeDatabase()]);
    const statements = pg.query.mock.calls.map(([sql]) => sql as string);
    expect(
      statements.some((sql) => /\b(CREATE|ALTER|REVOKE|INSERT)\b/.test(sql)),
    ).toBe(false);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(pg.connect).toHaveBeenCalledOnce();
    expect(pg.release).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "applies schema and RLS before recording completion (migration table exists: %s)",
    async (exists) => {
      schemaState(exists, false);
      const { initializeDatabase } = await import("../packages/storage/client");
      await initializeDatabase();
      const statements = pg.query.mock.calls.map(([sql]) => sql as string);
      const lock = statements.findIndex((sql) =>
        sql.includes("pg_advisory_xact_lock"),
      );
      const ddl = statements.findIndex((sql) => sql.includes("CREATE SCHEMA"));
      const secured = statements.findIndex((sql) =>
        sql.includes('ALTER TABLE cue."credentials" ENABLE ROW LEVEL SECURITY'),
      );
      const recorded = statements.findIndex((sql) =>
        sql.startsWith("INSERT INTO cue.schema_migrations"),
      );
      expect(lock).toBeLessThan(ddl);
      expect(ddl).toBeLessThan(secured);
      expect(secured).toBeLessThan(recorded);
      expect(statements.at(-1)).toBe("COMMIT");
    },
  );

  it("rolls back a failed migration and allows another startup attempt", async () => {
    schemaState(false, false);
    const successfulQuery = pg.query.getMockImplementation()!;
    let failed = false;
    pg.query.mockImplementation(async (sql: string) => {
      if (!failed && sql.startsWith("ALTER TABLE")) {
        failed = true;
        throw new Error("migration interrupted");
      }
      return successfulQuery(sql);
    });
    const { initializeDatabase } = await import("../packages/storage/client");
    await expect(initializeDatabase()).rejects.toThrow("migration interrupted");
    expect(pg.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    await initializeDatabase();
    expect(pg.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(pg.release).toHaveBeenCalledTimes(2);
  });
});
