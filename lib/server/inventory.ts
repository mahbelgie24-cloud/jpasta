import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "@/lib/db";
import { ingredients, inventoryMoves, recipes } from "@/db/schema";

/**
 * Inventory core (Phase 4, spec §8.4): recipe-driven stock deduction and the
 * audited movement log. Every stock change carries a reason and a reference
 * — the invariant that makes the system auditable rather than merely
 * functional.
 */

type Tx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];

/**
 * Deduct recipe quantities for a placed order — called INSIDE the
 * placeOrder transaction (same atomicity as the sale itself). One
 * inventory_moves row per affected ingredient per order, reason=sale,
 * referencing the order.
 */
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
  if (recipeRows.length === 0) return; // products without recipes don't touch stock

  const qtyByProduct = new Map<string, number>();
  for (const l of lines) {
    qtyByProduct.set(
      l.productId,
      (qtyByProduct.get(l.productId) ?? 0) + l.quantity,
    );
  }
  const usage = new Map<string, number>(); // ingredientId → total qty consumed
  for (const r of recipeRows) {
    const sold = qtyByProduct.get(r.productId) ?? 0;
    if (sold > 0) {
      usage.set(
        r.ingredientId,
        (usage.get(r.ingredientId) ?? 0) + Number(r.quantityUsed) * sold,
      );
    }
  }

  for (const [ingredientId, totalUsed] of usage) {
    await tx
      .update(ingredients)
      .set({ currentStock: sql`${ingredients.currentStock} - ${totalUsed}` })
      .where(eq(ingredients.id, ingredientId));
    await tx.insert(inventoryMoves).values({
      ingredientId,
      deltaQty: String(-totalUsed),
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
    isLow: Number(r.currentStock) <= Number(r.reorderThreshold),
  }));
}

const UNITS = new Set(["g", "ml", "piece"]);

export async function addIngredient(input: {
  name: string;
  unit: string;
  openingStock: number;
  reorderThreshold: number;
  costPerUnitMinor: number;
}): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("اسم المكوّن قصير جداً");
  if (!UNITS.has(input.unit))
    throw new Error("الوحدة يجب أن تكون g أو ml أو piece");
  if (input.openingStock < 0 || input.reorderThreshold < 0)
    throw new Error("الكميات لا تكون سالبة");
  const [row] = await db
    .insert(ingredients)
    .values({
      name,
      unit: input.unit,
      currentStock: String(input.openingStock),
      reorderThreshold: String(input.reorderThreshold),
      costPerUnitMinor: input.costPerUnitMinor,
    })
    .returning({ id: ingredients.id });
  if (!row) throw new Error("تعذر الإضافة");
  if (input.openingStock > 0) {
    // the opening stock is an audited adjustment, not a silent insert
    await db.insert(inventoryMoves).values({
      ingredientId: row.id,
      deltaQty: String(input.openingStock),
      reason: "adjustment",
      notes: "رصيد افتتاحي",
    });
  }
}

/** Generic audited stock change: purchase (+), waste (−), adjustment (±). */
export async function moveStock(input: {
  ingredientId: string;
  qty: number;
  kind: "purchase" | "waste" | "adjustment";
  note?: string;
  costPerUnitMinor?: number;
}): Promise<void> {
  if (!Number.isFinite(input.qty) || input.qty === 0)
    throw new Error("أدخل كمية صحيحة");
  const [ingredient] = await db
    .select({ id: ingredients.id, unit: ingredients.unit })
    .from(ingredients)
    .where(eq(ingredients.id, input.ingredientId))
    .limit(1);
  if (!ingredient) throw new Error("المكوّن غير موجود");

  const signed = input.kind === "waste" ? -Math.abs(input.qty) : input.qty;
  await db.transaction(async (tx) => {
    await tx
      .update(ingredients)
      .set({ currentStock: sql`${ingredients.currentStock} + ${signed}` })
      .where(eq(ingredients.id, input.ingredientId));
    await tx.insert(inventoryMoves).values({
      ingredientId: input.ingredientId,
      deltaQty: String(signed),
      reason: input.kind,
      notes: input.note?.slice(0, 140) || null,
    });
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
  if (input.quantityUsed === null) {
    await db
      .delete(recipes)
      .where(
        sql`${recipes.productId} = ${input.productId} and ${recipes.ingredientId} = ${input.ingredientId}`,
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
      quantityUsed: String(input.quantityUsed),
    })
    .onConflictDoUpdate({
      target: [recipes.productId, recipes.ingredientId],
      set: { quantityUsed: String(input.quantityUsed) },
    });
}
