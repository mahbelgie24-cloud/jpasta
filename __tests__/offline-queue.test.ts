import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueOrder,
  flushOrders,
  pendingCount,
  resetQueueForTests,
  setCreatedAtForTests,
} from "@/lib/offline/queue";

/**
 * Offline queue (Phase 2 DoD): airplane-mode order entry syncs exactly once
 * on reconnect. The sender is mocked; the real sender is the
 * placeStorefrontOrder action whose idempotency UNIQUE constraint makes
 * replays exact-once on the server side.
 */

function payload(key: string) {
  return {
    idempotencyKey: key,
    channel: "takeaway",
    customer: { name: "زبون", phone: "0566064976", address: "" },
    lines: [],
  };
}

describe("offline order queue", () => {
  beforeEach(async () => {
    await resetQueueForTests();
  });

  it("flushes queued orders exactly once on reconnect", async () => {
    await enqueueOrder(payload("key-1"));
    await enqueueOrder(payload("key-2"));
    expect(await pendingCount()).toBe(2);

    const sender = vi.fn().mockResolvedValue({ ok: true });
    const result = await flushOrders(sender);

    expect(result.sent).toBe(2);
    expect(result.remaining).toBe(0);
    expect(sender).toHaveBeenCalledTimes(2);
    // the payload travels with its idempotency key — the server's UNIQUE
    // constraint is what makes a lost-response retry exact-once
    const firstCall = sender.mock.calls[0]?.[0] as { idempotencyKey: string };
    expect(firstCall.idempotencyKey).toBe("key-1");
  });

  it("keeps orders queued when the network is down (sender throws)", async () => {
    await enqueueOrder(payload("offline-1"));
    const sender = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await flushOrders(sender);

    expect(result.sent).toBe(0);
    expect(await pendingCount()).toBe(1);
  });

  it("retries explicit server rejections up to the cap, then drops", async () => {
    await enqueueOrder(payload("bad-1"));
    const sender = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "صنف لم يعد متوفراً" });

    await flushOrders(sender);
    let all = (await (
      await import("@/lib/offline/queue")
    ).pendingCount()) as number;
    expect(all).toBe(1);

    // 4 more flushes reach the 5-attempt cap → dropped
    for (let i = 0; i < 4; i += 1) {
      await flushOrders(sender);
    }
    all = (await (
      await import("@/lib/offline/queue")
    ).pendingCount()) as number;
    expect(all).toBe(0);
    expect(sender).toHaveBeenCalledTimes(5);
  });

  it("flushes oldest-first and stops at the first network failure", async () => {
    const keys = ["a", "b", "c"];
    let t = 1000;
    for (const k of keys) {
      await enqueueOrder(payload(k));
      await setCreatedAtForTests(k, t);
      t += 10;
    }

    const sentKeys: string[] = [];
    const sender = vi
      .fn()
      .mockImplementation((payload: { idempotencyKey: string }) => {
        sentKeys.push(payload.idempotencyKey);
        if (payload.idempotencyKey === "b")
          return Promise.reject(new TypeError("fetch failed"));
        return Promise.resolve({ ok: true });
      });
    const result = await flushOrders(sender);

    // "a" sent, "b" failed → flush stopped before "c"
    expect(sentKeys).toEqual(["a", "b"]);
    expect(result.sent).toBe(1);
    expect(result.remaining).toBe(2);
  });
});
