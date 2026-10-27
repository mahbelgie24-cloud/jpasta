import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { jpastaPool?: Pool };

export const pool =
  globalForDb.jpastaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.jpastaPool = pool;
}

export const db: NodePgDatabase = drizzle(pool);
