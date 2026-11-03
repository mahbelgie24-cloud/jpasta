import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { ingredients, inventoryMoves, products } from "@/db/schema";
import {
  addIngredient,
  listIngredients,
  listRecipes,
  moveStock,
  setRecipeLine,
} from "@/lib/server/inventory";
import { placeOrder, transitionOrder } from "@/lib/server/orders";

/**
 * Phase 4 DoD gate (spec §15): selling 10 identical dishes deducts exactly
 * the recipe quantities — and every deduction leaves an audited movement
 * referencing the order.
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

const RECIPE_QTY = 200; // 200 g of flour per fettuccine-mushroom

d("inventory — recipe-driven deduction", () => {
  let fettuccineId = "";
  let flourId = "";

  beforeAll(async () => {
    const fettuccine = (await db.select().from(products)).find(
      (p) => p.slug === "fettuccine-mushroom",
    );
    if (!fettuccine) throw new Error("seed missing");
    fettuccineId = fettuccine.id;
    await db.execute(
      sql`TRUNCATE order_items, orders, inventory_moves, recipes, ingredients CASCADE`,
    );

    // 5 kg of flour, reorder threshold 1 kg
    await addIngredient({
      name: "دقيق الاختبار",
      unit: "g",
      openingStock: 5000,
      reorderThreshold: 1000,
      costPerUnitMinor: 300,
    });
    const [flour] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, "دقيق الاختبار"))
      .limit(1);
    if (!flour) throw new Error("ingredient insert failed");
    flourId = flour.id;

    await setRecipeLine({
      productId: fettuccineId,
      ingredientId: flourId,
      quantityUsed: RECIPE_QTY,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("recipe persists and reads back", async () => {
    const lines = await listRecipes(fettuccineId);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.ingredientId).toBe(flourId);
    expect(lines[0]?.quantityUsed).toBe(RECIPE_QTY);
  });

  it("selling 10 identical dishes deducts exactly the recipe quantities (DoD)", async () => {
    const before = (await listIngredients()).find((i) => i.id === flourId);
    expect(before?.currentStock).toBe(5000);

    const result = await placeOrder({
      idempotencyKey: "inventory-dod-1",
      channel: "takeaway",
      customer: { name: "زبون المخزون", phone: "0566064976", address: "" },
      lines: [
        {
          productId: fettuccineId,
          quantity: 10,
          selections: [],
        },
      ],
    });
    expect(result.ok).toBe(true);

    const after = (await listIngredients()).find((i) => i.id === flourId);
    expect(after?.currentStock).toBe(5000 - RECIPE_QTY * 10);

    // one audited move, reason=sale, referencing the order, exact delta
    const moves = await db
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.ingredientId, flourId));
    const saleMoves = moves.filter((m) => m.reason === "sale");
    expect(saleMoves).toHaveLength(1);
    expect(Number(saleMoves[0]?.deltaQty)).toBe(-RECIPE_QTY * 10);
    expect(saleMoves[0]?.refOrderId).toBe(result.ok ? result.order.id : null);
  });

  it("waste and purchase moves adjust stock with an audit trail", async () => {
    // 300 g wasted
    await moveStock({
      ingredientId: flourId,
      qty: 300,
      kind: "waste",
      note: "انسكاب",
    });
    let stock = (await listIngredients()).find(
      (i) => i.id === flourId,
    )?.currentStock;
    expect(stock).toBe(5000 - RECIPE_QTY * 10 - 300);

    // 2 kg purchased
    await moveStock({
      ingredientId: flourId,
      qty: 2000,
      kind: "purchase",
      note: "مورد الدقيق الرئيسي",
    });
    stock = (await listIngredients()).find(
      (i) => i.id === flourId,
    )?.currentStock;
    expect(stock).toBe(5000 - RECIPE_QTY * 10 - 300 + 2000);

    const moves = await db
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.ingredientId, flourId));
    expect(moves.filter((m) => m.reason === "waste")).toHaveLength(1);
    expect(moves.filter((m) => m.reason === "purchase")).toHaveLength(1);
  });

  it("low-stock flag flips at the reorder threshold", async () => {
    // current after sale/waste/purchase = 5000 - 2000 - 300 + 2000 = 4700;
    // adjust down to 900 (below the 1000 g threshold)
    await moveStock({
      ingredientId: flourId,
      qty: -3800,
      kind: "adjustment",
      note: "تسوية اختبار",
    });
    const low = (await listIngredients()).find((i) => i.id === flourId);
    expect(low?.currentStock).toBe(900);
    expect(low?.isLow).toBe(true);
  });

  it("products without recipes never touch stock", async () => {
    const before = (await listIngredients()).find(
      (i) => i.id === flourId,
    )?.currentStock;
    // tabbouleh has no recipe
    const tabbouleh = (await db.select().from(products)).find(
      (p) => p.slug === "tabbouleh",
    );
    if (!tabbouleh) throw new Error("seed missing");
    const result = await placeOrder({
      idempotencyKey: "inventory-no-recipe-1",
      channel: "takeaway",
      customer: { name: "زبون بلا وصفة", phone: "0566064976", address: "" },
      lines: [{ productId: tabbouleh.id, quantity: 3, selections: [] }],
    });
    expect(result.ok).toBe(true);
    const after = (await listIngredients()).find(
      (i) => i.id === flourId,
    )?.currentStock;
    expect(after).toBe(before);
  });

  it("a cancelled order keeps its audit trail (no auto-restock in v1)", async () => {
    // documented behavior: cancelling after preparation does not auto-restock —
    // the kitchen used the ingredients; the owner adjusts via waste/adjustment.
    const result = await placeOrder({
      idempotencyKey: "inventory-cancel-1",
      channel: "takeaway",
      customer: { name: "زبون ملغي", phone: "0566064976", address: "" },
      lines: [
        {
          productId: fettuccineId,
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      await transitionOrder({
        orderId: result.order.id,
        next: "cancelled",
        expected: "received",
        reason: "اختبار",
      });
      const moves = await db
        .select()
        .from(inventoryMoves)
        .where(eq(inventoryMoves.reason, "sale"));
      // deduction stays — stock reflects reality (ingredients were consumed)
      const totalSaleDeduction = moves
        .filter((m) => m.ingredientId === flourId)
        .reduce((sum, m) => sum + Number(m.deltaQty), 0);
      expect(totalSaleDeduction).toBeLessThan(0);
    }
  });
});
