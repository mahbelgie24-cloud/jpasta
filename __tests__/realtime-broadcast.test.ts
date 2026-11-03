import { describe, expect, it } from "vitest";
import {
  isAuthorizedBroadcast,
  isFreshBroadcastTimestamp,
} from "@/lib/domain/realtime-token";

/**
 * The Durable Object's /broadcast route is a privileged fan-out primitive.
 * These pure guards are what the DO uses before touching a socket.
 */
describe("realtime broadcast guards", () => {
  it("requires the exact bearer secret", () => {
    expect(isAuthorizedBroadcast("Bearer super-secret", "super-secret")).toBe(
      true,
    );
    expect(isAuthorizedBroadcast("Bearer super-secret", "other")).toBe(false);
    expect(isAuthorizedBroadcast(null, "super-secret")).toBe(false);
    expect(isAuthorizedBroadcast("Bearer super-secret", undefined)).toBe(false);
    expect(isAuthorizedBroadcast("Basic super-secret", "super-secret")).toBe(
      false,
    );
  });

  it("rejects implausible broadcast timestamps", () => {
    const now = 1_700_000_000_000;
    expect(isFreshBroadcastTimestamp(undefined, now)).toBe(true);
    expect(isFreshBroadcastTimestamp(now - 1_000, now)).toBe(true);
    expect(isFreshBroadcastTimestamp(now + 10 * 60_000, now)).toBe(false);
    expect(isFreshBroadcastTimestamp("not-a-number", now)).toBe(false);
    expect(isFreshBroadcastTimestamp(Number.NaN, now)).toBe(false);
  });
});
