"use server";

import { revalidatePath, updateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, priceChanges, products } from "@/db/schema";
import { requireOwner } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";

/**
 * Menu manager (Phase 3, hardened in v2).
 * Every price change writes an audit row (old → new, who, when) — spec §9.
 */

export type AdminProduct = {
  id: string;
  nameAr: string;
  categoryNameAr: string;
  basePriceMinor: number;
  isAvailable: boolean;
};

const uuidSchema = z.string().uuid();
const priceSchema = z.number().int().min(0).max(100000); // ₪0 – ₪1000

async function guard() {
  return requireOwner();
}

function fail(err: unknown, fallback: string) {
  return { ok: false as const, error: userMessageOf(err, fallback) };
}

export async function fetchAdminProducts(): Promise<
  { ok: true; rows: AdminProduct[] } | { ok: false; error: string }
> {
  try {
    await guard();
  } catch (err) {
    return { ok: false, error: userMessageOf(err) };
  }
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
  try {
    await guard();
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: "صنف غير صحيح." };
    const rows = await db
      .update(products)
      .set({ isAvailable })
      .where(eq(products.id, parsed.data))
      .returning({ id: products.id });
    if (rows.length === 0) return { ok: false, error: "الصنف غير موجود." };
    updateTag("catalog");
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر تحديث التوفر.");
  }
}

export async function setProductImage(
  id: string,
  image: {
    key: string;
    alt?: string;
    width?: number;
    height?: number;
    color?: string;
  } | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: "صنف غير صحيح." };

    if (image) {
      if (
        !/^products\/[a-zA-Z0-9_-]+\.(?:avif|webp|jpe?g|png)$/.test(image.key)
      ) {
        return { ok: false, error: "مفتاح الصورة غير صحيح." };
      }
      if (image.alt !== undefined && image.alt.length > 140) {
        return { ok: false, error: "وصف الصورة طويل جداً." };
      }
      const validDimension = (value: number | undefined) =>
        value === undefined ||
        (Number.isInteger(value) && value > 0 && value <= 6000);
      if (!validDimension(image.width) || !validDimension(image.height)) {
        return { ok: false, error: "أبعاد الصورة غير صحيحة." };
      }
      if (
        image.color !== undefined &&
        image.color !== null &&
        !/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(image.color)
      ) {
        return { ok: false, error: "لون خلفية الصورة غير صحيح." };
      }
    }

    const rows = await db
      .update(products)
      .set(
        image
          ? {
              imageKey: image.key,
              imageAlt: image.alt ?? null,
              imageWidth: image.width ?? 1200,
              imageHeight: image.height ?? 900,
              imageColor: image.color ?? null,
            }
          : {
              imageKey: null,
              imageAlt: null,
              imageWidth: null,
              imageHeight: null,
              imageColor: null,
            },
      )
      .where(eq(products.id, parsedId.data))
      .returning({ id: products.id });
    if (rows.length === 0) return { ok: false, error: "الصنف غير موجود." };

    updateTag("catalog");
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حفظ الصورة.");
  }
}

export async function setProductPrice(
  id: string,
  newMinor: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await guard();
    const parsedId = uuidSchema.safeParse(id);
    const parsedPrice = priceSchema.safeParse(newMinor);
    if (!parsedId.success) return { ok: false, error: "صنف غير صحيح." };
    if (!parsedPrice.success)
      return { ok: false, error: "السعر بين 0 و 1000 ₪" };

    const [product] = await db
      .select({ basePriceMinor: products.basePriceMinor })
      .from(products)
      .where(eq(products.id, parsedId.data))
      .limit(1);
    if (!product) return { ok: false, error: "الصنف غير موجود." };
    if (product.basePriceMinor === parsedPrice.data) return { ok: true };

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({ basePriceMinor: parsedPrice.data })
        .where(eq(products.id, parsedId.data));
      await tx.insert(priceChanges).values({
        entityType: "product",
        entityId: parsedId.data,
        oldMinor: product.basePriceMinor,
        newMinor: parsedPrice.data,
        changedBy: user.id,
      });
    });
    updateTag("catalog");
    revalidatePath("/menu");
    return { ok: true };
  } catch (err) {
    return fail(err, "تعذر حفظ السعر.");
  }
}
