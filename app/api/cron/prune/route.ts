import { requireSecret } from "@/lib/server/env";
import { pruneExpiredData } from "@/lib/server/maintenance";
import { timingSafeEqualText } from "@/lib/domain/hash";
import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

/**
 * Cron-triggered housekeeping. The Worker's scheduled handler calls this
 * route with CRON_SECRET; without the secret the job is disabled, never
 * silently exposed. Sessions and old login attempts only — the order audit
 * trail is untouched.
 */
export async function GET(request: Request) {
  let secret: string;
  try {
    secret = await requireSecret("CRON_SECRET", 32);
  } catch {
    return new Response("cron-disabled", { status: 503 });
  }

  if (
    !timingSafeEqualText(
      request.headers.get("authorization") ?? "",
      `Bearer ${secret}`,
    )
  ) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const result = await pruneExpiredData();
    logEvent("info", "cron.prune", result);
    return Response.json(
      { ok: true, ...result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    logEvent("error", "cron.prune_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return new Response("prune failed", { status: 500 });
  }
}
