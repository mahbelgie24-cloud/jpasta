import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PrintButton } from "@/components/console/print-button";
import { Price } from "@/components/ui/price";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/payment";
import { formatDateInShop, formatTimeInShop } from "@/lib/domain/time";
import { CHANNEL_LABELS, ORDER_STATUS_LABELS } from "@/lib/order-labels";
import { getOrderDetail } from "@/lib/server/orders";
import { getSessionUser } from "@/lib/server/session";
import { getShopSettings } from "@/lib/server/settings";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إيصال الطلب",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");

  const { orderId } = await params;
  const [order, shop] = await Promise.all([
    getOrderDetail(orderId),
    getShopSettings(),
  ]);
  if (!order) notFound();

  return (
    <div className="min-h-dvh bg-white px-4 py-8 text-black print:px-0 print:py-0">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          html, body { background: #fff !important; }
          [data-print-hide] { display: none !important; }
        }
      `}</style>

      <div
        data-print-hide
        className="mx-auto mb-6 flex w-full max-w-sm items-center justify-between gap-2 print:hidden"
      >
        <Link
          href={`/console/orders/${order.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-black/70 hover:text-black"
        >
          <ArrowRight className="size-4" aria-hidden />
          رجوع للطلب
        </Link>
        <PrintButton />
      </div>

      <article
        className="mx-auto w-full max-w-sm print:max-w-[80mm]"
        aria-label={`إيصال الطلب ${order.orderNumber}`}
      >
        <header className="text-center">
          <LogoMark mono decorative className="mx-auto size-16" />
          <h1 className="mt-2 text-xl font-extrabold">
            {shop.shopName || SITE.name}
          </h1>
          <p className="text-xs text-black/60">{SITE.secondaryLine}</p>
          <p className="mt-1 text-xs text-black/60">{SITE.addressAr}</p>
          <p className="text-xs text-black/60" dir="ltr">
            {shop.shopPhone || SITE.phoneDisplay}
          </p>
        </header>

        <div className="mt-4 border-y border-dashed border-black/30 py-2 text-center">
          <p className="text-xs text-black/60">إيصال طلب</p>
          <p className="font-display text-2xl font-bold" dir="ltr">
            {order.orderNumber}
          </p>
          <p className="text-xs text-black/60 tabular-nums">
            {formatDateInShop(order.createdAt)} ·{" "}
            {formatTimeInShop(order.createdAt)}
          </p>
          {order.status === "cancelled" && (
            <p className="mt-1 text-sm font-extrabold">** ملغى **</p>
          )}
        </div>

        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-black/60">النوع</dt>
            <dd className="font-bold">
              {CHANNEL_LABELS[order.channel] ?? order.channel}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-black/60">الحالة</dt>
            <dd className="font-bold">{ORDER_STATUS_LABELS[order.status]}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-black/60">الدفع</dt>
            <dd className="font-bold">
              {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-black/60">الزبون</dt>
            <dd className="font-bold">{order.customerName || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-black/60">الهاتف</dt>
            <dd className="font-bold" dir="ltr">
              {order.customerPhone}
            </dd>
          </div>
          {order.address && (
            <div className="flex justify-between gap-2">
              <dt className="text-black/60">العنوان</dt>
              <dd className="text-end font-bold">{order.address}</dd>
            </div>
          )}
          {order.zoneNameAr && (
            <div className="flex justify-between gap-2">
              <dt className="text-black/60">المنطقة</dt>
              <dd className="font-bold">{order.zoneNameAr}</dd>
            </div>
          )}
        </dl>

        <ul className="mt-3 border-t border-dashed border-black/30 pt-2 text-xs">
          {order.items.map((item) => (
            <li key={item.id} className="py-1">
              <div className="flex justify-between gap-2">
                <span className="font-bold">
                  {item.quantity}× {item.nameAr}
                </span>
                <Price
                  minor={item.lineTotalMinor}
                  className="shrink-0 font-bold"
                />
              </div>
              {item.detailAr && (
                <p className="text-[11px] text-black/60">{item.detailAr}</p>
              )}
              {item.note && (
                <p className="text-[11px] font-bold">✎ {item.note}</p>
              )}
            </li>
          ))}
        </ul>

        <dl className="mt-2 space-y-1 border-t border-dashed border-black/30 pt-2 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-black/60">المجموع</dt>
            <dd>
              <Price minor={order.subtotalMinor} />
            </dd>
          </div>
          {order.channel === "delivery" && (
            <div className="flex justify-between gap-2">
              <dt className="text-black/60">التوصيل</dt>
              <dd>
                <Price minor={order.deliveryFeeMinor} />
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2 border-t border-black/30 pt-1 text-sm">
            <dt className="font-extrabold">الإجمالي</dt>
            <dd>
              <Price minor={order.totalMinor} className="font-extrabold" />
            </dd>
          </div>
        </dl>

        {order.customerNote && (
          <p className="mt-2 border-t border-dashed border-black/30 pt-2 text-xs">
            ملاحظة: {order.customerNote}
          </p>
        )}

        <footer className="mt-4 border-t border-dashed border-black/30 pt-2 text-center">
          <p className="text-xs font-bold">{shop.receiptFooter}</p>
          <p className="mt-1 text-[10px] text-black/70">
            {shop.shopName || SITE.name}
          </p>
        </footer>
      </article>
    </div>
  );
}
