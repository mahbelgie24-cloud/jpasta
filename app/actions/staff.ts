"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPin, pinLookup } from "@/lib/server/pin";
import { requireOwner, revokeUserSessions } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";

/**
 * Staff management (Phase 3, hardened in v2).
 *
 * PIN uniqueness is now a database guarantee: the HMAC lookup column has a
 * UNIQUE index, so two concurrent adds cannot create the same PIN. Every
 * credential/role change bumps session_version and revokes live sessions.
 */

export type StaffRow = {
  id: string;
  name: string;
  role: "owner" | "staff";
  isActive: boolean;
  createdAt: string;
};

const uuidSchema = z.string().uuid();
const pinSchema = z.string().regex(/^\d{6}$/, "الرمز يجب أن يكون ٦ أرقام.");

async function guard() {
  return requireOwner();
}

function fail(err: unknown, fallback: string) {
  return { ok: false as const, error: userMessageOf(err, fallback) };
}

export async function fetchStaff(): Promise<
  { ok: true; rows: StaffRow[] } | { ok: false; error: string }
> {
  try {
    await guard();
  } catch (err) {
    return { ok: false, error: userMessageOf(err) };
  }
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
  return {
    ok: true,
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

export async function addStaff(
  name: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const trimmed = name.trim();
    if (trimmed.length < 2) return { ok: false, error: "الاسم قصير جداً." };
    const parsedPin = pinSchema.safeParse(pin);
    if (!parsedPin.success)
      return { ok: false, error: "الرمز يجب أن يكون ٦ أرقام." };

    const lookup = await pinLookup(parsedPin.data);
    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.pinLookup, lookup))
      .limit(1);
    if (duplicate) {
      return { ok: false, error: "هذا الرمز مستخدم بالفعل — اختر رمزاً آخر." };
    }

    await db.insert(users).values({
      name: trimmed,
      role: "staff",
      pinHash: await hashPin(parsedPin.data),
      pinLookup: lookup,
    });
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر إضافة الموظف.");
  }
}

export async function resetStaffPin(
  id: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsedId = uuidSchema.safeParse(id);
    const parsedPin = pinSchema.safeParse(pin);
    if (!parsedId.success) return { ok: false, error: "موظف غير صحيح." };
    if (!parsedPin.success)
      return { ok: false, error: "الرمز يجب أن يكون ٦ أرقام." };

    const lookup = await pinLookup(parsedPin.data);
    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.pinLookup, lookup), ne(users.id, parsedId.data)))
      .limit(1);
    if (duplicate) {
      return { ok: false, error: "هذا الرمز مستخدم بالفعل — اختر رمزاً آخر." };
    }

    const rows = await db
      .update(users)
      .set({
        pinHash: await hashPin(parsedPin.data),
        pinLookup: lookup,
        // Invalidate every existing session for this user.
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, parsedId.data))
      .returning({ id: users.id });
    if (rows.length === 0) return { ok: false, error: "الموظف غير موجود." };
    await revokeUserSessions(parsedId.data);
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر تغيير الرمز.");
  }
}

export async function setStaffActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const owner = await guard();
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: "موظف غير صحيح." };
    if (parsedId.data === owner.id && !isActive) {
      return { ok: false, error: "لا يمكنك إيقاف حسابك أنت." };
    }

    if (!isActive) {
      const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, parsedId.data))
        .limit(1);
      if (target?.role === "owner") {
        const owners = await db
          .select({ id: users.id, isActive: users.isActive })
          .from(users)
          .where(eq(users.role, "owner"));
        if (owners.filter((o) => o.isActive).length <= 1) {
          return { ok: false, error: "لا بد من مالك نشط واحد على الأقل." };
        }
      }
    }

    const rows = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, parsedId.data))
      .returning({ id: users.id });
    if (rows.length === 0) return { ok: false, error: "الموظف غير موجود." };
    if (!isActive) await revokeUserSessions(parsedId.data);
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر تحديث الموظف.");
  }
}
