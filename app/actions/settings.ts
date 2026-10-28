"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { deliveryZones } from "@/db/schema";
import { requireOwner } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";

/**
 * Delivery-zone settings (Phase 2) — the owner edits fees without a deploy.
 * Every action is owner-gated on the SERVER (a cashier must never be able to
 * change a money-affecting fee), validated with zod, and reports a real
 * failure when the id matches zero rows.
 */

const uuidSchema = z.string().uuid();
const zoneFeeSchema = z.number().int().min(0).max(100000); // ₪0 – ₪1000.00
const zoneNameSchema = z.string().trim().min(2).max(60);

async function guard() {
  return requireOwner();
}

function fail(err: unknown, fallback: string) {
  return { ok: false as const, error: userMessageOf(err, fallback) };
}

export async function fetchZones() {
  await guard();
  const zones = await db
    .select()
    .from(deliveryZones)
    .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.feeMinor));
  return zones.map((z) => ({
    id: z.id,
    nameAr: z.nameAr,
    feeMinor: z.feeMinor,
    sortOrder: z.sortOrder,
    isActive: z.isActive,
  }));
}

export async function updateZoneFee(
  id: string,
  feeMinor: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsedId = uuidSchema.safeParse(id);
    const parsedFee = zoneFeeSchema.safeParse(feeMinor);
    if (!parsedId.success) return { ok: false, error: "منطقة غير صحيحة." };
    if (!parsedFee.success)
      return { ok: false, error: "الرسوم بين 0 و 1000 ₪" };
    const rows = await db
      .update(deliveryZones)
      .set({ feeMinor: parsedFee.data })
      .where(eq(deliveryZones.id, parsedId.data))
      .returning({ id: deliveryZones.id });
    if (rows.length === 0) return { ok: false, error: "المنطقة غير موجودة." };
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حفظ الرسوم.");
  }
}

export async function updateZoneName(
  id: string,
  nameAr: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsedId = uuidSchema.safeParse(id);
    const parsedName = zoneNameSchema.safeParse(nameAr);
    if (!parsedId.success) return { ok: false, error: "منطقة غير صحيحة." };
    if (!parsedName.success)
      return { ok: false, error: "اسم المنطقة قصير جداً" };
    const rows = await db
      .update(deliveryZones)
      .set({ nameAr: parsedName.data })
      .where(eq(deliveryZones.id, parsedId.data))
      .returning({ id: deliveryZones.id });
    if (rows.length === 0) return { ok: false, error: "المنطقة غير موجودة." };
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حفظ الاسم.");
  }
}

export async function setZoneActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: "منطقة غير صحيحة." };

    if (!isActive) {
      const all = await db
        .select({ id: deliveryZones.id })
        .from(deliveryZones)
        .where(eq(deliveryZones.isActive, true));
      if (all.length <= 1 && all.some((z) => z.id === parsedId.data)) {
        return {
          ok: false,
          error: "لا بد من منطقة توصيل واحدة نشطة على الأقل.",
        };
      }
    }
    const rows = await db
      .update(deliveryZones)
      .set({ isActive })
      .where(eq(deliveryZones.id, parsedId.data))
      .returning({ id: deliveryZones.id });
    if (rows.length === 0) return { ok: false, error: "المنطقة غير موجودة." };
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر تحديث المنطقة.");
  }
}

export async function addZone(
  nameAr: string,
  feeMinor: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const name = zoneNameSchema.safeParse(nameAr);
    const fee = zoneFeeSchema.safeParse(feeMinor);
    if (!name.success) return { ok: false, error: "اسم المنطقة قصير جداً" };
    if (!fee.success) return { ok: false, error: "الرسوم بين 0 و 1000 ₪" };

    const existing = await db
      .select({ sortOrder: deliveryZones.sortOrder })
      .from(deliveryZones)
      .orderBy(asc(deliveryZones.sortOrder));
    const nextSort =
      (existing.at(-1)?.sortOrder ?? 0) + (existing.length > 0 ? 1 : 0);

    await db.insert(deliveryZones).values({
      nameAr: name.data,
      feeMinor: fee.data,
      sortOrder: nextSort,
    });
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر إضافة المنطقة.");
  }
}

export async function deleteZone(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: "منطقة غير صحيحة." };
    const all = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true));
    if (all.length <= 1 && all.some((z) => z.id === parsedId.data)) {
      return {
        ok: false,
        error: "لا يمكن حذف المنطقة النشطة الوحيدة.",
      };
    }
    await db.delete(deliveryZones).where(eq(deliveryZones.id, parsedId.data));
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حذف المنطقة.");
  }
}
