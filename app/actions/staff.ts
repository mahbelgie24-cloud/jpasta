"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPin, verifyPin } from "@/lib/server/pin";
import { requireOwner } from "@/lib/server/session";

/**
 * Staff management (Phase 3). The PIN-uniqueness guardrail (spec §8.1,
 * inherited from Ayasofia): a new PIN is checked against every other active
 * user's hash with the same verifyPin used at login — a duplicate PIN would
 * otherwise sign the wrong person in.
 */

export type StaffRow = {
  id: string;
  name: string;
  role: "owner" | "staff";
  isActive: boolean;
  createdAt: string;
};

async function guard() {
  return requireOwner();
}

export async function fetchStaff(): Promise<
  { ok: true; rows: StaffRow[] } | { ok: false; error: string }
> {
  try {
    await guard();
  } catch {
    return { ok: false, error: "إدارة الموظفين للمالك فقط." };
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
  } catch {
    return { ok: false, error: "إضافة موظف للمالك فقط." };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "الاسم قصير جداً." };
  if (!/^\d{6}$/.test(pin))
    return { ok: false, error: "الرمز يجب أن يكون 6 أرقام." };

  // PIN uniqueness among active users (spec §8.1 guardrail)
  const actives = await db
    .select({ pinHash: users.pinHash })
    .from(users)
    .where(eq(users.isActive, true));
  for (const row of actives) {
    if (verifyPin(pin, row.pinHash)) {
      return { ok: false, error: "هذا الرمز مستخدم بالفعل — اختر رمزاً آخر." };
    }
  }

  await db
    .insert(users)
    .values({ name: trimmed, role: "staff", pinHash: hashPin(pin) });
  return { ok: true };
}

export async function setStaffActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  let owner;
  try {
    owner = await guard();
  } catch {
    return { ok: false, error: "إدارة الموظفين للمالك فقط." };
  }
  if (id === owner.id && !isActive) {
    return { ok: false, error: "لا يمكنك إيقاف حسابك أنت." };
  }
  if (!isActive) {
    // never lock all owners out of the console
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (target?.role === "owner") {
      const activeOwners = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "owner"));
      const activeOwnerRows = await db
        .select({ id: users.id, isActive: users.isActive })
        .from(users)
        .where(eq(users.role, "owner"));
      void activeOwners;
      if (activeOwnerRows.filter((o) => o.isActive).length <= 1) {
        return { ok: false, error: "لا بد من مالك نشط واحد على الأقل." };
      }
    }
  }
  await db.update(users).set({ isActive }).where(eq(users.id, id));
  return { ok: true };
}
