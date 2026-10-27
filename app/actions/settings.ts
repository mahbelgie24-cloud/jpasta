"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliveryZones } from "@/db/schema";
import { getSessionUser } from "@/lib/server/session";

/**
 * Delivery-zone settings (Phase 2) — the owner edits fees without a deploy.
 * Every action re-checks the session server-side (AGENTS.md RBAC rule).
 */

const zoneFeeSchema = z.number().int().min(0).max(100000); // ₪0 – ₪1000.00
const zoneNameSchema = z.string().trim().min(2).max(60);

async function guard() {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthenticated");
  return user;
}

export async function fetchZones() {
  await guard();
  const zones = await db
    .select()
    .from(deliveryZones)
    .orderBy(asc(deliveryZones.feeMinor));
  return zones.map((z) => ({
    id: z.id,
    nameAr: z.nameAr,
    feeMinor: z.feeMinor,
    isActive: z.isActive,
  }));
}

export async function updateZoneFee(
  id: string,
  feeMinor: number,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const parsed = zoneFeeSchema.safeParse(feeMinor);
  if (!parsed.success) return { ok: false, error: "الرسوم بين 0 و 1000 ₪" };
  await db
    .update(deliveryZones)
    .set({ feeMinor: parsed.data })
    .where(eq(deliveryZones.id, id));
  return { ok: true };
}

export async function setZoneActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  // keep at least one active zone — the storefront delivery fee depends on it
  if (!isActive) {
    const all = await db
      .select()
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true));
    if (all.length <= 1 && all.some((z) => z.id === id)) {
      return { ok: false, error: "لا بد من منطقة توصيل واحدة نشطة على الأقل" };
    }
  }
  await db
    .update(deliveryZones)
    .set({ isActive })
    .where(eq(deliveryZones.id, id));
  return { ok: true };
}

export async function addZone(
  nameAr: string,
  feeMinor: number,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const name = zoneNameSchema.safeParse(nameAr);
  const fee = zoneFeeSchema.safeParse(feeMinor);
  if (!name.success) return { ok: false, error: "اسم المنطقة قصير جداً" };
  if (!fee.success) return { ok: false, error: "الرسوم بين 0 و 1000 ₪" };
  await db
    .insert(deliveryZones)
    .values({ nameAr: name.data, feeMinor: fee.data });
  return { ok: true };
}
