"use server";

import { revalidatePath } from "next/cache";
import {
  addIngredient,
  listIngredients,
  listRecipes,
  moveStock,
  setRecipeLine,
} from "@/lib/server/inventory";

/**
 * Inventory actions (Phase 4) — owner-only: ingredient costs and stock are
 * exactly the data a cashier must never read (AGENTS.md RBAC rule).
 */

async function guard() {
  const { requireOwner } = await import("@/lib/server/session");
  return requireOwner();
}

export async function fetchInventoryState() {
  await guard();
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
  await guard();
  return listRecipes(productId);
}

export async function createIngredient(input: {
  name: string;
  unit: string;
  openingStock: number;
  reorderThreshold: number;
  costPerUnitMinor: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    await addIngredient(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذر الإضافة",
    };
  }
  revalidatePath("/console/inventory");
  return { ok: true };
}

export async function stockMove(input: {
  ingredientId: string;
  qty: number;
  kind: "purchase" | "waste" | "adjustment";
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    await moveStock(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذر تسجيل الحركة",
    };
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
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذر الحفظ",
    };
  }
  revalidatePath("/console/inventory");
  return { ok: true };
}
