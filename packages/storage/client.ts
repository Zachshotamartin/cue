import { assertDataEnvironment } from "./environment";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import path from "node:path";
import fs from "node:fs";
import { dataDir } from "./config";
import { postgresConfiguration } from "./postgres";

const context = new AsyncLocalStorage<PoolClient | "sqlite">();
export const cloudDatabase = !!process.env.DATABASE_URL;
const pool = cloudDatabase
  ? new Pool({
      ...postgresConfiguration(),
      max: 4,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    })
  : null;
let sqlite: import("node:sqlite").DatabaseSync;
let ready: Promise<void> | undefined;
const columns = [
  "projectId",
  "createdAt",
  "updatedAt",
  "leaseUntil",
  "tokenHash",
  "expiresAt",
  "archivedAt",
];
const privateTables = [
  "projects",
  "revisions",
  "assets",
  "jobs",
  "takes",
  "events",
  "credentials",
  "pairing",
  "capture_tokens",
  "uploads",
  "upload_chunks",
  "project_archive",
  "request_limits",
  "schema_migrations",
  "garbage",
  "credential_checks",
  "runtime_environment",
];
function postgresSQL(sql: string) {
  let i = 0;
  return sql
    .replace(/\?/g, () => `$${++i}`)
    .replace(new RegExp(`\\b(${columns.join("|")})\\b`, "g"), '"$1"')
    .replace(new RegExp(`\\b(${privateTables.join("|")})\\b`, "g"), 'cue."$1"');
}
const schema = `
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL, draft TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, revision INTEGER NOT NULL, draft TEXT NOT NULL, label TEXT NOT NULL, createdAt TEXT NOT NULL, PRIMARY KEY(projectId,revision));
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, state TEXT NOT NULL, leaseUntil BIGINT NOT NULL DEFAULT 0, data TEXT NOT NULL, idem TEXT NOT NULL, UNIQUE(projectId,idem));
CREATE TABLE IF NOT EXISTS takes (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id BIGSERIAL PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type TEXT NOT NULL, data TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS credentials (owner TEXT NOT NULL, provider TEXT NOT NULL, encrypted TEXT NOT NULL, suffix TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY(owner,provider));
CREATE TABLE IF NOT EXISTS pairing (code TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, expiresAt BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS capture_tokens (tokenHash TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, expiresAt BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL, createdAt BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS upload_chunks (upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE, chunk_index INTEGER NOT NULL, object_path TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(upload_id,chunk_index));
CREATE TABLE IF NOT EXISTS project_archive (projectId TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, archivedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS runtime_environment (id INTEGER PRIMARY KEY, environment TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS garbage (object_path TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS credential_checks (owner TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, checked_at TEXT NOT NULL, PRIMARY KEY(owner,provider));
CREATE INDEX IF NOT EXISTS events_project ON events(projectId,id);
CREATE INDEX IF NOT EXISTS jobs_state ON jobs(state,leaseUntil);
CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner,updatedAt);
CREATE INDEX IF NOT EXISTS assets_project ON assets(projectId);
CREATE INDEX IF NOT EXISTS uploads_project ON uploads(projectId);
`;
export async function initializeDatabase() {
  if (!ready)
    ready = (async () => {
      assertDataEnvironment();
      if (pool) {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          await c.query("SELECT pg_advisory_xact_lock(735619284)");
          // Do not rerun DDL on every server/worker cold start. Even an
          // already-enabled RLS ALTER takes an exclusive table lock and can
          // deadlock with active job transactions. The advisory lock also
          // serializes the first migration across concurrent processes.
          const registry = await c.query(
            "SELECT to_regclass('cue.schema_migrations') AS name",
          );
          const applied = registry.rows[0]?.name
            ? new Set(
                (
                  await c.query("SELECT version FROM cue.schema_migrations")
                ).rows.map((r) => Number(r.version)),
              )
            : new Set<number>();
          if (!applied.has(1) && !applied.has(2)) {
            await c.query(
              "CREATE SCHEMA IF NOT EXISTS cue; REVOKE ALL ON SCHEMA cue FROM PUBLIC",
            );
            await c.query(postgresSQL(schema));
            for (const table of privateTables)
              await c.query(
                `ALTER TABLE cue."${table}" ENABLE ROW LEVEL SECURITY`,
              );
            await c.query(
              "INSERT INTO cue.schema_migrations VALUES(1,$1) ON CONFLICT DO NOTHING",
              [new Date().toISOString()],
            );
          }
          if (!applied.has(2)) {
            await c.query(
              postgresSQL(`CREATE TABLE IF NOT EXISTS garbage (object_path TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at BIGINT NOT NULL);
              CREATE TABLE IF NOT EXISTS credential_checks (owner TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, checked_at TEXT NOT NULL, PRIMARY KEY(owner,provider));`),
            );
            for (const table of ["garbage", "credential_checks"])
              await c.query(
                `ALTER TABLE cue."${table}" ENABLE ROW LEVEL SECURITY`,
              );
            await c.query(
              "INSERT INTO cue.schema_migrations VALUES(2,$1) ON CONFLICT DO NOTHING",
              [new Date().toISOString()],
            );
          }
          if (!applied.has(3)) {
            await c.query(
              postgresSQL(
                "CREATE TABLE IF NOT EXISTS runtime_environment (id INTEGER PRIMARY KEY, environment TEXT NOT NULL)",
              ),
            );
            await c.query(
              'ALTER TABLE cue."runtime_environment" ENABLE ROW LEVEL SECURITY',
            );
            await c.query(
              "INSERT INTO cue.schema_migrations VALUES(3,$1) ON CONFLICT DO NOTHING",
              [new Date().toISOString()],
            );
          }
          if (process.env.NODE_ENV !== "test") {
            const expected = process.env.VERCEL_ENV || "development";
            const tag = await c.query(
              "SELECT environment FROM cue.runtime_environment WHERE id=1",
            );
            if (tag.rows[0] && tag.rows[0].environment !== expected)
              throw new Error(
                "This database belongs to a different Cue environment. Configure an isolated database.",
              );
            if (!tag.rows.length)
              await c.query(
                "INSERT INTO cue.runtime_environment VALUES(1,$1)",
                [expected],
              );
          }
          await c.query("COMMIT");
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      } else {
        if (
          process.env.NODE_ENV !== "test" &&
          process.env.CUE_LOCAL_DATABASE !== "1"
        )
          throw new Error(
            "DATABASE_URL is required. Configure Cue’s cloud database before using the application.",
          );
        fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
        const { DatabaseSync } = await import("node:sqlite");
        sqlite = new DatabaseSync(path.join(dataDir, "cue.sqlite"));
        sqlite.exec(
          "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        );
        sqlite.exec(
          schema.replace(
            "BIGSERIAL PRIMARY KEY",
            "INTEGER PRIMARY KEY AUTOINCREMENT",
          ),
        );
      }
    })().catch((e) => {
      ready = undefined;
      throw e;
    });
  return ready;
}
async function query(sql: string, args: any[] = []) {
  await initializeDatabase();
  if (pool)
    return ((context.getStore() as PoolClient) || pool).query(
      postgresSQL(sql),
      args,
    );
  const stmt = sqlite.prepare(sql.replace(/ FOR UPDATE(?: SKIP LOCKED)?/g, ""));
  if (/^\s*(SELECT|WITH|PRAGMA)/i.test(sql))
    return { rows: stmt.all(...args) as any[] };
  return { rows: [], rowCount: Number(stmt.run(...args).changes) };
}
export const db = {
  close: async () => {
    if (pool) await pool.end();
    else sqlite?.close();
  },
  prepare(sql: string) {
    return {
      get: async (...args: any[]) => (await query(sql, args)).rows[0] as any,
      all: async (...args: any[]) => (await query(sql, args)).rows as any[],
      run: async (...args: any[]) => query(sql, args),
    };
  },
  exec: async (sql: string) => query(sql),
};
let localTransaction = Promise.resolve();
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  await initializeDatabase();
  if (context.getStore()) return fn();
  if (pool) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await context.run(c, fn);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  let release!: () => void;
  const previous = localTransaction;
  localTransaction = new Promise<void>((r) => (release = r));
  await previous;
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const r = await context.run("sqlite", fn);
    sqlite.exec("COMMIT");
    return r;
  } catch (e) {
    sqlite.exec("ROLLBACK");
    throw e;
  } finally {
    release();
  }
}
export function rowLock() {
  return context.getStore() ? " FOR UPDATE" : "";
}
export async function rateLimit(key: string, limit: number, windowMs: number) {
  return tx(async () => {
    // A fixed hash advisory lock also serializes creation of the first row.
    if (pool) await query("SELECT pg_advisory_xact_lock(hashtext(?))", [key]);
    const r = await db
      .prepare("SELECT * FROM request_limits WHERE key=? FOR UPDATE")
      .get(key);
    const at = Date.now();
    if (!r || at - Number(r.window_start) >= windowMs) {
      await db
        .prepare(
          "INSERT INTO request_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1",
        )
        .run(key, at);
      return true;
    }
    if (r.count >= limit) return false;
    await db
      .prepare("UPDATE request_limits SET count=count+1 WHERE key=?")
      .run(key);
    return true;
  });
}

export async function lockAccount(owner: string) {
  if (pool)
    await query("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `account:${owner}`,
    ]);
}
