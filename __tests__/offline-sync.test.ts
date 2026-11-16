import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * registerOfflineSync — the wiring between the browser's online event and
 * the queue flush. queue.ts owns the exactly-once guarantee; this proves
 * the listener registers once, flushes on reconnect + initial mount, and
 * announces synced counts for the UI toast.
 */

const flushOrders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/offline/queue", () => ({
  flushOrders: (...args: unknown[]) => flushOrders(...args),
  enqueueOrder: vi.fn(),
  pendingCount: vi.fn(async () => 0),
}));

type Listener = (event: Event) => void;

class FakeWindow {
  listeners = new Map<string, Set<Listener>>();
  navigatorRef = { onLine: true };
  dispatched: Array<{ type: string; detail?: unknown }> = [];

  addEventListener(type: string, fn: Listener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(event: Event): boolean {
    this.dispatched.push({
      type: event.type,
      detail: (event as CustomEvent).detail,
    });
    for (const fn of this.listeners.get(event.type) ?? []) fn(event);
    return true;
  }

  fireOnline() {
    this.navigatorRef.onLine = true;
    for (const fn of this.listeners.get("online") ?? []) {
      fn(new Event("online"));
    }
  }
}

describe("registerOfflineSync", () => {
  let fakeWindow: FakeWindow;

  beforeEach(() => {
    fakeWindow = new FakeWindow();
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("navigator", fakeWindow.navigatorRef);
    flushOrders.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flushes on reconnect and on initial registration, once per listener", async () => {
    flushOrders.mockResolvedValue({ sent: 0, dropped: 0 });
    const { registerOfflineSync } = await import("@/lib/offline/sync");
    const dispose = registerOfflineSync(vi.fn());

    // Initial registration flush (covers reload-after-offline).
    expect(flushOrders).toHaveBeenCalledTimes(1);

    fakeWindow.fireOnline();
    await vi.waitFor(() => expect(flushOrders).toHaveBeenCalledTimes(2));

    dispose();
    fakeWindow.fireOnline();
    // The listener is gone — no flush after disposal.
    expect(flushOrders).toHaveBeenCalledTimes(2);
  });

  it("skips the flush while offline and announces the synced count", async () => {
    flushOrders.mockResolvedValue({ sent: 2, dropped: 0 });
    fakeWindow.navigatorRef.onLine = false;
    const { registerOfflineSync } = await import("@/lib/offline/sync");
    const dispose = registerOfflineSync(vi.fn());

    // Registered while offline: the initial flush is skipped (nothing to
    // send yet). The reconnect fires exactly one flush.
    expect(flushOrders).not.toHaveBeenCalled();

    fakeWindow.fireOnline();
    await vi.waitFor(() => expect(flushOrders).toHaveBeenCalledTimes(1));

    const synced = fakeWindow.dispatched.find(
      (d) => d.type === "jpasta:orders-synced",
    );
    expect(synced?.detail).toEqual({ sent: 2, dropped: 0 });
    dispose();
  });
});
