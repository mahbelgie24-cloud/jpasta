import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "@/test/db";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { deliveryZones, orders, products } from "@/db/schema";
import { placeOrder } from "@/lib/server/orders";
import { transitionOrder } from "@/lib/server/orders";
import {
  getBestSellers,
  getDaySummary,
  getRecentDays,
  getZSummary,
  todayLocal,
} from "@/lib/server/reports";

/**
 * Phase 3 DoD gate: the end-of-day report matches a manual count exactly.
 * Places known orders (mixed channels, one cancelled), then asserts the
 * day summary, Z-cash view, best sellers, and the 7-day series — to the
 * last agorot.
 */

const DB_READY = Boolean(testDatabaseUrl());
const d = DB_READY ? describe : describe.skip;

const FETTUCCINE = 2000; // fettuccine-mushroom
const PENNE_PESTO = 2500;
const DELIVERY_FEE = 500;

d("reports — the manual-count DoD", () => {
  let zoneId = "";

  beforeAll(async () => {
    const fettuccine = (await db.select().from(products)).find(
      (p) => p.slug === "fettuccine-mushroom",
    );
    const pennePesto = (await db.select().from(products)).find(
      (p) => p.slug === "penne-pesto",
    );
    if (!fettuccine || !pennePesto) throw new Error("seed missing");
    const [zone] = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .limit(1);
    if (!zone) throw new Error("seeded delivery zone missing");
    zoneId = zone.id;
    await db.execute(sql`TRUNCATE order_items, orders CASCADE`);

    // 3 takeaway + 2 delivery + 1 cancelled = 6 orders
    // revenue: (20 + 25 + 20) + (20+5 + 25+5) = 120.00 ; cancelled 25.00
    const mk = (i: number, channel: "takeaway" | "delivery", pid: string) =>
      placeOrder(
        {
          idempotencyKey: `report-dod-${i}`,
          channel,
          ...(channel === "delivery" ? { zoneId } : {}),
          customer: {
            name: `زبون ${i}`,
            phone: "0566064976",
            address: channel === "delivery" ? "حي المركز" : "",
          },
          lines: [
            {
              productId: pid,
              quantity: 1,
              selections: [],
            },
          ],
        },
        { source: "console" },
      );

    const results = await Promise.all([
      mk(1, "takeaway", fettuccine.id),
      mk(2, "takeaway", pennePesto.id),
      mk(3, "takeaway", fettuccine.id),
      mk(4, "delivery", fettuccine.id),
      mk(5, "delivery", pennePesto.id),
    ]);
    const cancelled = await mk(6, "takeaway", pennePesto.id);

    for (const r of results) expect(r.ok).toBe(true);
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      const res = await transitionOrder({
        orderId: cancelled.order.id,
        next: "cancelled",
        expected: "received",
        reason: "اختبار",
      });
      expect(res.ok).toBe(true);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("day summary matches the manual count exactly", async () => {
    const summary = await getDaySummary(todayLocal());
    // manual count: 3 takeaway (20+25+20) + 2 delivery (20+5, 25+5) = 120.00
    expect(summary.orderCount).toBe(5);
    expect(summary.revenueMinor).toBe(
      FETTUCCINE * 3 + PENNE_PESTO * 2 + DELIVERY_FEE * 2,
    );
    expect(summary.deliveryCount).toBe(2);
    expect(summary.takeawayCount).toBe(3);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.cancelledMinor).toBe(PENNE_PESTO);
    expect(summary.avgOrderMinor).toBe(Math.round(summary.revenueMinor / 5));
  });

  it("Z cash view totals the drawer exactly", async () => {
    const z = await getZSummary(todayLocal());
    expect(z.cashCount).toBe(5); // every order is cash today
    expect(z.cashMinor).toBe(
      FETTUCCINE * 3 + PENNE_PESTO * 2 + DELIVERY_FEE * 2,
    );
    expect(z.deliveryFeesMinor).toBe(DELIVERY_FEE * 2);
  });

  it("best sellers rank by quantity with exact revenue", async () => {
    const best = await getBestSellers(todayLocal());
    // fettuccine sold 3×, penne pesto 2× (cancelled penne excluded)
    expect(best[0]?.nameAr).toBe("فيتوتشيني مع فطر");
    expect(best[0]?.qty).toBe(3);
    expect(best[0]?.revenueMinor).toBe(FETTUCCINE * 3);
    expect(best[1]?.qty).toBe(2);
    expect(best[1]?.revenueMinor).toBe(PENNE_PESTO * 2);
  });

  it("the 7-day series contains today with the same totals", async () => {
    const week = await getRecentDays(7, todayLocal());
    expect(week).toHaveLength(7);
    const today = week[week.length - 1];
    expect(today?.orderCount).toBe(5);
    expect(today?.revenueMinor).toBe(
      FETTUCCINE * 3 + PENNE_PESTO * 2 + DELIVERY_FEE * 2,
    );
    // and the series sums never double-count cancelled revenue
    const cancelledToday = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, "cancelled"));
    expect(cancelledToday[0]?.n).toBe(1);
  });

  it("counts dine-in independently from takeaway and delivery", async () => {
    const fettuccine = (await db.select().from(products)).find(
      (p) => p.slug === "fettuccine-mushroom",
    );
    if (!fettuccine) throw new Error("seed missing");
    const placed = await placeOrder(
      {
        idempotencyKey: `report-dine-in-${Date.now()}`,
        channel: "dine_in",
        customer: { name: "زبون المحل", phone: "0566064976", address: "" },
        lines: [{ productId: fettuccine.id, quantity: 1, selections: [] }],
      },
      { source: "console" },
    );
    expect(placed.ok).toBe(true);

    const summary = await getDaySummary(todayLocal());
    expect(summary.dineInCount).toBe(1);
    expect(summary.takeawayCount).toBe(3);
    expect(summary.deliveryCount).toBe(2);
  });
});
