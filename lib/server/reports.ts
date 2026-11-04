import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/db/schema";
import {
  SHOP_TZ,
  addDays,
  toDayString,
  todayInShop,
  zonedDayRange,
} from "@/lib/domain/time";

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
  dineInCount: number;
  avgOrderMinor: number;
}

/** Backwards-compatible names; the shop timezone is always Asia/Hebron. */
export const toLocalDayString = (date: Date): string => toDayString(date);
export const todayLocal = (): string => todayInShop();

function localDayRange(dateStr: string): { start: Date; end: Date } {
  return zonedDayRange(dateStr);
}

const summarySelect = {
  orderCount: sql<number>`count(*) filter (where status != 'cancelled')::int`,
  revenueMinor: sql<number>`coalesce(sum(total_minor) filter (where status != 'cancelled'), 0)::int`,
  cancelledCount: sql<number>`count(*) filter (where status = 'cancelled')::int`,
  cancelledMinor: sql<number>`coalesce(sum(total_minor) filter (where status = 'cancelled'), 0)::int`,
  deliveryCount: sql<number>`count(*) filter (where channel = 'delivery' and status != 'cancelled')::int`,
  takeawayCount: sql<number>`count(*) filter (where channel = 'takeaway' and status != 'cancelled')::int`,
  dineInCount: sql<number>`count(*) filter (where channel = 'dine_in' and status != 'cancelled')::int`,
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
    dineInCount: 0,
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
  const startDay = addDays(endDateStr, -(days - 1));
  const weekStart = zonedDayRange(startDay).start;
  const end = zonedDayRange(endDateStr).end;

  const rows = await db
    .select({
      day: sql<string>`to_char(created_at AT TIME ZONE ${SHOP_TZ}, 'YYYY-MM-DD')`,
      ...summarySelect,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, weekStart), lt(orders.createdAt, end)))
    // positional grouping: the tz bind parameter appears twice with
    // different placeholders, which Postgres cannot match — GROUP BY 1
    // refers to the first select column instead.
    .groupBy(sql`1`);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DaySummary[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = addDays(endDateStr, -i);
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
