import { requireSecret } from "@/lib/server/env";
import {
  anonymizeExpiredPii,
  pruneExpiredData,
} from "@/lib/server/maintenance";
import { readShopSettings } from "@/lib/server/settings";
import { timingSafeEqualText } from "@/lib/domain/hash";
import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

/**
 * Cron-triggered housekeeping. The Worker's scheduled handler calls this
 * route with CRON_SECRET; without the secret the job is disabled, never
 * silently exposed. Sessions, old login attempts, and PII anonymization
 * past the owner's retention window (settings `pii_retention_months`) —
 * the order audit trail (order_status_history) is untouched by both.
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

    // PII retention pass. A failed settings read skips it (fail closed —
    // never anonymize against a guessed window); null in the payload marks
    // the skip so the daily log line makes it visible.
    let piiAnonymized: number | null = null;
    try {
      const shop = await readShopSettings();
      piiAnonymized = (await anonymizeExpiredPii(shop.piiRetentionMonths))
        .anonymized;
    } catch (err) {
      logEvent("error", "cron.pii_anonymize_failed", {
        message: err instanceof Error ? err.message : "unknown",
      });
    }

    logEvent("info", "cron.prune", { ...result, piiAnonymized });
    return Response.json(
      { ok: true, ...result, piiAnonymized },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    logEvent("error", "cron.prune_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return new Response("prune failed", { status: 500 });
  }
}
