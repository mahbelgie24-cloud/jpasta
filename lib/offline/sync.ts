"use client";

import {
  enqueueOrder,
  flushOrders,
  pendingCount,
  type SendResult,
} from "@/lib/offline/queue";

/**
 * Auto-sync wiring (Phase 2): called once from the storefront shell.
 * When connectivity returns, every queued order replays through the
 * sender (the placeStorefrontOrder action) with its original
 * idempotencyKey — the server's UNIQUE constraint makes the replay
 * exact-once (returns the original order, never a duplicate sale).
 */

export type Sender = (payload: unknown) => Promise<SendResult>;

export function registerOfflineSync(sender: Sender): () => void {
  const flush = () => {
    void flushOrders(sender).then((res) => {
      if (res.sent > 0) {
        // nudge any open UI via a storage event the drawer can listen for
        window.dispatchEvent(
          new CustomEvent("jpasta:orders-synced", { detail: res }),
        );
      }
    });
  };
  const flushIfOnline = () => {
    if (navigator.onLine) flush();
  };
  window.addEventListener("online", flushIfOnline);
  // also try once on registration (covers reload-after-offline)
  flushIfOnline();
  return () => window.removeEventListener("online", flushIfOnline);
}

export { enqueueOrder, pendingCount, flushOrders };
