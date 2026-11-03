import "server-only";
import { bus, ORDERS_CHANGED } from "./bus";
import { logEvent } from "./log";

/**
 * Realtime fan-out contract.
 *
 * Production: Cloudflare Durable Object (OrderFeed) — one instance per shop,
 * reachable from every isolate, with hibernatable WebSockets. The broadcast
 * route is authenticated with REALTIME_SECRET; a missing/short secret never
 * degrades into an unauthenticated fan-out.
 * Local Node: the in-process event bus (single process, so it is exact).
 *
 * Call sites only ever use notifyOrdersChanged(), after the DB transaction
 * has committed. It must never throw: a committed sale must not be reported
 * as failed because a notification transport hiccuped.
 */

interface DurableObjectStubLike {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export async function notifyOrdersChanged(): Promise<void> {
  const at = Date.now();
  let reachedWorkers = false;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as {
      ORDER_FEED?: DurableObjectNamespaceLike;
      REALTIME_SECRET?: string;
    };
    if (env.ORDER_FEED) {
      reachedWorkers = true;
      const secret = env.REALTIME_SECRET;
      if (!secret) {
        logEvent("error", "realtime.broadcast_no_secret");
        return;
      }
      const stub = env.ORDER_FEED.get(env.ORDER_FEED.idFromName("jpasta"));
      const response = await stub.fetch("https://order-feed/broadcast", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ at }),
      });
      if (!response.ok) {
        logEvent("warn", "realtime.broadcast_rejected", {
          status: response.status,
        });
      }
      return;
    }
  } catch (err) {
    logEvent("warn", "realtime.broadcast_error", {
      message: err instanceof Error ? err.message : "unknown",
    });
  }

  // Node runtime (next dev / next start / vitest) — no DO binding.
  if (!reachedWorkers) bus.emit(ORDERS_CHANGED, at);
}
