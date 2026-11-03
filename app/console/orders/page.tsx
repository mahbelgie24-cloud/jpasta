import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  ShoppingBag,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/console/order-status-badge";
import { Price } from "@/components/ui/price";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_OPTIONS,
  type OrderStatusKey,
} from "@/lib/order-labels";
import {
  addDays,
  formatDateInShop,
  formatTimeInShop,
  todayInShop,
  zonedTimeToUtc,
} from "@/lib/domain/time";
import { getOrdersForDay } from "@/lib/server/orders";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "أرشيف الطلبات",
  robots: { index: false, follow: false },
};

const STATUSES = new Set<string>([
  "all",
  "received",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

function hrefFor(date: string, status: string, query: string): string {
  const params = new URLSearchParams({ date });
  if (status !== "all") params.set("status", status);
  if (query) params.set("q", query);
  return `/console/orders?${params.toString()}`;
}

export default async function OrdersArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");

  const params = await searchParams;
  const today = todayInShop();
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;
  const status =
    params.status && STATUSES.has(params.status) ? params.status : "all";
  const query = (params.q ?? "").slice(0, 80);

  const orders = await getOrdersForDay(date, {
    status: status as OrderStatusKey | "all",
    query,
  });
  const active = orders.filter((order) => order.status !== "cancelled");
  const revenue = active.reduce((sum, order) => sum + order.totalMinor, 0);
  const dayLabel = formatDateInShop(zonedTimeToUtc(`${date}T12:00:00`));
  const atToday = date >= today;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-5 pb-16 sm:px-6">
      <Link
        href="/console"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand transition-colors hover:text-brand-strong"
      >
        <ArrowRight className="size-4" aria-hidden />
        رجوع للوحة
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-section text-text-primary">أرشيف الطلبات</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {dayLabel} · {orders.length} طلب · إيراد{" "}
            <Price minor={revenue} className="font-bold text-text-primary" />
          </p>
        </div>
        <Link
          href={hrefFor(today, status, query)}
          className="inline-flex min-h-11 items-center rounded-full border border-border-strong bg-surface-raised px-4 text-sm font-bold text-text-secondary hover:text-text-primary"
        >
          اليوم
        </Link>
      </div>

      {/* Filters — a plain GET form: server-rendered, keyboard-friendly. */}
      <form
        method="get"
        action="/console/orders"
        className="mt-5 grid gap-2 rounded-card border border-border-soft bg-surface-raised p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-text-secondary">اليوم</span>
          <input
            type="date"
            name="date"
            defaultValue={date}
            dir="ltr"
            className="min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-text-secondary">الحالة</span>
          <select
            name="status"
            defaultValue={status}
            className="min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none focus:border-brand"
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-text-secondary">
            بحث (رقم الطلب / الاسم / الهاتف / الصنف)
          </span>
          <span className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={80}
              placeholder="JP-… أو اسم الزبون"
              className="min-h-11 w-full rounded-md border border-border-strong bg-surface ps-9 pe-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/60 focus:border-brand"
            />
          </span>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-full bg-brand px-5 text-sm font-bold text-action-text transition-colors hover:bg-action-hover"
        >
          <Search className="size-4" aria-hidden />
          تصفية
        </button>
      </form>

      {/* Day navigation */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={hrefFor(addDays(date, -1), status, query)}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
        >
          <ChevronRight className="size-4" aria-hidden />
          اليوم السابق
        </Link>
        <Link
          href={hrefFor(addDays(date, 1), status, query)}
          aria-disabled={atToday}
          className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold ${
            atToday
              ? "pointer-events-none text-text-secondary/30"
              : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
          }`}
        >
          اليوم التالي
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface-raised p-12 text-center">
          <ShoppingBag
            className="mx-auto size-10 text-text-secondary"
            aria-hidden
          />
          <p className="mt-3 text-xl font-bold text-text-primary">
            لا طلبات مطابقة
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            جرّب يوماً آخر أو امسح البحث.
          </p>
          <Link
            href={hrefFor(date, "all", "")}
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border-strong px-5 text-sm font-bold text-text-primary"
          >
            مسح البحث
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/console/orders/${order.id}`}
                className="block rounded-card border border-border-soft bg-surface-raised p-4 shadow-card transition-colors hover:border-brand/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-display text-lg font-bold text-text-primary"
                      dir="ltr"
                    >
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {formatTimeInShop(order.createdAt)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold text-text-primary">
                    {order.customerName || "زبون"}
                  </span>
                  <span
                    dir="ltr"
                    className="text-xs font-bold text-text-secondary tabular-nums"
                  >
                    {order.customerPhone}
                  </span>
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                    {CHANNEL_LABELS[order.channel] ?? order.channel}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <p className="line-clamp-1 text-xs text-text-secondary">
                    {order.itemsSummary.join(" · ") || "—"}
                    {order.itemCount > order.itemsSummary.length
                      ? ` · +${order.itemCount - order.itemsSummary.length}`
                      : ""}
                  </p>
                  <Price
                    minor={order.totalMinor}
                    className="font-bold text-text-primary"
                  />
                </div>

                {order.status === "cancelled" && order.cancelledReason && (
                  <p className="mt-2 text-xs font-bold text-danger">
                    سبب الإلغاء: {order.cancelledReason}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-text-secondary">
        الأرشيف يعرض حتى 200 طلب لليوم المحدد — البحث يعمل على رقم الطلب والاسم
        والهاتف وأصناف الطلب.
      </p>
    </div>
  );
}
