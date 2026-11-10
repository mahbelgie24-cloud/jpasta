import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { dbRequestStore } from "./request-context";

/**
 * Connection resolution: on Cloudflare Workers prefer the Hyperdrive binding
 * (pooled + edge-cached); everywhere else (local next start, vitest, tsx
 * scripts) use DATABASE_URL.
 *
 * Workers cannot reuse an I/O object (including a pooled DB socket) across
 * requests. The client therefore has to be created INSIDE the request
 * context — a module-level `pg.Pool` works for the first request in an
 * isolate and then fails with "Cannot perform I/O on behalf of a different
 * request" / "This socket has been closed." `worker.ts` opens an
 * AsyncLocalStorage store for every request; Node scripts/tests keep a
 * per-process singleton.
 *
 * workerd notes (docs/DEPLOY.md):
 *  - maxUses 1 makes the pool release a connection after each checkout
 *  - every connection is bounded by connect + statement timeouts so a hung
 *    socket fails the request instead of hanging until the platform kills it
 */
type CloudflareEnv = { HYPERDRIVE?: { connectionString: string } };
type DbContext = { pool: Pool; db: NodePgDatabase };

function connectionString(): string | undefined {
  try {
    const env = getCloudflareContext().env as CloudflareEnv;
    if (env?.HYPERDRIVE) return env.HYPERDRIVE.connectionString;
  } catch {
    // Not on the Workers runtime (Node process) — fall through.
  }
  return process.env.DATABASE_URL;
}

function createContext(): DbContext {
  const url = connectionString();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured (or the HYPERDRIVE binding is missing)." +
        " See docs/DEPLOY.md.",
    );
  }
  const pool = new Pool({
    connectionString: url,
    max: 5,
    // Release the connection after each checkout so a socket never survives
    // into the next request.
    maxUses: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    query_timeout: 15_000,
    application_name: "jpasta",
  });
  // A pool-level error must never crash the worker process.
  pool.on("error", (err) => {
    console.error("postgres pool error:", err.message);
  });
  return { pool, db: drizzle(pool, { logger: false }) };
}

const globalForDb = globalThis as unknown as {
  jpastaNodeContext?: DbContext;
};

function currentContext(): DbContext {
  const store = dbRequestStore.getStore();
  if (store) {
    const existing = store.db as DbContext | undefined;
    if (existing) return existing;
    const created = createContext();
    store.db = created;
    return created;
  }
  // Node scripts/tests: one pool per process (the historical behaviour).
  const existing = globalForDb.jpastaNodeContext;
  if (existing && !existing.pool.ended) return existing;
  const created = createContext();
  globalForDb.jpastaNodeContext = created;
  return created;
}

// Keep the historical `db` / `pool` exports: every call site stays unchanged,
// while each property access resolves the client for the current request.
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const ctx = currentContext();
    const value = Reflect.get(ctx.db, prop, ctx.db);
    return typeof value === "function" ? value.bind(ctx.db) : value;
  },
});

export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const ctx = currentContext();
    const value = Reflect.get(ctx.pool, prop, ctx.pool);
    return typeof value === "function" ? value.bind(ctx.pool) : value;
  },
});
