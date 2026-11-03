/**
 * Place one live demo order through the real pipeline (no client, no server
 * action) — for owner demos. Safe to re-run: a fixed idempotency key returns
 * the same order instead of duplicating.
 *
 * Run: npx tsx scripts/demo-order.mts
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  const k = m?.[1];
  const v = m?.[2];
  if (k && v !== undefined && !process.env[k]) process.env[k] = v.trim();
}

const { placeOrder } = await import("../lib/server/orders");
const { db, pool } = await import("../lib/db/index");
const { products } = await import("../db/schema");

const mainDish = (await db.select().from(products)).find(
  (p) => p.slug === "fettuccine-mushroom",
);
if (!mainDish) throw new Error("seeded product missing — run npm run db:seed");

const result = await placeOrder({
  idempotencyKey: "demo-live-order-2026-10-27",
  channel: "delivery",
  customer: {
    name: "أحمد التجريبي",
    phone: "0599887766",
    address: "حي الجامعة، بجانب الجامع الكبير، قلقيلية",
  },
  note: "الاتصال قبل الوصول",
  lines: [
    {
      productId: mainDish.id,
      quantity: 2,
      selections: [{ groupKey: "extras", optionKey: "chicken" }],
      note: "صلصة زيادة عالجنب",
    },
  ],
});

console.log(
  JSON.stringify(
    result.ok
      ? { order: result.order.orderNumber, totalMinor: result.order.totalMinor }
      : result,
    null,
    2,
  ),
);
await pool.end();
