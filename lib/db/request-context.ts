import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request DB context for Cloudflare Workers.
 *
 * A pooled Postgres socket is an I/O object and can only be used by the
 * request that created it. The custom worker entry opens this store around
 * every Next.js request; `lib/db` creates one client inside it and discards
 * it with the store. Node scripts/tests have no store and keep a singleton.
 *
 * The AsyncLocalStorage instance lives on `globalThis` because the worker
 * entry and the generated Next.js bundle are separate modules that must
 * share the same store.
 */
export interface DbRequestStore {
  db?: unknown;
}

const globalForCtx = globalThis as {
  jpastaDbStore?: AsyncLocalStorage<DbRequestStore>;
};

export const dbRequestStore = (globalForCtx.jpastaDbStore ??=
  new AsyncLocalStorage<DbRequestStore>());

export function withDbRequest<T>(fn: () => Promise<T>): Promise<T> {
  return dbRequestStore.run({}, fn);
}
