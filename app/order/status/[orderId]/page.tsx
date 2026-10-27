import { Clock, MapPin } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
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

  if (!order) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <LogoMark className="size-16" />
        <h1 className="mt-6 type-section text-ink">الطلب غير موجود</h1>
        <p className="mt-3 max-w-sm text-ink-soft">
          تأكد أنك فتحت الرابط الصحيح — روابط متابعة الطلب خاصة بكل طلب.
        </p>
        <p className="mt-6 text-sm text-ink-soft">
          للاستفسار:{" "}
          <span dir="ltr" className="font-bold tabular-nums">
            {SITE.phoneDisplay}
          </span>
        </p>
      </main>
    );
  }

  const initial: SerializableOrder = {
    orderNumber: order.orderNumber,
    status: order.status,
    channel: order.channel,
    totalMinor: order.totalMinor,
    createdAt: order.createdAt.toISOString(),
    items: order.items,
  };

  return (
    <main className="min-h-dvh bg-cream-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="flex items-center justify-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="font-display text-xl font-semibold text-basil-800">
            JPasta
          </span>
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
