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
 * Local Node (next dev/start, vitest): the in-process event bus.
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

/** workerd sets this UA; Node (dev, e2e, tests) must not attempt a DO call. */
function isWorkersRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Cloudflare-Workers/i.test(navigator.userAgent)
  );
}

export async function notifyOrdersChanged(): Promise<void> {
  const at = Date.now();

  if (!isWorkersRuntime()) {
    bus.emit(ORDERS_CHANGED, at);
    return;
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as {
      ORDER_FEED?: DurableObjectNamespaceLike;
      REALTIME_SECRET?: string;
    };
    if (!env.ORDER_FEED) {
      logEvent("error", "realtime.binding_missing");
      return;
    }
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
  } catch (err) {
    logEvent("warn", "realtime.broadcast_error", {
      message: err instanceof Error ? err.message : "unknown",
    });
  }
}
