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
  it("requires the exact bearer secret and a full-strength secret", () => {
    const strong = "a".repeat(32);
    expect(isAuthorizedBroadcast(`Bearer ${strong}`, strong)).toBe(true);
    expect(isAuthorizedBroadcast(`Bearer ${strong}`, "b".repeat(32))).toBe(
      false,
    );
    expect(isAuthorizedBroadcast(null, strong)).toBe(false);
    expect(isAuthorizedBroadcast(`Bearer ${strong}`, undefined)).toBe(false);
    expect(isAuthorizedBroadcast(`Basic ${strong}`, strong)).toBe(false);
    // A short secret must never authorize the fan-out, even if it matches.
    expect(isAuthorizedBroadcast("Bearer short", "short")).toBe(false);
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
