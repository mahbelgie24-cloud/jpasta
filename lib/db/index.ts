import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Connection resolution: on Cloudflare Workers prefer the Hyperdrive binding
 * (pooled + edge-cached); everywhere else (local next start, vitest, tsx
 * scripts) use DATABASE_URL.
 *
 * workerd notes (docs/DEPLOY.md):
 *  - a pooled socket cannot outlive its request context → idleTimeoutMillis 0
 *  - every connection is bounded by connect + statement timeouts so a hung
 *    socket fails the request instead of hanging until the platform kills it
 */
type CloudflareEnv = { HYPERDRIVE?: { connectionString: string } };

function connectionString(): string | undefined {
  try {
    const env = getCloudflareContext().env as CloudflareEnv;
    if (env?.HYPERDRIVE) return env.HYPERDRIVE.connectionString;
  } catch {
    // Not on the Workers runtime (Node process) — fall through.
  }
  return process.env.DATABASE_URL;
}

const globalForDb = globalThis as unknown as {
  jpastaPool?: Pool;
  jpastaDb?: NodePgDatabase;
};

function createPool(): Pool {
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
    // See the workerd note above.
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
  return pool;
}

// Test suites end the shared pool in their afterAll; the next file in the
// same process must get a LIVE pool, not the ended singleton (vitest runs
// files sequentially with fileParallelism: false).
const cachedPool = globalForDb.jpastaPool;
export const pool: Pool =
  cachedPool && !cachedPool.ended ? cachedPool : createPool();

export const db: NodePgDatabase =
  globalForDb.jpastaPool === pool && globalForDb.jpastaDb
    ? globalForDb.jpastaDb
    : drizzle(pool, { logger: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.jpastaPool = pool;
  globalForDb.jpastaDb = db;
}
