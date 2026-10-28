import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import {
  hashPin,
  hashToken,
  newSessionToken,
  pinLookup,
  verifyPin,
} from "./pin";
import {
  checkLoginThrottle,
  clearLoginFailures,
  recordLoginFailure,
} from "./auth-throttle";

/**
 * Server session (spec §8.5, hardened in v2):
 *  - PIN lookup is O(1) via users.pin_lookup (HMAC + unique index)
 *  - login is throttled in the DB (all isolates) and by the Workers binding
 *  - sessions are opaque 32-byte tokens, sha256-hashed at rest
 *  - users.session_version invalidates every session on PIN/role change
 *  - absolute 7-day expiry + 12-hour idle timeout
 *  - __Host- cookie in production
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_TTL_MS = 12 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-jpasta_session"
    : "jpasta_session";

export interface SessionUser {
  id: string;
  name: string;
  role: "owner" | "staff";
}

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string; retryAfterSec?: number };

export function loginThrottleKeys(ip: string): string[] {
  const clean = ip.trim().slice(0, 64) || "unknown";
  return [`ip:${clean}`, "global"];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        eq(sessions.userVersion, users.sessionVersion),
        gt(sessions.expiresAt, new Date()),
        gt(sessions.lastSeenAt, new Date(Date.now() - IDLE_TTL_MS)),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;

  if (row.lastSeenAt.getTime() < Date.now() - TOUCH_INTERVAL_MS) {
    // Sliding idle window — one write per 10 minutes per user at most.
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)));
  }

  return { id: row.id, name: row.name, role: row.role };
}

export async function loginWithPin(
  pin: string,
  meta: { ip: string },
): Promise<LoginResult> {
  const normalized = pin.trim();
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false, error: "الرمز يجب أن يكون ٦ أرقام." };
  }

  const throttleKeys = loginThrottleKeys(meta.ip);
  const throttle = await checkLoginThrottle(throttleKeys);
  if (!throttle.allowed) {
    return {
      ok: false,
      error: "محاولات كثيرة — انتظر قليلاً ثم حاول مرة أخرى.",
      retryAfterSec: throttle.retryAfterSec,
    };
  }

  const lookup = await pinLookup(normalized);
  let [user] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      pinHash: users.pinHash,
      pinLookup: users.pinLookup,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(and(eq(users.pinLookup, lookup), eq(users.isActive, true)))
    .limit(1);

  // Migration bridge: rows created before v2 carry a unique "legacy:" key.
  // We verify against their scrypt hash and upgrade the lookup on success,
  // so no PIN needs to be known at migration time.
  if (!user) {
    const legacyRows = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        pinHash: users.pinHash,
        pinLookup: users.pinLookup,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(and(like(users.pinLookup, "legacy:%"), eq(users.isActive, true)));
    let match: (typeof legacyRows)[number] | null = null;
    for (const row of legacyRows) {
      if (await verifyPin(normalized, row.pinHash)) {
        match = row;
        break;
      }
    }
    if (match) {
      try {
        const upgradedHash = await hashPin(normalized);
        await db
          .update(users)
          .set({ pinLookup: lookup, pinHash: upgradedHash })
          .where(eq(users.id, match.id));
        match.pinHash = upgradedHash;
      } catch {
        // Another concurrent login upgraded first — the lookup below still works.
      }
      user = match;
    }
  }

  const pinOk = user ? await verifyPin(normalized, user.pinHash) : false;
  if (!user || !pinOk) {
    await recordLoginFailure(throttleKeys);
    return { ok: false, error: "الرمز غير صحيح." };
  }

  await clearLoginFailures(throttleKeys);

  const token = newSessionToken();
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    userVersion: user.sessionVersion,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return {
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
  };
}

/** Any authenticated console user. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthenticated");
  return user;
}

/** Owner-only gate. Always await this — an un-awaited guard is a no-op. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireStaff();
  if (user.role !== "owner") throw new Error("owner-only");
  return user;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(COOKIE_NAME);
}

/** Invalidate every session for a user (role change, PIN change, deactivate). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export { COOKIE_NAME };
