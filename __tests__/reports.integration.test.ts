import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { orders, products } from "@/db/schema";
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

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

const ALFREDO = 2400;
const MARINARA = 1900;
const DELIVERY_FEE = 500;

d("reports — the manual-count DoD", () => {
  beforeAll(async () => {
    const alfredo = (await db.select().from(products)).find(
      (p) => p.slug === "alfredo-classico",
    );
    const marinara = (await db.select().from(products)).find(
      (p) => p.slug === "marinara",
    );
    if (!alfredo || !marinara) throw new Error("seed missing");
    await db.execute(sql`TRUNCATE order_items, orders CASCADE`);

    // 3 takeaway + 2 delivery + 1 cancelled = 6 orders
    // revenue: (24 + 19 + 24) + (24+5 + 19+5) = 120.00 ; cancelled 19.00
    const mk = (i: number, channel: "takeaway" | "delivery", pid: string) =>
      placeOrder({
        idempotencyKey: `report-dod-${i}`,
        channel,
        customer: {
          name: `زبون ${i}`,
          phone: "0566064976",
          address: channel === "delivery" ? "حي المركز" : "",
        },
        lines: [
          {
            productId: pid,
            quantity: 1,
            selections: [{ groupKey: "size", optionKey: "regular" }],
          },
        ],
        source: "console",
      });

    const results = await Promise.all([
      mk(1, "takeaway", alfredo.id),
      mk(2, "takeaway", marinara.id),
      mk(3, "takeaway", alfredo.id),
      mk(4, "delivery", alfredo.id),
      mk(5, "delivery", marinara.id),
    ]);
    const cancelled = await mk(6, "takeaway", marinara.id);

    for (const r of results) expect(r.ok).toBe(true);
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      const res = await transitionOrder(cancelled.order.id, "cancelled");
      expect(res.ok).toBe(true);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("day summary matches the manual count exactly", async () => {
    const summary = await getDaySummary(todayLocal());
    // manual count: 3 takeaway (24+19+24) + 2 delivery (24+5, 19+5) = 120.00
    expect(summary.orderCount).toBe(5);
    expect(summary.revenueMinor).toBe(
      ALFREDO * 3 + MARINARA * 2 + DELIVERY_FEE * 2,
    );
    expect(summary.deliveryCount).toBe(2);
    expect(summary.takeawayCount).toBe(3);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.cancelledMinor).toBe(MARINARA);
    expect(summary.avgOrderMinor).toBe(Math.round(summary.revenueMinor / 5));
  });

  it("Z cash view totals the drawer exactly", async () => {
    const z = await getZSummary(todayLocal());
    expect(z.cashCount).toBe(5); // every order is cash today
    expect(z.cashMinor).toBe(ALFREDO * 3 + MARINARA * 2 + DELIVERY_FEE * 2);
    expect(z.deliveryFeesMinor).toBe(DELIVERY_FEE * 2);
  });

  it("best sellers rank by quantity with exact revenue", async () => {
    const best = await getBestSellers(todayLocal());
    // alfredo sold 3×, marinara 2× (cancelled marinara excluded)
    expect(best[0]?.nameAr).toBe("ألفريدو الكلاسيك");
    expect(best[0]?.qty).toBe(3);
    expect(best[0]?.revenueMinor).toBe(ALFREDO * 3);
    expect(best[1]?.qty).toBe(2);
    expect(best[1]?.revenueMinor).toBe(MARINARA * 2);
  });

  it("the 7-day series contains today with the same totals", async () => {
    const week = await getRecentDays(7, todayLocal());
    expect(week).toHaveLength(7);
    const today = week[week.length - 1];
    expect(today?.orderCount).toBe(5);
    expect(today?.revenueMinor).toBe(
      ALFREDO * 3 + MARINARA * 2 + DELIVERY_FEE * 2,
    );
    // and the series sums never double-count cancelled revenue
    const cancelledToday = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, "cancelled"));
    expect(cancelledToday[0]?.n).toBe(1);
  });
});
