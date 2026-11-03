import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();

/** Liveness + DB readiness for the deploy checklist and uptime probes. */
export async function GET() {
  const started = Date.now();
  const version = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev";

  try {
    await db.execute(sql`select 1`);
    return Response.json(
      {
        ok: true,
        db: "up",
        latencyMs: Date.now() - started,
        uptimeMs: Date.now() - STARTED_AT,
        version,
        time: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    // A DB outage must leave a diagnosable server log, not an empty 503.
    logEvent("error", "health.db_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return Response.json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - started,
        version,
        time: new Date().toISOString(),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
