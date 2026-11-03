/**
 * Seed demo inventory data (owner showcase): 3 ingredients + a recipe for
 * مارينارا. Safe to re-run (fixed slugs via unique names).
 * Run: npx tsx --tsconfig scripts/tsconfig.json scripts/demo-inventory.mts
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  const k = m?.[1];
  const v = m?.[2];
  if (k && v !== undefined && !process.env[k]) process.env[k] = v.trim();
}

const { addIngredient, setRecipeLine } =
  await import("../lib/server/inventory");
const { db, pool } = await import("../lib/db/index");
const { ingredients, products } = await import("../db/schema");

const existing = await db.select().from(ingredients);
if (existing.length === 0) {
  await addIngredient({
    name: "دقيق القمح 00",
    unit: "g",
    openingStock: 25000,
    reorderThreshold: 5000,
    costPerUnitMinor: 250,
  });
  await addIngredient({
    name: "صلصة الطماطم",
    unit: "g",
    openingStock: 8000,
    reorderThreshold: 2000,
    costPerUnitMinor: 400,
  });
  await addIngredient({
    name: "جبنة موزاريلا",
    unit: "g",
    openingStock: 1500,
    reorderThreshold: 3000,
    costPerUnitMinor: 1800,
  });
  const mainDish = (await db.select().from(products)).find(
    (p) => p.slug === "fettuccine-mushroom",
  );
  const flour = (await db.select().from(ingredients)).find(
    (i) => i.name === "دقيق القمح 00",
  );
  const sauce = (await db.select().from(ingredients)).find(
    (i) => i.name === "صلصة الطماطم",
  );
  if (mainDish && flour && sauce) {
    await setRecipeLine({
      productId: mainDish.id,
      ingredientId: flour.id,
      quantityUsed: 180,
    });
    await setRecipeLine({
      productId: mainDish.id,
      ingredientId: sauce.id,
      quantityUsed: 120,
    });
  }
  console.log(
    "✓ demo inventory seeded: 3 ingredients + fettuccine-mushroom recipe (موزاريلا تحت حد الطلب)",
  );
} else {
  console.log("ingredients already present — skipped");
}
await pool.end();
