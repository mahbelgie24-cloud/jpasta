import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts } from "@/db/schema";

/**
 * Login throttle — layered:
 *  1. Workers rate-limit binding (per-colo, fast, in app/actions/console.ts)
 *  2. this durable DB counter (global across isolates), so a distributed
 *     attempt cannot bypass the per-colo limiter.
 *
 * A 6-digit PIN is only safe with a hard attempt budget. We fail closed:
 * if the throttle store is unavailable, login is refused rather than
 * silently allowed.
 *
 * Availability matters too: the global row is a shared budget, so it locks
 * for a flat minute instead of escalating. Otherwise a remote attacker could
 * send a handful of wrong PINs from anywhere and lock the owner out of the
 * console for an hour (a trivial denial of service on a single-shop system).
 */

const MAX_FAILS_BEFORE_LOCK = 8;
const GLOBAL_MAX_FAILS = 200;
const GLOBAL_LOCK_MS = 60_000;

export interface ThrottleResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export async function checkLoginThrottle(
  keys: string[],
): Promise<ThrottleResult> {
  if (keys.length === 0) return { allowed: true };
  const rows = await db
    .select({
      key: loginAttempts.key,
      failedCount: loginAttempts.failedCount,
      lockedUntil: loginAttempts.lockedUntil,
    })
    .from(loginAttempts)
    .where(inArray(loginAttempts.key, keys));
  const now = Date.now();
  let retry = 0;
  for (const row of rows) {
    if (row.lockedUntil && row.lockedUntil.getTime() > now) {
      retry = Math.max(
        retry,
        Math.ceil((row.lockedUntil.getTime() - now) / 1000),
      );
    }
  }
  if (retry > 0) return { allowed: false, retryAfterSec: retry };
  return { allowed: true };
}

/** Progressive lockout: 1m → 5m → 15m → 1h (per-key). */
function lockDurationMs(excess: number): number {
  if (excess <= 0) return 60_000;
  if (excess === 1) return 5 * 60_000;
  if (excess === 2) return 15 * 60_000;
  return 60 * 60_000;
}

export async function recordLoginFailure(keys: string[]): Promise<void> {
  for (const key of keys) {
    await db.transaction(async (tx) => {
      // Serialise concurrent failures for this key, then decide the next
      // count in JS (clearer than a nested CASE and portable).
      const [row] = await tx
        .select()
        .from(loginAttempts)
        .where(eq(loginAttempts.key, key))
        .for("update");

      const now = Date.now();
      // A row with no lock is a ladder in progress — keep counting. Only an
      // expired lock resets it: the next failure then starts a fresh
      // 1-minute window instead of instantly re-locking for an hour.
      const lockExpired = Boolean(
        row?.lockedUntil && row.lockedUntil.getTime() <= now,
      );
      const nextCount = !row || lockExpired ? 1 : row.failedCount + 1;
      const threshold =
        key === "global" ? GLOBAL_MAX_FAILS : MAX_FAILS_BEFORE_LOCK;

      let lockedUntil = lockExpired ? null : (row?.lockedUntil ?? null);
      if (nextCount >= threshold) {
        lockedUntil = new Date(
          now +
            (key === "global"
              ? GLOBAL_LOCK_MS
              : lockDurationMs(nextCount - threshold)),
        );
      }

      await tx
        .insert(loginAttempts)
        .values({ key, failedCount: nextCount, lockedUntil })
        .onConflictDoUpdate({
          target: loginAttempts.key,
          set: { failedCount: nextCount, lockedUntil, updatedAt: new Date() },
        });
    });
  }
}

export async function clearLoginFailures(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
}
