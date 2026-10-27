import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/db/schema";

/**
 * Reporting queries (Phase 3, spec §8.2) — all money in integer agorot,
 * all windows are the STORE'S LOCAL days (Ayasofia lesson: never mix a
 * UTC-parsed date with a local end-of-day). Cancelled orders are reported
 * separately, never inside revenue.
 */

export interface DaySummary {
  date: string; // YYYY-MM-DD (local calendar day)
  orderCount: number;
  revenueMinor: number;
  cancelledCount: number;
  cancelledMinor: number;
  deliveryCount: number;
  takeawayCount: number;
  avgOrderMinor: number;
}

export function toLocalDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayLocal(): string {
  return toLocalDayString(new Date());
}

function localDayRange(dateStr: string): { start: Date; end: Date } {
  const parts = dateStr.split("-").map((n) => Number.parseInt(n, 10));
  const y = parts[0] ?? 1970;
  const m = (parts[1] ?? 1) - 1;
  const d = parts[2] ?? 1;
  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d + 1, 0, 0, 0, 0);
  return { start, end };
}

const summarySelect = {
  orderCount: sql<number>`count(*) filter (where status != 'cancelled')::int`,
  revenueMinor: sql<number>`coalesce(sum(total_minor) filter (where status != 'cancelled'), 0)::int`,
  cancelledCount: sql<number>`count(*) filter (where status = 'cancelled')::int`,
  cancelledMinor: sql<number>`coalesce(sum(total_minor) filter (where status = 'cancelled'), 0)::int`,
  deliveryCount: sql<number>`count(*) filter (where channel = 'delivery' and status != 'cancelled')::int`,
  takeawayCount: sql<number>`count(*) filter (where channel = 'takeaway' and status != 'cancelled')::int`,
};

function finalize(
  date: string,
  row: Omit<DaySummary, "date" | "avgOrderMinor"> | undefined,
): DaySummary {
  const r = row ?? {
    orderCount: 0,
    revenueMinor: 0,
    cancelledCount: 0,
    cancelledMinor: 0,
    deliveryCount: 0,
    takeawayCount: 0,
  };
  return {
    date,
    ...r,
    avgOrderMinor:
      r.orderCount > 0 ? Math.round(r.revenueMinor / r.orderCount) : 0,
  };
}

export async function getDaySummary(dateStr: string): Promise<DaySummary> {
  const { start, end } = localDayRange(dateStr);
  const [row] = await db
    .select(summarySelect)
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)));
  return finalize(dateStr, row);
}

/** Last `days` local days, oldest first — one grouped query in the store TZ. */
export async function getRecentDays(
  days: number,
  endDateStr: string,
): Promise<DaySummary[]> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { start } = localDayRange(endDateStr);
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - (days - 1));
  const { end } = localDayRange(endDateStr);
  end.setDate(end.getDate() + 1);

  const rows = await db
    .select({
      day: sql<string>`to_char(created_at AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      ...summarySelect,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, weekStart), lt(orders.createdAt, end)))
    // positional grouping: the tz bind parameter appears twice with
    // different placeholders ($1/$4), which Postgres cannot match —
    // GROUP BY 1 refers to the first select column instead.
    .groupBy(sql`1`);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DaySummary[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const key = toLocalDayString(d);
    out.push(finalize(key, byDay.get(key)));
  }
  return out;
}

export async function getBestSellers(
  dateStr: string,
  limit = 5,
): Promise<Array<{ nameAr: string; qty: number; revenueMinor: number }>> {
  const { start, end } = localDayRange(dateStr);
  const rows = await db
    .select({
      nameAr: orderItems.nameAr,
      qty: sql<number>`sum(${orderItems.quantity})::int`,
      revenueMinor: sql<number>`sum(${orderItems.lineTotalMinor})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
        sql`${orders.status} != 'cancelled'`,
      ),
    )
    .groupBy(orderItems.nameAr)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(limit);
  return rows;
}

/** Z-style end-of-day cash view — reconciliation basis for the drawer. */
export async function getZSummary(dateStr: string): Promise<{
  cashMinor: number;
  cashCount: number;
  deliveryFeesMinor: number;
}> {
  const { start, end } = localDayRange(dateStr);
  const [row] = await db
    .select({
      cashMinor: sql<number>`coalesce(sum(total_minor) filter (where payment_method = 'cash' and status != 'cancelled'), 0)::int`,
      cashCount: sql<number>`count(*) filter (where payment_method = 'cash' and status != 'cancelled')::int`,
      deliveryFeesMinor: sql<number>`coalesce(sum(delivery_fee_minor) filter (where status != 'cancelled'), 0)::int`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)));
  return row ?? { cashMinor: 0, cashCount: 0, deliveryFeesMinor: 0 };
}
