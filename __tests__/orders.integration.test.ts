import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "@/test/db";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { deliveryZones, orderItems, orders, products } from "@/db/schema";
import { orderInputSchema, placeOrder, quoteCart } from "@/lib/server/orders";

/**
 * Integration suite (DoD gate, spec §15 Phase 1): 20 consecutive orders with
 * zero calculation errors, idempotent replay, and server-side validation.
 * Requires the seeded local database (npm run db:migrate && npm run db:seed).
 */

const DB_READY = Boolean(testDatabaseUrl());
const d = DB_READY ? describe : describe.skip;

/** Known seeded prices (agorot). */
const FETTUCCINE = 2000; // fettuccine-mushroom
const PENNE_PESTO = 2500;
const CHICKEN_ADDON = 1000;
const NUGGETS = 1500;
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
  let fettuccineId = "";
  let pennePestoId = "";
  let nuggetsId = "";
  let zoneId = "";

  beforeAll(async () => {
    fettuccineId = await productIdBySlug("fettuccine-mushroom");
    pennePestoId = await productIdBySlug("penne-pesto");
    nuggetsId = await productIdBySlug("chicken-nuggets");
    const [zone] = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .limit(1);
    if (!zone) throw new Error("seeded delivery zone missing");
    zoneId = zone.id;
    await db.execute(sql`TRUNCATE order_items, orders CASCADE`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("places 20 consecutive orders with exact server-computed totals (DoD)", async () => {
    let expectedRevenue = 0;
    for (let i = 0; i < 20; i += 1) {
      const withChicken = i % 3 === 0;
      const delivery = i % 4 === 0;

      const lines = [
        {
          productId: fettuccineId,
          quantity: 1 + (i % 2),
          note: i % 5 === 0 ? "بدون بصل" : undefined,
          selections: withChicken
            ? [{ groupKey: "extras", optionKey: "chicken" }]
            : [],
        },
        ...(i % 6 === 0
          ? [
              {
                productId: pennePestoId,
                quantity: 2,
                note: undefined,
                selections: [],
              },
            ]
          : []),
      ];

      const unitFettuccine = FETTUCCINE + (withChicken ? CHICKEN_ADDON : 0);
      const qtyFettuccine = 1 + (i % 2);
      const expected =
        unitFettuccine * qtyFettuccine +
        (i % 6 === 0 ? PENNE_PESTO * 2 : 0) +
        (delivery ? DELIVERY_FEE : 0);
      expectedRevenue += expected;

      const result = await placeOrder({
        idempotencyKey: `test-20-orders-${i}`,
        channel: delivery ? "delivery" : "takeaway",
        ...(delivery ? { zoneId } : {}),
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
        expect(result.order.orderNumber).toMatch(/^JP-\d{6}-\d{3,}$/);
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
          productId: pennePestoId,
          quantity: 1,
          selections: [],
        },
      ],
    };
    const first = await placeOrder(input);
    const second = await placeOrder(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.order.id).toBe(first.order.id);
      expect(second.order.totalMinor).toBe(first.order.totalMinor);
      // The internal idempotency hash is not part of the public contract.
      expect(Object.keys(second.order)).not.toContain("payloadHash");
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

  it("rejects a missing required sauce on chicken nuggets", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-missing-sauce",
      channel: "takeaway",
      customer: { name: "زبون", phone: "0566064976", address: "" },
      lines: [{ productId: nuggetsId, quantity: 1, selections: [] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("الصوص");
  });

  it("rejects an invalid option key server-side", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-invalid-option",
      channel: "takeaway",
      customer: { name: "زبون", phone: "0566064976", address: "" },
      lines: [
        {
          productId: nuggetsId,
          quantity: 1,
          selections: [{ groupKey: "sauce", optionKey: "hack-the-price" }],
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
          productId: fettuccineId,
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a phone number made of punctuation (no digits)", () => {
    const parsed = orderInputSchema.safeParse({
      idempotencyKey: "test-phone-punctuation",
      channel: "takeaway",
      customer: { name: "زبون", phone: "---------", address: "" },
      lines: [
        {
          productId: fettuccineId,
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("prices and records the chicken add-on in the line snapshot", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-chicken-addon-snapshot",
      channel: "delivery",
      zoneId,
      customer: {
        name: "زبون اللقطات",
        phone: "0566064976",
        address: "حي الجامعة، قلقيلية",
      },
      lines: [
        {
          productId: fettuccineId,
          quantity: 2,
          selections: [{ groupKey: "extras", optionKey: "chicken" }],
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
    expect(item?.unitPriceMinor).toBe(FETTUCCINE + CHICKEN_ADDON);
    expect(item?.lineTotalMinor).toBe((FETTUCCINE + CHICKEN_ADDON) * 2);
    expect(item?.detailAr).toBe("إضافة دجاج");
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.order.id));
    expect(order?.totalMinor).toBe(
      (FETTUCCINE + CHICKEN_ADDON) * 2 + DELIVERY_FEE,
    );
  });

  it("charges a duplicated selection once and records it once", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-duplicate-selection",
      channel: "takeaway",
      customer: { name: "زبون التكرار", phone: "0566064976", address: "" },
      lines: [
        {
          productId: fettuccineId,
          quantity: 1,
          selections: [
            { groupKey: "extras", optionKey: "chicken" },
            { groupKey: "extras", optionKey: "chicken" },
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
    expect(items[0]?.unitPriceMinor).toBe(FETTUCCINE + CHICKEN_ADDON);
    expect(items[0]?.detailAr).toBe("إضافة دجاج");
  });

  it("prices the mandatory nuggets sauce and records it", async () => {
    const result = await placeOrder({
      idempotencyKey: "test-nuggets-sauce",
      channel: "takeaway",
      customer: { name: "زبون الصوص", phone: "0566064976", address: "" },
      lines: [
        {
          productId: nuggetsId,
          quantity: 1,
          selections: [{ groupKey: "sauce", optionKey: "buffalo" }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.order.id));
    expect(items[0]?.unitPriceMinor).toBe(NUGGETS);
    expect(items[0]?.detailAr).toBe("بافلو");
  });

  it("quotes the current catalog price without writing an order", async () => {
    const quote = await quoteCart({
      lines: [
        {
          productId: fettuccineId,
          quantity: 2,
          selections: [{ groupKey: "extras", optionKey: "chicken" }],
        },
      ],
    });
    expect(quote.ok).toBe(true);
    if (quote.ok) {
      expect(quote.subtotalMinor).toBe((FETTUCCINE + CHICKEN_ADDON) * 2);
      expect(quote.lines[0]?.available).toBe(true);
      expect(quote.unavailableProductIds).toHaveLength(0);
    }
  });

  it("reflects an owner price change in the quote", async () => {
    const newPrice = FETTUCCINE + 300;
    await db
      .update(products)
      .set({ basePriceMinor: newPrice })
      .where(eq(products.id, fettuccineId));
    try {
      const quote = await quoteCart({
        lines: [{ productId: fettuccineId, quantity: 1, selections: [] }],
      });
      expect(quote.ok).toBe(true);
      if (quote.ok) expect(quote.lines[0]?.unitPriceMinor).toBe(newPrice);
    } finally {
      await db
        .update(products)
        .set({ basePriceMinor: FETTUCCINE })
        .where(eq(products.id, fettuccineId));
    }
  });

  it("marks an unavailable product instead of pricing it", async () => {
    await db
      .update(products)
      .set({ isAvailable: false })
      .where(eq(products.id, pennePestoId));
    try {
      const quote = await quoteCart({
        lines: [{ productId: pennePestoId, quantity: 1, selections: [] }],
      });
      expect(quote.ok).toBe(true);
      if (quote.ok) {
        expect(quote.lines[0]?.available).toBe(false);
        expect(quote.subtotalMinor).toBe(0);
        expect(quote.unavailableProductIds).toContain(pennePestoId);
      }
    } finally {
      await db
        .update(products)
        .set({ isAvailable: true })
        .where(eq(products.id, pennePestoId));
    }
  });

  it("records the chosen pasta type on the line", async () => {
    const crunchyId = await productIdBySlug("crunchy-cheese-pasta");
    const result = await placeOrder({
      idempotencyKey: "test-pasta-type",
      channel: "takeaway",
      customer: { name: "زبون الباستا", phone: "0566064976", address: "" },
      lines: [
        {
          productId: crunchyId,
          quantity: 1,
          selections: [{ groupKey: "pasta", optionKey: "penne" }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.order.id));
    expect(items[0]?.unitPriceMinor).toBe(2000);
    expect(items[0]?.detailAr).toBe("بيني");
  });
});
