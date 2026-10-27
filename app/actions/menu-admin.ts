"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { priceChanges, products } from "@/db/schema";
import { getSessionUser } from "@/lib/server/session";

/**
 * Menu manager v1 (Phase 3): availability toggles + price edits.
 * Every price change writes an audit row (old → new, who, when) — spec §9.
 */

export type AdminProduct = {
  id: string;
  nameAr: string;
  categoryNameAr: string;
  basePriceMinor: number;
  isAvailable: boolean;
};

async function guard() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") throw new Error("owner-only");
  return user;
}

export async function fetchAdminProducts(): Promise<
  { ok: true; rows: AdminProduct[] } | { ok: false; error: string }
> {
  try {
    await guard();
  } catch {
    return { ok: false, error: "إدارة القائمة للمالك فقط." };
  }
  const { categories } = await import("@/db/schema");
  const rows = await db
    .select({
      id: products.id,
      nameAr: products.nameAr,
      categoryNameAr: categories.nameAr,
      basePriceMinor: products.basePriceMinor,
      isAvailable: products.isAvailable,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(asc(products.sortOrder));
  return { ok: true, rows };
}

export async function setProductAvailability(
  id: string,
  isAvailable: boolean,
): Promise<{ ok: boolean; error?: string }> {
  let user;
  try {
    user = await guard();
  } catch {
    return { ok: false, error: "إدارة القائمة للمالك فقط." };
  }
  void user;
  await db.update(products).set({ isAvailable }).where(eq(products.id, id));
  return { ok: true };
}

export async function setProductPrice(
  id: string,
  newMinor: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await guard().catch(() => null);
  if (!user) return { ok: false, error: "إدارة القائمة للمالك فقط." };
  if (!Number.isInteger(newMinor) || newMinor < 0 || newMinor > 100000) {
    return { ok: false, error: "السعر بين 0 و 1000 ₪" };
  }
  const [product] = await db
    .select({ basePriceMinor: products.basePriceMinor })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product) return { ok: false, error: "الصنف غير موجود." };
  if (product.basePriceMinor === newMinor) return { ok: true };
  await db
    .update(products)
    .set({ basePriceMinor: newMinor })
    .where(eq(products.id, id));
  await db.insert(priceChanges).values({
    entityType: "product",
    entityId: id,
    oldMinor: product.basePriceMinor,
    newMinor,
    changedBy: user.id,
  });
  return { ok: true };
}
