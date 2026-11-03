import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  Bike,
  Clock,
  MapPin,
  Phone,
  ReceiptText,
  StickyNote,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/console/order-status-badge";
import { Price } from "@/components/ui/price";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payment";
import {
  formatDateInShop,
  formatTimeInShop,
  toDayString,
} from "@/lib/domain/time";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  SOURCE_LABELS,
} from "@/lib/order-labels";
import { getOrderDetail } from "@/lib/server/orders";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تفاصيل الطلب",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");

  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const day = toDayString(order.createdAt);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/console/orders?date=${day}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand transition-colors hover:text-brand-strong"
        >
          <ArrowRight className="size-4" aria-hidden />
          رجوع للأرشيف
        </Link>
        <Link
          href={`/console/orders/${order.id}/receipt`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-action-text shadow-card transition-colors hover:bg-action-hover"
        >
          <ReceiptText className="size-4" aria-hidden />
          الإيصال
        </Link>
      </div>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="font-display text-3xl font-bold text-text-primary"
            dir="ltr"
          >
            {order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
          <span>{formatDateInShop(order.createdAt)}</span>
          <span className="tabular-nums">
            {formatTimeInShop(order.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            {order.channel === "delivery" ? (
              <Bike className="size-3.5" aria-hidden />
            ) : (
              <Clock className="size-3.5" aria-hidden />
            )}
            {CHANNEL_LABELS[order.channel] ?? order.channel}
          </span>
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold">
            {SOURCE_LABELS[order.source] ?? order.source}
          </span>
        </p>
      </header>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-border-soft bg-surface-raised p-4">
          <h2 className="text-sm font-bold text-text-primary">الزبون</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-text-secondary">الاسم</dt>
              <dd className="font-bold text-text-primary">
                {order.customerName || "—"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-text-secondary">الهاتف</dt>
              <dd>
                <a
                  href={`tel:${order.customerPhone}`}
                  dir="ltr"
                  className="inline-flex items-center gap-1 font-bold text-brand tabular-nums"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {order.customerPhone}
                </a>
              </dd>
            </div>
            {order.address && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-secondary">العنوان</dt>
                <dd className="text-end font-bold text-text-primary">
                  {order.address}
                </dd>
              </div>
            )}
            {order.zoneNameAr && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-secondary">المنطقة</dt>
                <dd className="font-bold text-text-primary">
                  {order.zoneNameAr}
                </dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <dt className="text-text-secondary">الدفع</dt>
              <dd className="font-bold text-text-primary">
                {PAYMENT_METHOD_LABELS[order.paymentMethod]}
              </dd>
            </div>
          </dl>
          {order.customerNote && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-xs font-bold text-warning">
              <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {order.customerNote}
            </p>
          )}
        </section>

        <section className="rounded-card border border-border-soft bg-surface-raised p-4">
          <h2 className="text-sm font-bold text-text-primary">الطلب</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-text-secondary">المجموع</dt>
              <dd>
                <Price minor={order.subtotalMinor} />
              </dd>
            </div>
            {order.channel === "delivery" && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-text-secondary">التوصيل</dt>
                <dd>
                  <Price minor={order.deliveryFeeMinor} />
                </dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 border-t border-border-soft pt-2 text-base">
              <dt className="font-bold text-text-primary">الإجمالي</dt>
              <dd>
                <Price
                  minor={order.totalMinor}
                  className="font-extrabold text-brand-strong"
                />
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-text-secondary">آخر تحديث</dt>
              <dd className="text-text-primary tabular-nums">
                {formatTimeInShop(order.updatedAt)}
              </dd>
            </div>
          </dl>
          {order.status === "cancelled" && order.cancelledReason && (
            <p className="mt-3 rounded-lg bg-danger/10 p-2.5 text-xs font-bold text-danger">
              سبب الإلغاء: {order.cancelledReason}
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-card border border-border-soft bg-surface-raised p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-text-primary">الأصناف</h2>
          <span className="text-xs text-text-secondary">
            {order.itemCount} قطعة
          </span>
        </div>
        <ul className="mt-3 divide-y divide-border-soft">
          {order.items.map((item) => (
            <li key={item.id} className="py-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-text-primary">
                    {item.quantity}× {item.nameAr}
                  </p>
                  {item.detailAr && (
                    <p className="text-xs text-text-secondary">
                      {item.detailAr}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-xs font-bold text-warning">
                      ✎ {item.note}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-end">
                  <Price
                    minor={item.lineTotalMinor}
                    className="font-bold text-text-primary"
                  />
                  <p className="text-[11px] text-text-secondary">
                    <Price minor={item.unitPriceMinor} /> للقطعة
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-card border border-border-soft bg-surface-raised p-4">
        <h2 className="text-sm font-bold text-text-primary">سجل الحالة</h2>
        <ol className="mt-3 space-y-3">
          {order.history.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 text-sm">
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
                aria-hidden
              />
              <div>
                <p className="font-bold text-text-primary">
                  {entry.fromStatus
                    ? `${ORDER_STATUS_LABELS[entry.fromStatus]} ← ${ORDER_STATUS_LABELS[entry.toStatus]}`
                    : `إنشاء الطلب (${ORDER_STATUS_LABELS[entry.toStatus]})`}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatTimeInShop(entry.createdAt)}
                  {entry.actorName ? ` · ${entry.actorName}` : ""}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-text-secondary">
        <MapPin className="size-3.5" aria-hidden />
        هذه الصفحة داخل الكونسول — لا تُشارك مع الزبون. رابط الزبون هو صفحة
        الحالة الخاصة بطلبه.
      </p>
    </div>
  );
}
