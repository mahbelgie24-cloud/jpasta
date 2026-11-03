import { describe, expect, it } from "vitest";
import { nextIdempotencyScope, type IdempotencyScope } from "@/lib/idempotency";

describe("payload-bound idempotency scope", () => {
  it("reuses the key for an identical payload (safe retry)", () => {
    let n = 0;
    const generate = () => `key-${++n}`;
    const first = nextIdempotencyScope(null, "cart-A", generate);
    const retry = nextIdempotencyScope(first, "cart-A", generate);

    expect(first.key).toBe("key-1");
    expect(retry).toBe(first);
    expect(n).toBe(1);
  });

  it("rotates the key when the payload changes", () => {
    let n = 0;
    const generate = () => `key-${++n}`;
    const first = nextIdempotencyScope(null, "cart-A", generate);
    const edited = nextIdempotencyScope(first, "cart-B", generate);

    expect(edited.key).toBe("key-2");
    expect(edited.signature).toBe("cart-B");
    // The previous scope is untouched (the offline queue may still hold it).
    expect(first.key).toBe("key-1");
  });

  it("starts a new scope after a success resets the ref", () => {
    let n = 0;
    const generate = () => `key-${++n}`;
    const first = nextIdempotencyScope(null, "cart-A", generate);
    const cleared: IdempotencyScope | null = null;
    const next = nextIdempotencyScope(cleared, "cart-A", generate);

    expect(first.key).toBe("key-1");
    expect(next.key).toBe("key-2");
  });
});
