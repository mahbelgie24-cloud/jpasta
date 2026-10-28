import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB readiness for the deploy checklist and uptime probes. */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      {
        ok: true,
        db: "up",
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, db: "down", latencyMs: Date.now() - started },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
