import { notFound } from "next/navigation";
import { Clock, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { OrderStatusClient, type SerializableOrder } from "./status-client";
import { getOrderForStatus } from "@/lib/server/orders";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderId } = await params;
  const { t } = await searchParams;
  const order = await getOrderForStatus(orderId, t ?? "");

  // A missing order or a stale capability token is a real 404 — not a 200
  // with a friendly message (soft 404s confuse crawlers and monitoring).
  if (!order) notFound();

  const initial: SerializableOrder = {
    orderNumber: order.orderNumber,
    status: order.status,
    channel: order.channel,
    paymentMethod: order.paymentMethod,
    subtotalMinor: order.subtotalMinor,
    deliveryFeeMinor: order.deliveryFeeMinor,
    zoneNameAr: order.zoneNameAr,
    totalMinor: order.totalMinor,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items,
  };

  return (
    <main id="main" tabIndex={-1} className="min-h-dvh bg-cream-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <OrderStatusClient
          orderId={orderId}
          token={t ?? ""}
          initial={initial}
        />
        <div className="mt-8 flex items-center justify-center gap-5 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            {SITE.hoursLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden />
            {SITE.addressAr}
          </span>
        </div>
      </div>
    </main>
  );
}
