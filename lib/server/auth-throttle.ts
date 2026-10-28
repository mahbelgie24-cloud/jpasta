import "server-only";
import { inArray, sql } from "drizzle-orm";
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
 */

const MAX_FAILS_BEFORE_LOCK = 8;
const GLOBAL_MAX_FAILS = 60;

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

export async function recordLoginFailure(keys: string[]): Promise<void> {
  const globalThreshold =
    keys.find((k) => k === "global") !== undefined
      ? GLOBAL_MAX_FAILS
      : MAX_FAILS_BEFORE_LOCK;
  for (const key of keys) {
    const threshold =
      key === "global" ? globalThreshold : MAX_FAILS_BEFORE_LOCK;
    await db
      .insert(loginAttempts)
      .values({ key, failedCount: 1 })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: {
          failedCount: sql`${loginAttempts.failedCount} + 1`,
          updatedAt: new Date(),
          lockedUntil: sql`
            case
              when ${loginAttempts.failedCount} + 1 >= ${threshold}
              then now() + (
                case
                  when ${loginAttempts.failedCount} + 1 - ${threshold} <= 0 then interval '1 minute'
                  when ${loginAttempts.failedCount} + 1 - ${threshold} = 1 then interval '5 minutes'
                  when ${loginAttempts.failedCount} + 1 - ${threshold} = 2 then interval '15 minutes'
                  else interval '60 minutes'
                end
              )
              else ${loginAttempts.lockedUntil}
            end
          `,
        },
      });
  }
}

export async function clearLoginFailures(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
}
