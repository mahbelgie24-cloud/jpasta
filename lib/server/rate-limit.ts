import "server-only";
import { logEvent } from "./log";

/**
 * Edge rate-limit resolution (Workers RateLimit bindings, shared by the
 * server actions and route handlers). One code path so the call shape, the
 * missing-binding warn, and the e2e bypass can never drift apart.
 *
 * - The binding API takes a configuration OBJECT ({ key }) — a bare string
 *   throws "invalid rate limit options", which the old per-file try/catch
 *   blocks swallowed and turned every edge limit into a silent fail-open.
 * - Missing binding inside Workers is logged, not silent.
 * - JPASTA_SKIP_EDGE_RATE_LIMIT=1 (set only by the Playwright webServer)
 *   bypasses the edge limit: the e2e suite drives dozens of real order
 *   journeys per minute from one IP and must not spend the production
 *   quota. The DB-side login throttle is independent and stays active.
 */

type BindingName = "AUTH_LIMIT" | "ORDER_LIMIT" | "READ_LIMIT";

interface RateLimitBindingLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export async function checkRateLimit(
  bindingName: BindingName,
  key: string,
  message = "طلبات كثيرة جداً — انتظر دقيقة ثم حاول مجدداً.",
): Promise<string | null> {
  if (process.env.JPASTA_SKIP_EDGE_RATE_LIMIT === "1") return null;

  let binding: RateLimitBindingLike | undefined;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    binding = (
      getCloudflareContext().env as unknown as Record<
        string,
        RateLimitBindingLike | undefined
      >
    )[bindingName];
  } catch {
    return null; // Node runtime (local dev/tests) — bindings are Workers-only
  }

  if (!binding) {
    // A missing binding inside Workers silently removes the ceiling —
    // visible in observability instead of failing open unnoticed.
    if (
      typeof navigator !== "undefined" &&
      /Cloudflare-Workers/i.test(navigator.userAgent)
    ) {
      logEvent("warn", "ratelimit.binding_missing", {
        message: bindingName,
      });
    }
    return null;
  }

  const { success } = await binding.limit({ key });
  if (!success) return message;
  return null;
}

/** Per-class key helper (mint:/push:/csp: share READ_LIMIT's quota). */
export function classKey(klass: string, ip: string): string {
  return `${klass}:${ip}`;
}
