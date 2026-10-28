import "server-only";
import { bus, ORDERS_CHANGED } from "./bus";

/**
 * Realtime fan-out contract.
 *
 * Production: Cloudflare Durable Object (OrderFeed) — one instance per shop,
 * reachable from every isolate, with hibernatable WebSockets.
 * Local Node: the in-process event bus (single process, so it is exact).
 *
 * Call sites only ever use notifyOrdersChanged(), after the DB transaction
 * has committed.
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
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as {
      ORDER_FEED?: DurableObjectNamespaceLike;
    };
    if (env.ORDER_FEED) {
      const stub = env.ORDER_FEED.get(env.ORDER_FEED.idFromName("jpasta"));
      await stub.fetch("https://order-feed/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at }),
      });
      return;
    }
  } catch {
    // Node runtime (next dev / next start / vitest) — fall through to the bus.
  }
  bus.emit(ORDERS_CHANGED, at);
}
