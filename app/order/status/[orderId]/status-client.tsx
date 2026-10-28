"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  HandPlatter,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { Price } from "@/components/ui/price";
import { TwirlLoader } from "@/components/ui/twirl-loader";
import { formatTimeAr, timeAgoAr } from "@/lib/format";
import { fetchOrderStatus } from "@/app/actions/orders";
import type { OrderStatusView } from "@/lib/server/orders";

export interface SerializableOrder {
  orderNumber: string;
  status: OrderStatusView["status"];
  channel: OrderStatusView["channel"];
  subtotalMinor: number;
  deliveryFeeMinor: number;
  zoneNameAr: string | null;
  totalMinor: number;
  createdAt: string;
  updatedAt: string;
  items: OrderStatusView["items"];
}

const STEPS = [
  {
    key: "received",
    label: "وصل طلبك",
    hint: "وصلنا طلبك — بدأنا نجهزه فوراً",
  },
  { key: "preparing", label: "جارٍ التحضير", hint: "الباستا تُعجن وتُلف الآن" },
  { key: "ready", label: "جاهزة!", hint: "طبقك جاهز بالصلصة والمحبة" },
  { key: "completed", label: "تم التسليم", hint: "بالهناء والشفاء 🌿" },
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

  // Relative time depends on the client clock; render the deterministic
  // absolute time during SSR, then add "منذ …" after hydration.
  // useSyncExternalStore gives a hydration-safe "is client" flag without a
  // cascading setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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
  const ready = order.status === "ready";

  return (
    <div className="mt-8">
      {/* header card — the order identity */}
      <div className="relative overflow-hidden rounded-card border border-border-soft bg-surface-raised p-6 text-center shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute start-1/2 -top-16 size-40 -translate-x-1/2 rounded-full bg-basil-50 blur-2xl"
        />
        <p className="relative text-sm font-bold text-text-secondary">
          طلب رقم
        </p>
        <p
          className="relative font-display text-4xl font-bold text-basil-800"
          dir="ltr"
        >
          {order.orderNumber}
        </p>
        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-text-secondary">
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
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {mounted ? `${timeAgoAr(order.createdAt)} — ` : null}
            <span dir="ltr">{formatTimeAr(order.createdAt)}</span>
          </span>
        </div>
      </div>

      {/* journey — connected rail with the twirl as the live marker */}
      {cancelled ? (
        <div className="mt-6 flex items-center gap-3 rounded-card border border-terracotta/25 bg-terracotta/8 p-5">
          <XCircle className="size-7 shrink-0 text-terracotta" aria-hidden />
          <div>
            <p className="font-bold text-terracotta">تم إلغاء هذا الطلب</p>
            <p className="text-sm text-text-secondary">
              للاستفسار تواصل مع المحل.
            </p>
          </div>
        </div>
      ) : (
        <ol className="relative mt-7" aria-label="حالة الطلب">
          {/* rail: filled portion up to the current step */}
          <span
            aria-hidden
            className="absolute start-[21px] top-3 bottom-3 w-0.5 rounded-full bg-border-soft"
          />
          <span
            aria-hidden
            className="absolute start-[21px] top-3 w-0.5 rounded-full bg-basil-500 transition-all duration-500 motion-reduce:transition-none"
            style={{
              height: `calc(${(Math.max(currentIndex, 0) / (STEPS.length - 1)) * 100}% - 12px)`,
            }}
          />
          {STEPS.map((step, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={step.key}
                aria-current={current ? "step" : undefined}
                className="relative flex items-start gap-4 pb-8 last:pb-0"
              >
                <span
                  className={
                    done
                      ? "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-basil-600 text-cream-50"
                      : current
                        ? "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-basil-700 text-cream-50 shadow-lift"
                        : "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface-raised text-ink-soft/50"
                  }
                >
                  {done ? (
                    <Check className="size-5" aria-hidden />
                  ) : current ? (
                    <TwirlLoader
                      className="size-7"
                      label={`${step.label} — جارٍ الآن`}
                    />
                  ) : (
                    <StepIcon className="size-5" step={step.key} />
                  )}
                </span>
                <div className="pt-1.5">
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
                  {(current || done) && (
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {step.hint}
                    </p>
                  )}
                </div>
                {ready && current && (
                  <span className="ms-auto inline-flex animate-pop items-center gap-1.5 self-center rounded-full bg-wheat-300 px-3.5 py-1.5 text-xs font-bold text-basil-950 motion-reduce:animate-none">
                    <ChefHat className="size-3.5" aria-hidden />
                    جاهزة للاستلام
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* items + total */}
      <div className="mt-6 rounded-card border border-border-soft bg-surface-raised p-5">
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
                  <span className="text-text-secondary">× {it.quantity}</span>
                </p>
                {it.detailAr && (
                  <p className="text-xs text-text-secondary">{it.detailAr}</p>
                )}
              </div>
              <Price minor={it.lineTotalMinor} className="shrink-0 text-ink" />
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-border-strong pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">المجموع</dt>
            <dd>
              <Price minor={order.subtotalMinor} />
            </dd>
          </div>
          {order.channel === "delivery" && (
            <div className="flex justify-between">
              <dt className="text-text-secondary">
                التوصيل{order.zoneNameAr ? ` — ${order.zoneNameAr}` : ""}
              </dt>
              <dd>
                <Price minor={order.deliveryFeeMinor} />
              </dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold">
            <dt>الإجمالي (نقداً عند الاستلام)</dt>
            <dd>
              <Price minor={order.totalMinor} className="text-basil-800" />
            </dd>
          </div>
        </dl>
      </div>

      {!terminal && (
        <p className="mt-6 text-center text-xs text-text-secondary">
          هذه الصفحة تتحدث تلقائياً — خلّيها مفتوحة
        </p>
      )}
    </div>
  );
}

function StepIcon({
  step,
  className,
}: {
  step: (typeof STEPS)[number]["key"];
  className?: string;
}) {
  const icons = {
    received: Clock,
    preparing: ChefHat,
    ready: PackageCheck,
    completed: CheckCircle2,
  } as const;
  const Icon = icons[step];
  return <Icon className={className} aria-hidden />;
}
