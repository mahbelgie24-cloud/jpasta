import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  const k = m?.[1],
    v = m?.[2];
  if (k && v !== undefined && !process.env[k]) process.env[k] = v.trim();
}
const { placeOrder } = await import("../lib/server/orders");
const { db, pool } = await import("../lib/db/index");
const { products } = await import("../db/schema");
const mainDish = (await db.select().from(products)).find(
  (p) => p.slug === "fettuccine-mushroom",
);
const t0 = Date.now();
const result = await placeOrder({
  idempotencyKey: "sse-latency5-" + t0,
  channel: "takeaway",
  customer: { name: "اختبار SSE", phone: "0566064976", address: "" },
  lines: [
    {
      productId: mainDish!.id,
      quantity: 1,
      selections: [],
    },
  ],
});
console.log(
  JSON.stringify({
    ok: result.ok,
    order: result.ok ? result.order.orderNumber : result.error,
    placedAtMs: Date.now() - t0,
  }),
);
await pool.end();
