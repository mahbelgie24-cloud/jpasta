import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { orderItems, orders, products } from "@/db/schema";
import { orderInputSchema, placeOrder } from "@/lib/server/orders";

/**
 * Integration suite (DoD gate, spec §15 Phase 1): 20 consecutive orders with
 * zero calculation errors, idempotent replay, and server-side validation.
 * Requires the seeded local database (npm run db:migrate && npm run db:seed).
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

/** Known seeded prices (agorot). */
const ALFREDO = 2400;
const ALFREDO_LARGE = 600;
const EXTRA_CHICKEN = 600;
const MARINARA = 1900;
const DELIVERY_FEE = 500;

async function productIdBySlug(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  if (!row)
    throw new Error(`seeded product missing: ${slug} — run npm run db:seed`);
  return row.id;
}

d("placeOrder — order pipeline", () => {
  let alfredoId = "";
  let marinaraId = "";

  beforeAll(async () => {
    alfredoId = await productIdBySlug("alfredo-classico");
    marinaraId = await productIdBySlug("marinara");
    await db.execute(sql`TRUNCATE order_items, orders CASCADE`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("places 20 consecutive orders with exact server-computed totals (DoD)", async () => {
    let expectedRevenue = 0;
    for (let i = 0; i < 20; i += 1) {
      const large = i % 2 === 0;
      const withChicken = i % 3 === 0;
      const delivery = i % 4 === 0;

      const lines = [
        {
          productId: alfredoId,
          quantity: 1 + (i % 2),
          note: i % 5 === 0 ? "بدون بصل" : undefined,
          selections: [
            { groupKey: "size", optionKey: large ? "large" : "regular" },
            ...(withChicken
              ? [{ groupKey: "extras", optionKey: "grill-chicken" }]
              : []),
          ],
        },
        ...(i % 6 === 0
          ? [
              {
                productId: marinaraId,
                quantity: 2,
                note: undefined,
                selections: [{ groupKey: "size", optionKey: "regular" }],
              },
            ]
          : []),
      ];

      const unitAlfredo =
        ALFREDO +
        (large ? ALFREDO_LARGE : 0) +
        (withChicken ? EXTRA_CHICKEN : 0);
      const qtyAlfredo = 1 + (i % 2);
      const expected =
        unitAlfredo * qtyAlfredo +
        (i % 6 === 0 ? MARINARA * 2 : 0) +
        (delivery ? DELIVERY_FEE : 0);
      expectedRevenue += expected;

      const result = await placeOrder({
        idempotencyKey: `test-20-orders-${i}`,
        channel: delivery ? "delivery" : "takeaway",
        customer: {
          name: `زبون الاختبار ${i + 1}`,
          phone: "0566064976",
          address: delivery ? "حي الجامعة، قلقيلية" : "",
        },
        lines,
      });

      expect(
        result.ok,
        `order ${i} failed: ${!result.ok ? result.error : ""}`,
      ).toBe(true);
      if (result.ok) {
        expect(result.order.totalMinor).toBe(expected);
        expect(result.order.orderNumber).toMatch(/^JP-\d{5}$/);
      }
    }

    const [revenue] = await db
      .select({
        total: sql<number>`coalesce(sum(total_minor),0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders);
    expect(revenue?.count).toBe(20);
    expect(revenue?.total).toBe(expectedRevenue);
  });

  it("replays an idempotency key without duplicating the sale", async () => {
    const input = {
      idempotencyKey: "test-replay-key-1",
      channel: "takeaway" as const,
      customer: { name: "زبون الإعادة", phone: "0566064976", address: "" },
      lines: [
        {
          productId: marinaraId,
          quantity: 1,
          selections: [{ groupKey: "size", optionKey: "regular" }],
        },
      ],
    };
    const first = await placeOrder(input);
    const second = await placeOrder(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.order.id).toBe(first.order.id);
      expect(second.order.totalMinor).toBe(first.order.totalMinor);
    }
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.idempotencyKey, "test-replay-key-1"));
    expect(row?.n).toBe(1);
  });

  it("rejects an unknown product", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-unknown-product",
      channel: "takeaway",
      customer: { name: "زبون", phone: "0566064976", address: "" },
      lines: [
        {
          productId: "00000000-0000-4000-8000-000000000000",
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("لم يعد متوفراً");
  });

  it("rejects a missing required group (size) server-side", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-missing-size",
      channel: "takeaway",
      customer: { name: "زبون", phone: "0566064976", address: "" },
      lines: [{ productId: alfredoId, quantity: 1, selections: [] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("الحجم");
  });

  it("rejects an invalid option key server-side", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-invalid-option",
      channel: "takeaway",
      customer: { name: "زبون", phone: "0566064976", address: "" },
      lines: [
        {
          productId: alfredoId,
          quantity: 1,
          selections: [
            { groupKey: "size", optionKey: "regular" },
            { groupKey: "extras", optionKey: "hack-the-price" },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("غير صالح");
  });

  it("rejects delivery without an address (zod schema)", () => {
    const parsed = orderInputSchema.safeParse({
      idempotencyKey: "test-no-address",
      channel: "delivery",
      customer: { name: "زبون", phone: "0566064976", address: "" },
      lines: [
        {
          productId: alfredoId,
          quantity: 1,
          selections: [{ groupKey: "size", optionKey: "regular" }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("snapshot integrity: persisted items match the computed line values", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-snapshot-1",
      channel: "delivery",
      customer: {
        name: "زبون اللقطات",
        phone: "0566064976",
        address: "حي الجامعة، قلقيلية",
      },
      lines: [
        {
          productId: alfredoId,
          quantity: 2,
          selections: [
            { groupKey: "size", optionKey: "large" },
            { groupKey: "extras", optionKey: "grill-chicken" },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.order.id));
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item?.unitPriceMinor).toBe(ALFREDO + ALFREDO_LARGE + EXTRA_CHICKEN);
    expect(item?.lineTotalMinor).toBe(
      (ALFREDO + ALFREDO_LARGE + EXTRA_CHICKEN) * 2,
    );
    expect(item?.detailAr).toBe("كبير • دجاج مشوي إضافي");
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.order.id));
    expect(order?.totalMinor).toBe(
      (ALFREDO + ALFREDO_LARGE + EXTRA_CHICKEN) * 2 + DELIVERY_FEE,
    );
  });
});
