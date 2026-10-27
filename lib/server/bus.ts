import "server-only";
import { EventEmitter } from "node:events";

/**
 * In-process event bus for realtime push (Phase 2).
 *
 * Next.js on Node runs as a single long-lived process, so a server action
 * can wake every connected console stream instantly (~0ms after commit).
 * On Cloudflare Workers this swaps to a Durable Object broadcast behind the
 * same notifyOrdersChanged() contract — call sites never change.
 */
const globalForBus = globalThis as unknown as { jpastaBus?: EventEmitter };

export const bus = globalForBus.jpastaBus ?? new EventEmitter();
bus.setMaxListeners(100);
globalForBus.jpastaBus = bus;

export const ORDERS_CHANGED = "orders-changed";

export function notifyOrdersChanged(): void {
  bus.emit(ORDERS_CHANGED, Date.now());
}
