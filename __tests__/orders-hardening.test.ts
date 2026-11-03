import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { deliveryZones, orders, products } from "@/db/schema";
import {
  placeOrder,
  transitionOrder,
  undoLastTransition,
} from "@/lib/server/orders";

/**
 * v2 hardening regression suite:
 *  - the delivery fee comes from the CUSTOMER'S zone
 *  - idempotency keys are bound to the payload
 *  - transitions are conditional (no resurrection) and auditable
 *  - cancellation requires a reason, undo restores the previous state
 *  - local-day order numbers are gap-free
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

d("orders — v2 hardening", () => {
  let productId = "";
  let zoneA = "";
  let zoneB = "";

  const baseInput = (key: string, overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: key,
    channel: "takeaway" as const,
    customer: { name: "زبون الاختبار", phone: "0566064976", address: "" },
    lines: [
      {
        productId,
        quantity: 1,
        selections: [],
      },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    const [p] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "fettuccine-mushroom"))
      .limit(1);
    if (!p) throw new Error("seed missing — run npm run db:seed");
    productId = p.id;
    const [primary] = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .limit(1);
    if (!primary) throw new Error("seeded delivery zone missing");
    zoneA = primary.id;

    const [extra] = await db
      .insert(deliveryZones)
      .values({
        nameAr: "منطقة اختبار الرسوم",
        feeMinor: 700,
        sortOrder: 99,
      })
      .returning({ id: deliveryZones.id });
    if (!extra) throw new Error("could not create test zone");
    zoneB = extra.id;

    await db.execute(sql`TRUNCATE order_items, orders CASCADE`);
  });

  afterAll(async () => {
    await db.delete(deliveryZones).where(and(eq(deliveryZones.id, zoneB)));
    await pool.end();
  });

  it("charges the customer's selected zone, not the cheapest active zone", async () => {
    const result = await placeOrder(
      baseInput("hardening-zone", {
        channel: "delivery",
        zoneId: zoneB,
        customer: {
          name: "زبون التوصيل",
          phone: "0566064976",
          address: "حي الجامعة، قلقيلية",
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [row] = await db
      .select({
        fee: orders.deliveryFeeMinor,
        zoneId: orders.zoneId,
        total: orders.totalMinor,
        subtotal: orders.subtotalMinor,
      })
      .from(orders)
      .where(eq(orders.id, result.order.id));

    expect(row?.zoneId).toBe(zoneB);
    expect(row?.fee).toBe(700);
    expect(row?.total).toBe((row?.subtotal ?? 0) + 700);
    expect(row?.fee).not.toBe(500); // the seeded cheapest zone
    expect(zoneA).not.toBe(zoneB);
  });

  it("rejects delivery without a zone", async () => {
    const result = await placeOrder(
      baseInput("hardening-no-zone", {
        channel: "delivery",
        customer: {
          name: "زبون بلا منطقة",
          phone: "0566064976",
          address: "عنوان كافٍ",
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("binds an idempotency key to its payload", async () => {
    const first = await placeOrder(baseInput("hardening-payload"));
    expect(first.ok).toBe(true);

    const second = await placeOrder(
      baseInput("hardening-payload", {
        lines: [
          {
            productId,
            quantity: 2,
            selections: [],
          },
        ],
      }),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("مفتاح");
  });

  it("rejects a stale transition instead of resurrecting the order", async () => {
    const placed = await placeOrder(baseInput("hardening-transition"));
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const advanced = await transitionOrder({
      orderId: placed.order.id,
      next: "preparing",
      expected: "received",
    });
    expect(advanced.ok).toBe(true);

    const stale = await transitionOrder({
      orderId: placed.order.id,
      next: "preparing",
      expected: "received",
    });
    expect(stale.ok).toBe(false);
    expect(stale.conflict).toBe(true);
  });

  it("requires a cancellation reason", async () => {
    const placed = await placeOrder(baseInput("hardening-cancel"));
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const noReason = await transitionOrder({
      orderId: placed.order.id,
      next: "cancelled",
      expected: "received",
    });
    expect(noReason.ok).toBe(false);

    const withReason = await transitionOrder({
      orderId: placed.order.id,
      next: "cancelled",
      expected: "received",
      reason: "الزبون غيّر رأيه",
    });
    expect(withReason.ok).toBe(true);
  });

  it("undoes the last transition within the window", async () => {
    const placed = await placeOrder(baseInput("hardening-undo"));
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    await transitionOrder({
      orderId: placed.order.id,
      next: "preparing",
      expected: "received",
    });
    const undone = await undoLastTransition({ orderId: placed.order.id });
    expect(undone.ok).toBe(true);

    const [row] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, placed.order.id));
    expect(row?.status).toBe("received");
  });

  it("clears the cancellation reason when a cancel is undone", async () => {
    const placed = await placeOrder(baseInput("hardening-undo-cancel"));
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    await transitionOrder({
      orderId: placed.order.id,
      next: "cancelled",
      expected: "received",
      reason: "سبب اختباري",
    });
    const undone = await undoLastTransition({ orderId: placed.order.id });
    expect(undone.ok).toBe(true);

    const [row] = await db
      .select({
        status: orders.status,
        reason: orders.cancelledReason,
      })
      .from(orders)
      .where(eq(orders.id, placed.order.id));
    expect(row?.status).toBe("received");
    expect(row?.reason).toBeNull();
  });

  it("issues gap-free local-day order numbers", async () => {
    const a = await placeOrder(baseInput("hardening-number-a"));
    const b = await placeOrder(baseInput("hardening-number-b"));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    expect(a.order.orderNumber).toMatch(/^JP-\d{6}-\d{3,}$/);
    const aSeq = Number(a.order.orderNumber.split("-").at(-1));
    const bSeq = Number(b.order.orderNumber.split("-").at(-1));
    expect(bSeq).toBe(aSeq + 1);
  });
});
