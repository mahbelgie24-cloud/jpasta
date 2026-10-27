import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import { hashToken, newSessionToken, verifyPin } from "./pin";

/**
 * Server session (spec §8.5): PIN credentials, DB-backed opaque tokens
 * (sha256-hashed at rest) in HttpOnly cookies. Phase 3: staff accounts
 * share the same login; what each role may DO is enforced server-side per
 * action/page by requireOwner() — the UI hiding links is never the boundary.
 */

const COOKIE_NAME = "jpasta_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  role: "owner" | "staff";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function loginWithPin(pin: string): Promise<boolean> {
  if (!/^\d{6}$/.test(pin)) return false;
  const candidates = await db
    .select({ id: users.id, pinHash: users.pinHash })
    .from(users)
    .where(eq(users.isActive, true));
  for (const user of candidates) {
    if (verifyPin(pin, user.pinHash)) {
      const token = newSessionToken();
      await db.insert(sessions).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      const store = await cookies();
      store.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_MS / 1000,
      });
      return true;
    }
  }
  return false;
}

/** Owner-only gate — throws "owner-only"; pages redirect, actions reject. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") {
    throw new Error("owner-only");
  }
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
