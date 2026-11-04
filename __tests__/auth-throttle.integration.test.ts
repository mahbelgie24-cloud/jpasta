import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { loginAttempts } from "@/db/schema";
import {
  checkLoginThrottle,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/server/auth-throttle";
import { loginThrottleKeys } from "@/lib/server/session";
import { testDatabaseUrl } from "@/test/db";

/**
 * Regression: a 6-digit PIN is only safe because the DB throttle locks an
 * attacker out after a bounded number of failures. The previous ladder
 * reset `failedCount` to 1 whenever the row had no active lock, so the
 * threshold was never reached and the "lockout" was dead code.
 */

const DB_READY = Boolean(testDatabaseUrl());
const d = DB_READY ? describe : describe.skip;

d("login throttle", () => {
  const keys = loginThrottleKeys(`test-${crypto.randomUUID()}`);

  beforeEach(async () => {
    await clearLoginFailures(keys);
  });

  afterAll(async () => {
    await clearLoginFailures(keys);
    await pool.end();
  });

  it("locks the per-IP key after the failure threshold and reports retry-after", async () => {
    for (let i = 0; i < 8; i += 1) {
      const before = await checkLoginThrottle(keys);
      expect(before.allowed).toBe(true);
      await recordLoginFailure(keys);
    }

    const locked = await checkLoginThrottle(keys);
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterSec).toBeGreaterThan(0);
    expect(locked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("clears the ladder on a successful login", async () => {
    await recordLoginFailure(keys);
    await recordLoginFailure(keys);
    await clearLoginFailures(keys);

    const state = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.key, keys[0] ?? ""));
    expect(state).toHaveLength(0);
  });

  it("resets to a one-minute window after a lock expires", async () => {
    for (let i = 0; i < 8; i += 1) await recordLoginFailure(keys);
    await expect(checkLoginThrottle(keys)).resolves.toMatchObject({
      allowed: false,
    });

    // Simulate an expired lock; the next failure must start a fresh ladder
    // instead of instantly re-locking for an hour.
    await db
      .update(loginAttempts)
      .set({ lockedUntil: new Date(Date.now() - 1000) })
      .where(eq(loginAttempts.key, keys[0] ?? ""));

    await expect(checkLoginThrottle(keys)).resolves.toMatchObject({
      allowed: true,
    });
    await recordLoginFailure(keys);

    const [row] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.key, keys[0] ?? ""));
    expect(row?.failedCount).toBe(1);
    expect(row?.lockedUntil).toBeNull();
  });
});
