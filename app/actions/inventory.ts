"use server";

import { revalidatePath } from "next/cache";
import {
  addIngredient,
  listIngredients,
  listRecipes,
  moveStock,
  setRecipeLine,
} from "@/lib/server/inventory";
import { requireOwner } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";

/**
 * Inventory actions (Phase 4) — owner-only: ingredient costs and stock are
 * exactly the data a cashier must never read (AGENTS.md RBAC rule).
 * Every movement records the actor for auditability.
 */

async function guard() {
  return requireOwner();
}

function fail(err: unknown, fallback: string) {
  return { ok: false as const, error: userMessageOf(err, fallback) };
}

export async function fetchInventoryState() {
  try {
    await guard();
  } catch (err) {
    return { ok: false as const, error: userMessageOf(err) };
  }
  const { fetchAdminProducts } = await import("@/app/actions/menu-admin");
  const ingredients = await listIngredients();
  const productsRes = await fetchAdminProducts();
  return {
    ok: true as const,
    ingredients,
    products: productsRes.ok ? productsRes.rows : [],
  };
}

export async function fetchProductRecipes(productId: string) {
  try {
    await guard();
    return { ok: true as const, rows: await listRecipes(productId) };
  } catch (err) {
    return { ok: false as const, error: userMessageOf(err) };
  }
}

export async function createIngredient(input: {
  name: string;
  unit: string;
  openingStock: number;
  reorderThreshold: number;
  costPerUnitMinor: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await guard();
    await addIngredient({ ...input, actorId: user.id });
  } catch (err) {
    return fail(err, "تعذر الإضافة");
  }
  revalidatePath("/console/inventory");
  return { ok: true };
}

export async function stockMove(input: {
  ingredientId: string;
  qty: number;
  kind: "purchase" | "waste" | "adjustment";
  note?: string;
  costPerUnitMinor?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await guard();
    await moveStock({ ...input, actorId: user.id });
  } catch (err) {
    return fail(err, "تعذر تسجيل الحركة");
  }
  revalidatePath("/console/inventory");
  return { ok: true };
}

export async function saveRecipeLine(input: {
  productId: string;
  ingredientId: string;
  quantityUsed: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    await setRecipeLine(input);
  } catch (err) {
    return fail(err, "تعذر الحفظ");
  }
  revalidatePath("/console/inventory");
  return { ok: true };
}
