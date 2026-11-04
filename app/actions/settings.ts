"use server";

import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { deliveryZones, priceChanges, settings } from "@/db/schema";
import { SETTINGS_TAG } from "@/lib/server/settings";
import { requireOwner } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";
import { isPlausiblePhone } from "@/lib/domain/phone";

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
    const user = await guard();
    const parsedId = uuidSchema.safeParse(id);
    const parsedFee = zoneFeeSchema.safeParse(feeMinor);
    if (!parsedId.success) return { ok: false, error: "منطقة غير صحيحة." };
    if (!parsedFee.success)
      return { ok: false, error: "الرسوم بين 0 و 1000 ₪" };

    const outcome = await db.transaction(async (tx) => {
      const [zone] = await tx
        .select({ feeMinor: deliveryZones.feeMinor })
        .from(deliveryZones)
        .where(eq(deliveryZones.id, parsedId.data))
        .limit(1)
        .for("update");
      if (!zone) return "missing" as const;
      if (zone.feeMinor === parsedFee.data) return "ok" as const;

      await tx
        .update(deliveryZones)
        .set({ feeMinor: parsedFee.data })
        .where(eq(deliveryZones.id, parsedId.data));
      // A delivery fee is a price: every change leaves an audit row
      // (spec §9), exactly like a product price.
      await tx.insert(priceChanges).values({
        entityType: "delivery_zone",
        entityId: parsedId.data,
        oldMinor: zone.feeMinor,
        newMinor: parsedFee.data,
        changedBy: user.id,
      });
      return "ok" as const;
    });
    if (outcome === "missing")
      return { ok: false, error: "المنطقة غير موجودة." };
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

    const outcome = await db.transaction(async (tx) => {
      // Two concurrent deactivations could each see the other zone as
      // active and both commit, leaving zero active zones. Serialise the
      // whole delivery-zone configuration on one advisory lock.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('jpasta:delivery_zones'))`,
      );
      const [target] = await tx
        .select({ id: deliveryZones.id, isActive: deliveryZones.isActive })
        .from(deliveryZones)
        .where(eq(deliveryZones.id, parsedId.data))
        .limit(1);
      if (!target) return "missing" as const;

      if (!isActive && target.isActive) {
        const active = await tx
          .select({ id: deliveryZones.id })
          .from(deliveryZones)
          .where(eq(deliveryZones.isActive, true));
        if (active.length <= 1) return "last" as const;
      }
      await tx
        .update(deliveryZones)
        .set({ isActive })
        .where(eq(deliveryZones.id, parsedId.data));
      return "ok" as const;
    });

    if (outcome === "missing")
      return { ok: false, error: "المنطقة غير موجودة." };
    if (outcome === "last")
      return {
        ok: false,
        error: "لا بد من منطقة توصيل واحدة نشطة على الأقل.",
      };
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
    const user = await guard();
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

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(deliveryZones)
        .values({
          nameAr: name.data,
          feeMinor: fee.data,
          sortOrder: nextSort,
        })
        .returning({ id: deliveryZones.id });
      if (!row) throw new Error("تعذر إضافة المنطقة");
      await tx.insert(priceChanges).values({
        entityType: "delivery_zone",
        entityId: row.id,
        oldMinor: 0,
        newMinor: fee.data,
        changedBy: user.id,
      });
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

    const outcome = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('jpasta:delivery_zones'))`,
      );
      const [target] = await tx
        .select({ id: deliveryZones.id, isActive: deliveryZones.isActive })
        .from(deliveryZones)
        .where(eq(deliveryZones.id, parsedId.data))
        .limit(1);
      if (!target) return "missing" as const;

      if (target.isActive) {
        const active = await tx
          .select({ id: deliveryZones.id })
          .from(deliveryZones)
          .where(eq(deliveryZones.isActive, true));
        if (active.length <= 1) return "last" as const;
      }
      await tx.delete(deliveryZones).where(eq(deliveryZones.id, parsedId.data));
      return "ok" as const;
    });

    if (outcome === "missing")
      return { ok: false, error: "المنطقة غير موجودة." };
    if (outcome === "last")
      return { ok: false, error: "لا يمكن حذف المنطقة النشطة الوحيدة." };
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حذف المنطقة.");
  }
}

// ---------- Shop settings (hours, minimum, payments, flags) ----------

const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت بصيغة HH:mm");

const shopSettingsSchema = z.object({
  shopName: z.string().trim().min(2, "اسم المحل قصير جداً").max(60),
  shopPhone: z
    .string()
    .trim()
    .min(6, "رقم الهاتف قصير جداً")
    .max(20)
    .refine((value) => isPlausiblePhone(value, 6), "رقم الهاتف غير صحيح"),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "رقم واتساب يجب أن يكون أرقاماً دولية بدون +"),
  opensAt: clockSchema,
  closesAt: clockSchema,
  minOrderMinor: z.number().int().min(0).max(10_000_000),
  deliveryEtaMinutes: z.number().int().min(1).max(240),
  paymentMethods: z
    .array(z.enum(["cash", "card_terminal", "cash_on_delivery"]))
    .min(1, "طريقة دفع واحدة على الأقل."),
  orderingEnabled: z.boolean(),
  hoursLabel: z.string().trim().min(4, "نص الساعات قصير جداً").max(80),
  receiptFooter: z.string().trim().min(2, "النص قصير جداً").max(160),
});

export type ShopSettingsInput = z.input<typeof shopSettingsSchema>;

export async function updateShopSettings(
  input: ShopSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsed = shopSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة.",
      };
    }
    const d = parsed.data;
    const rows = [
      { key: "shop_name", value: d.shopName },
      { key: "shop_phone", value: d.shopPhone },
      { key: "whatsapp", value: d.whatsapp },
      { key: "opens_at", value: d.opensAt },
      { key: "closes_at", value: d.closesAt },
      { key: "min_order_minor", value: String(d.minOrderMinor) },
      { key: "delivery_eta_minutes", value: String(d.deliveryEtaMinutes) },
      { key: "payment_methods", value: d.paymentMethods.join(",") },
      { key: "ordering_enabled", value: String(d.orderingEnabled) },
      { key: "hours_label", value: d.hoursLabel },
      { key: "receipt_footer", value: d.receiptFooter },
    ];
    await db
      .insert(settings)
      .values(rows)
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value` },
      });
    // Pages read through the `settings` tag; the money path reads fresh.
    // updateTag (not revalidateTag): the owner must see their own write —
    // stale-while-revalidate would show the old minimum/flag for a while.
    updateTag(SETTINGS_TAG);
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/console/settings");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حفظ الإعدادات.");
  }
}
