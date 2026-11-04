import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "@/lib/db";
import {
  ingredients,
  inventoryMoves,
  priceChanges,
  recipes,
} from "@/db/schema";
import {
  clampNonNegative,
  fromCenti,
  multiplyCenti,
  subtractCenti,
  toCenti,
  type Centi,
} from "@/lib/domain/qty";

/**
 * Inventory core (Phase 4, spec §8.4): recipe-driven stock deduction and the
 * audited movement log. Every stock change carries a reason and a reference.
 *
 * v2: all fractional quantities are computed in integer hundredths
 * (lib/domain/qty.ts) and stock can never go negative. When a sale exceeds
 * the recorded stock, the movement records the real available delta (the
 * stock floors at zero) instead of silently writing a negative balance that
 * the DB CHECK now rejects.
 */

type Tx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];

export async function deductForOrder(
  tx: Tx,
  orderId: string,
  lines: Array<{ productId: string; quantity: number }>,
): Promise<void> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  if (productIds.length === 0) return;
  const recipeRows = await tx
    .select()
    .from(recipes)
    .where(inArray(recipes.productId, productIds));
  if (recipeRows.length === 0) return;

  const qtyByProduct = new Map<string, number>();
  for (const l of lines) {
    qtyByProduct.set(
      l.productId,
      (qtyByProduct.get(l.productId) ?? 0) + l.quantity,
    );
  }

  const usage = new Map<string, Centi>();
  for (const r of recipeRows) {
    const sold = qtyByProduct.get(r.productId) ?? 0;
    if (sold > 0) {
      const used = multiplyCenti(toCenti(r.quantityUsed), sold);
      usage.set(r.ingredientId, (usage.get(r.ingredientId) ?? 0) + used);
    }
  }
  if (usage.size === 0) return;

  // Lock the affected ingredient rows so two concurrent sales cannot both
  // read the same stock and oversell. A deterministic id order means every
  // transaction takes the same lock sequence — two orders sharing ingredients
  // can queue instead of deadlocking.
  const stockRows = await tx
    .select({
      id: ingredients.id,
      currentStock: ingredients.currentStock,
    })
    .from(ingredients)
    .where(inArray(ingredients.id, [...usage.keys()]))
    .orderBy(asc(ingredients.id))
    .for("update");

  const stockById = new Map(
    stockRows.map((r) => [r.id, toCenti(r.currentStock)]),
  );

  for (const [ingredientId, used] of usage) {
    const before = stockById.get(ingredientId);
    if (before === undefined) continue;
    const after = clampNonNegative(subtractCenti(before, used));
    const delta = subtractCenti(after, before); // <= 0
    await tx
      .update(ingredients)
      .set({ currentStock: fromCenti(after) })
      .where(eq(ingredients.id, ingredientId));
    await tx.insert(inventoryMoves).values({
      ingredientId,
      deltaQty: fromCenti(delta),
      reason: "sale",
      refOrderId: orderId,
    });
  }
}

export interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  costPerUnitMinor: number;
  isLow: boolean;
}

export async function listIngredients(): Promise<IngredientRow[]> {
  const rows = await db
    .select()
    .from(ingredients)
    .orderBy(asc(ingredients.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    currentStock: Number(r.currentStock),
    reorderThreshold: Number(r.reorderThreshold),
    costPerUnitMinor: r.costPerUnitMinor,
    isLow: toCenti(r.currentStock) <= toCenti(r.reorderThreshold),
  }));
}

const UNITS = new Set(["g", "ml", "piece"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_UNITS = 1_000_000;
const MAX_UNIT_COST_MINOR = 10_000_000;

export async function addIngredient(input: {
  name: string;
  unit: string;
  openingStock: number;
  reorderThreshold: number;
  costPerUnitMinor: number;
  actorId?: string;
}): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60)
    throw new Error("اسم المكوّن غير صحيح");
  if (!UNITS.has(input.unit))
    throw new Error("الوحدة يجب أن تكون g أو ml أو piece");
  for (const value of [input.openingStock, input.reorderThreshold]) {
    if (!Number.isFinite(value) || value < 0 || value > MAX_UNITS) {
      throw new Error("الكميات لا تكون سالبة أو ضخمة");
    }
  }
  if (!Number.isInteger(input.costPerUnitMinor) || input.costPerUnitMinor < 0) {
    throw new Error("تكلفة الوحدة غير صحيحة");
  }

  // The opening balance and its audit row are one unit of work: a crash
  // between them would leave stock that no movement explains.
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(ingredients)
      .values({
        name,
        unit: input.unit,
        currentStock: fromCenti(toCenti(input.openingStock)),
        reorderThreshold: fromCenti(toCenti(input.reorderThreshold)),
        costPerUnitMinor: input.costPerUnitMinor,
      })
      .returning({ id: ingredients.id });
    if (!row) throw new Error("تعذر الإضافة");

    if (input.openingStock > 0) {
      await tx.insert(inventoryMoves).values({
        ingredientId: row.id,
        deltaQty: fromCenti(toCenti(input.openingStock)),
        reason: "adjustment",
        notes: "رصيد افتتاحي",
        createdBy: input.actorId ?? null,
      });
    }
  });
}

/** Generic audited stock change: purchase (+), waste (−), adjustment (±). */
export async function moveStock(input: {
  ingredientId: string;
  qty: number;
  kind: "purchase" | "waste" | "adjustment";
  note?: string;
  /** Purchase only: the new audited unit cost. */
  costPerUnitMinor?: number;
  actorId?: string;
}): Promise<void> {
  if (!UUID_RE.test(input.ingredientId)) throw new Error("المكوّن غير موجود");
  if (
    !Number.isFinite(input.qty) ||
    input.qty === 0 ||
    Math.abs(input.qty) > MAX_UNITS
  ) {
    throw new Error("أدخل كمية صحيحة");
  }
  // A purchase is always an inbound movement; a negative one would be
  // logged as a purchase while actually reducing stock (the UI already
  // prefixes waste with a negative sign).
  if (input.kind === "purchase" && input.qty <= 0)
    throw new Error("كمية الشراء يجب أن تكون أكبر من صفر");
  if (input.costPerUnitMinor !== undefined) {
    if (input.kind !== "purchase")
      throw new Error("تكلفة الوحدة تُحدَّث مع حركة الشراء فقط");
    if (
      !Number.isInteger(input.costPerUnitMinor) ||
      input.costPerUnitMinor < 0 ||
      input.costPerUnitMinor > MAX_UNIT_COST_MINOR
    ) {
      throw new Error("تكلفة الوحدة غير صحيحة");
    }
  }

  await db.transaction(async (tx) => {
    const [ingredient] = await tx
      .select({
        id: ingredients.id,
        currentStock: ingredients.currentStock,
        costPerUnitMinor: ingredients.costPerUnitMinor,
      })
      .from(ingredients)
      .where(eq(ingredients.id, input.ingredientId))
      .limit(1)
      .for("update");
    if (!ingredient) throw new Error("المكوّن غير موجود");

    const before = toCenti(ingredient.currentStock);
    const requested =
      input.kind === "waste"
        ? -Math.abs(toCenti(input.qty))
        : toCenti(input.qty);
    const after = clampNonNegative(before + requested);
    const delta = subtractCenti(after, before);

    const nextCost = input.costPerUnitMinor;
    const costChanged =
      nextCost !== undefined && nextCost !== ingredient.costPerUnitMinor;

    await tx
      .update(ingredients)
      .set({
        currentStock: fromCenti(after),
        ...(nextCost !== undefined && nextCost !== ingredient.costPerUnitMinor
          ? { costPerUnitMinor: nextCost }
          : {}),
      })
      .where(eq(ingredients.id, input.ingredientId));
    await tx.insert(inventoryMoves).values({
      ingredientId: input.ingredientId,
      deltaQty: fromCenti(delta),
      reason: input.kind,
      notes: input.note?.slice(0, 140) || null,
      createdBy: input.actorId ?? null,
    });
    if (costChanged && nextCost !== undefined) {
      await tx.insert(priceChanges).values({
        entityType: "ingredient",
        entityId: input.ingredientId,
        oldMinor: ingredient.costPerUnitMinor,
        newMinor: nextCost,
        changedBy: input.actorId ?? null,
      });
    }
  });
}

export async function listRecipes(productId: string): Promise<
  Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    quantityUsed: number;
  }>
> {
  const rows = await db
    .select({
      ingredientId: recipes.ingredientId,
      quantityUsed: recipes.quantityUsed,
      ingredientName: ingredients.name,
      unit: ingredients.unit,
    })
    .from(recipes)
    .innerJoin(ingredients, eq(ingredients.id, recipes.ingredientId))
    .where(eq(recipes.productId, productId));
  return rows.map((r) => ({
    ingredientId: r.ingredientId,
    ingredientName: r.ingredientName,
    unit: r.unit,
    quantityUsed: Number(r.quantityUsed),
  }));
}

export async function setRecipeLine(input: {
  productId: string;
  ingredientId: string;
  quantityUsed: number | null; // null removes the line
}): Promise<void> {
  if (!UUID_RE.test(input.productId) || !UUID_RE.test(input.ingredientId)) {
    throw new Error("بيانات الوصفة غير صحيحة");
  }
  if (input.quantityUsed === null) {
    await db
      .delete(recipes)
      .where(
        and(
          eq(recipes.productId, input.productId),
          eq(recipes.ingredientId, input.ingredientId),
        ),
      );
    return;
  }
  if (input.quantityUsed <= 0)
    throw new Error("الكمية يجب أن تكون أكبر من صفر");
  await db
    .insert(recipes)
    .values({
      productId: input.productId,
      ingredientId: input.ingredientId,
      quantityUsed: fromCenti(toCenti(input.quantityUsed)),
    })
    .onConflictDoUpdate({
      target: [recipes.productId, recipes.ingredientId],
      set: { quantityUsed: fromCenti(toCenti(input.quantityUsed)) },
    });
}
