import Dexie, { type EntityTable } from "dexie";

/**
 * Offline order queue (Phase 2, spec §13 NFR) — IndexedDB via Dexie.
 *
 * Exact-once guarantee: every queued payload carries its own
 * idempotencyKey, and the server enforces it with a UNIQUE constraint.
 * If a send succeeds but the response is lost (offline right after
 * commit), the retry replays the SAME key and the server returns the
 * original order — a retried sync can never duplicate a sale.
 */

export interface QueuedOrder {
  idempotencyKey: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const db = new Dexie("jpasta-offline") as Dexie & {
  pendingOrders: EntityTable<QueuedOrder, "idempotencyKey">;
};

db.version(1).stores({ pendingOrders: "idempotencyKey, createdAt" });

/** A payload is dropped (with its error kept in console) after this many explicit server rejections. */
const MAX_ATTEMPTS = 5;

export type SendResult = { ok: boolean; error?: string };
export type FlushResult = { sent: number; dropped: number; remaining: number };

export async function enqueueOrder(payload: {
  idempotencyKey: string;
}): Promise<void> {
  await db.pendingOrders.put({
    idempotencyKey: payload.idempotencyKey,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  });
}

export async function pendingCount(): Promise<number> {
  return db.pendingOrders.count();
}

/**
 * Sends every queued order oldest-first through the injected sender
 * (the placeStorefrontOrder server action in the app; a mock in tests).
 * A network throw stops the flush immediately — remaining orders stay
 * queued for the next `online` event.
 */
export async function flushOrders(
  send: (payload: unknown) => Promise<SendResult>,
): Promise<FlushResult> {
  const items = await db.pendingOrders.orderBy("createdAt").toArray();
  let sent = 0;
  let dropped = 0;

  for (const item of items) {
    try {
      const res = await send(item.payload);
      if (res.ok) {
        await db.pendingOrders.delete(item.idempotencyKey);
        sent += 1;
        continue;
      }
      // explicit server rejection — retry with backoff-capped attempts,
      // then drop (a malformed payload never becomes a sale)
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await db.pendingOrders.delete(item.idempotencyKey);
        dropped += 1;
        console.error(
          "offline queue: dropped after max attempts",
          item.idempotencyKey,
          res.error,
        );
      } else {
        await db.pendingOrders.update(item.idempotencyKey, {
          attempts,
          lastError: res.error,
        });
      }
    } catch {
      // network failure — stop here; the rest waits for connectivity
      break;
    }
  }

  return { sent, dropped, remaining: await db.pendingOrders.count() };
}

/** Test-only: wipe the queue between test cases. */
export async function resetQueueForTests(): Promise<void> {
  await db.pendingOrders.clear();
}

/** Test-only: pin a queue item's createdAt to control flush ordering. */
export async function setCreatedAtForTests(
  idempotencyKey: string,
  createdAt: number,
): Promise<void> {
  await db.pendingOrders.update(idempotencyKey, { createdAt });
}
