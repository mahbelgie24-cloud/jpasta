import { requireOwner } from "@/lib/server/session";
import { getOrdersForDay } from "@/lib/server/orders";
import { getDaySummary, getZSummary, todayLocal } from "@/lib/server/reports";
import { formatPrice } from "@/lib/pricing";
import { toCsvWithBom } from "@/lib/csv";
import { formatTimeInShop24 } from "@/lib/domain/time";
import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Owner-only accounting export. Default is PII-free; `pii=1` includes the
 * delivery contact fields and writes an audit event (never the values).
 * Every cell is formula-injection-safe (lib/csv.ts).
 */
export async function GET(request: Request) {
  try {
    await requireOwner();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayLocal();
  const kind = url.searchParams.get("kind") === "z" ? "z" : "orders";
  const includePii = url.searchParams.get("pii") === "1";

  try {
    let rows: unknown[][];

    if (kind === "z") {
      const [summary, z] = await Promise.all([
        getDaySummary(date),
        getZSummary(date),
      ]);
      rows = [
        ["metric", "value"],
        ["date", date],
        ["orders", summary.orderCount],
        ["revenue_ils", formatPrice(summary.revenueMinor)],
        ["cancelled_count", summary.cancelledCount],
        ["cancelled_ils", formatPrice(summary.cancelledMinor)],
        ["delivery_count", summary.deliveryCount],
        ["takeaway_count", summary.takeawayCount],
        ["avg_order_ils", formatPrice(summary.avgOrderMinor)],
        ["cash_ils", formatPrice(z.cashMinor)],
        ["cash_count", z.cashCount],
        ["delivery_fees_ils", formatPrice(z.deliveryFeesMinor)],
      ];
    } else {
      const orders = await getOrdersForDay(date);
      const header = [
        "order_number",
        "time",
        "status",
        "channel",
        "source",
        "payment_method",
        "item_count",
        "items",
        "subtotal_ils",
        "delivery_ils",
        "total_ils",
        "cancelled_reason",
      ];
      if (includePii) header.push("customer_name", "customer_phone", "address");

      rows = [
        header,
        ...orders.map((order) => {
          const row: unknown[] = [
            order.orderNumber,
            formatTimeInShop24(order.createdAt),
            order.status,
            order.channel,
            order.source,
            order.paymentMethod,
            order.itemCount,
            order.itemsSummary.join(" | "),
            formatPrice(order.subtotalMinor),
            formatPrice(order.deliveryFeeMinor),
            formatPrice(order.totalMinor),
            order.cancelledReason ?? "",
          ];
          if (includePii) {
            row.push(
              order.customerName,
              order.customerPhone,
              order.address ?? "",
            );
          }
          return row;
        }),
      ];

      if (includePii) {
        logEvent("info", "reports.export_pii", {
          date,
          rows: orders.length,
        });
      }
    }

    return new Response(toCsvWithBom(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="jpasta-${kind}-${date}.csv"`,
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    logEvent("error", "reports.export_failed", {
      kind,
      date,
      message: err instanceof Error ? err.message : "unknown",
    });
    return new Response("export failed", { status: 500 });
  }
}
