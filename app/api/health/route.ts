import { timingSafeEqualText } from "@/lib/domain/hash";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();

/**
 * Liveness + DB readiness for the deploy checklist and uptime probes.
 *
 * The public body is minimal on purpose: version and uptime fingerprint the
 * deployment to anyone who can reach the host. The full detail ships only
 * with the CRON_SECRET bearer (the same secret the uptime/deploy tooling
 * already holds).
 */
export async function GET(request: Request) {
  const started = Date.now();

  const authorized = (() => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    return timingSafeEqualText(
      request.headers.get("authorization") ?? "",
      `Bearer ${secret}`,
    );
  })();

  try {
    await db.execute(sql`select 1`);
    const base = {
      ok: true,
      db: "up",
      time: new Date().toISOString(),
    };
    return Response.json(
      authorized
        ? {
            ...base,
            latencyMs: Date.now() - started,
            uptimeMs: Date.now() - STARTED_AT,
            version: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev",
          }
        : base,
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
        time: new Date().toISOString(),
        ...(authorized
          ? {
              latencyMs: Date.now() - started,
              version: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev",
            }
          : {}),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
