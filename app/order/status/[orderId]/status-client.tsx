"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  HandPlatter,
  Loader2,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { Price } from "@/components/ui/price";
import { formatTimeAr, timeAgoAr } from "@/lib/format";
import { fetchOrderStatus } from "@/app/actions/orders";
import type { OrderStatusView } from "@/lib/server/orders";

export interface SerializableOrder {
  orderNumber: string;
  status: OrderStatusView["status"];
  channel: OrderStatusView["channel"];
  totalMinor: number;
  createdAt: string;
  items: OrderStatusView["items"];
}

const STEPS = [
  { key: "received", label: "وصل طلبك", icon: Clock },
  { key: "preparing", label: "جارٍ التحضير", icon: ChefHat },
  { key: "ready", label: "جاهز", icon: PackageCheck },
  { key: "completed", label: "تم التسليم", icon: CheckCircle2 },
] as const;

const TERMINAL = new Set(["completed", "cancelled"]);

export function OrderStatusClient({
  orderId,
  token,
  initial,
}: {
  orderId: string;
  token: string;
  initial: SerializableOrder;
}) {
  const [order, setOrder] = useState(initial);
  const terminal = TERMINAL.has(order.status);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (terminal) return;
    const poll = async () => {
      try {
        const fresh = await fetchOrderStatus(orderId, token);
        if (fresh) {
          setOrder((prev) =>
            prev.status === fresh.status
              ? prev
              : { ...prev, status: fresh.status },
          );
        }
      } catch {
        // transient network error — the next tick retries
      }
    };
    timer.current = setInterval(poll, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [orderId, token, terminal]);

  const currentIndex = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled";

  return (
    <div className="mt-8">
      {/* header card */}
      <div className="rounded-card border border-cream-200 bg-cream-100 p-6 text-center shadow-card">
        <p className="text-sm font-bold text-ink-soft">طلب رقم</p>
        <p className="font-display text-4xl font-bold text-basil-800" dir="ltr">
          {order.orderNumber}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1">
            {order.channel === "delivery" ? (
              <>
                <Bike className="size-3.5" aria-hidden /> توصيل
              </>
            ) : (
              <>
                <HandPlatter className="size-3.5" aria-hidden /> استلام من المحل
              </>
            )}
          </span>
          <span aria-hidden>·</span>
          <span>{timeAgoAr(order.createdAt)}</span>
          <span aria-hidden>·</span>
          <span dir="ltr">{formatTimeAr(order.createdAt)}</span>
        </div>
      </div>

      {/* timeline */}
      {cancelled ? (
        <div className="mt-6 flex items-center gap-3 rounded-card border border-terracotta/25 bg-terracotta/8 p-5">
          <XCircle className="size-7 shrink-0 text-terracotta" aria-hidden />
          <div>
            <p className="font-bold text-terracotta">تم إلغاء هذا الطلب</p>
            <p className="text-sm text-ink-soft">للاستفسار تواصل مع المحل.</p>
          </div>
        </div>
      ) : (
        <ol className="mt-6 space-y-1" aria-label="حالة الطلب">
          {STEPS.map((step, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={step.key}
                aria-current={current ? "step" : undefined}
                className="flex items-center gap-4"
              >
                <span
                  className={
                    done
                      ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-basil-600 text-cream-50"
                      : current
                        ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-basil-700 text-cream-50 shadow-lift"
                        : "flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-cream-300 bg-cream-100 text-ink-soft/50"
                  }
                >
                  {done ? (
                    <Check className="size-5" aria-hidden />
                  ) : current ? (
                    <step.icon
                      className="size-5 animate-pulse motion-reduce:animate-none"
                      aria-hidden
                    />
                  ) : (
                    <step.icon className="size-5" aria-hidden />
                  )}
                </span>
                <div className="flex-1 border-b border-cream-200 py-4">
                  <p
                    className={
                      current
                        ? "type-title text-basil-800"
                        : done
                          ? "font-bold text-ink"
                          : "font-bold text-ink-soft/50"
                    }
                  >
                    {step.label}
                  </p>
                  {current && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-basil-700">
                      <Loader2
                        className="size-3 animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                      جارٍ العمل عليه الآن
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* items + total */}
      <div className="mt-6 rounded-card border border-cream-200 bg-cream-100 p-5">
        <h2 className="text-sm font-bold text-ink">تفاصيل الطلب</h2>
        <ul className="mt-3 space-y-2.5">
          {order.items.map((it, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-bold text-ink">
                  {it.nameAr}{" "}
                  <span className="text-ink-soft">× {it.quantity}</span>
                </p>
                {it.detailAr && (
                  <p className="text-xs text-ink-soft">{it.detailAr}</p>
                )}
              </div>
              <Price minor={it.lineTotalMinor} className="shrink-0 text-ink" />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-cream-300 pt-3 font-bold">
          <span>الإجمالي (نقداً عند الاستلام)</span>
          <Price minor={order.totalMinor} className="text-basil-800" />
        </div>
      </div>

      {!terminal && (
        <p className="mt-6 text-center text-xs text-ink-soft">
          هذه الصفحة تتحدث تلقائياً — خلّيها مفتوحة
        </p>
      )}
    </div>
  );
}
