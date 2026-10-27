"use client";

import { useEffect, useState } from "react";
import { Bike, ChefHat, HandPlatter, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useOrdersFeed, type FeedOrder } from "@/hooks/use-orders-feed";
import { advanceOrder } from "@/app/actions/console";

/**
 * Kitchen display (Phase 2) — reading-at-a-distance sizing: huge order
 * numbers, large item text, elapsed-time chips that shift color as a
 * ticket ages (< 5min basil, 5–10 bronze, 10+ terracotta). Tap advances
 * received → preparing → ready. No cancel here: cancellations belong to
 * the console board where the customer conversation happens.
 */

const STEP_LABEL: Record<string, string> = {
  received: "ابدأ التحضير",
  preparing: "جاهز ✓",
};

function elapsedMinutes(createdAt: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000),
  );
}

function chipClass(minutes: number): string {
  if (minutes >= 10) return "bg-terracotta text-cream-50";
  if (minutes >= 5) return "bg-bronze text-cream-50";
  return "bg-basil-100 text-basil-800";
}

function KitchenTicket({
  order,
  busy,
  onAdvance,
}: {
  order: FeedOrder;
  busy: boolean;
  onAdvance: () => void;
}) {
  const minutes = elapsedMinutes(order.createdAt);
  const [, forceTick] = useState(0);

  // re-render every 30s so elapsed chips stay honest without a feed event
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const nextLabel = STEP_LABEL[order.status] ?? "ابدأ التحضير";

  return (
    <article className="rounded-[28px] border-4 border-cream-200 bg-cream-50 p-6 shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-5xl font-bold text-basil-800" dir="ltr">
          {order.orderNumber}
        </p>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-4 py-1.5 text-lg font-bold tabular-nums ${chipClass(minutes)}`}
          >
            {minutes === 0 ? "الآن" : `قبل ${minutes} د`}
          </span>
          <span className="inline-flex items-center gap-1.5 text-base font-bold text-ink-soft">
            {order.channel === "delivery" ? (
              <>
                <Bike className="size-5" aria-hidden /> توصيل
              </>
            ) : (
              <>
                <HandPlatter className="size-5" aria-hidden /> استلام
              </>
            )}
          </span>
        </div>
      </div>

      <ul className="mt-5 space-y-3 border-t-4 border-cream-200 pt-5">
        {order.items.map((it, i) => (
          <li key={i}>
            <p className="text-3xl leading-snug font-extrabold text-ink">
              {it.quantity} × {it.nameAr}
            </p>
            {it.detailAr && (
              <p className="mt-0.5 text-xl font-bold text-basil-700">
                {it.detailAr}
              </p>
            )}
            {it.note && (
              <p className="mt-1 text-xl font-bold text-bronze">✎ {it.note}</p>
            )}
          </li>
        ))}
      </ul>

      {order.customerNote && (
        <p className="mt-4 rounded-xl bg-bronze/10 px-4 py-3 text-xl font-bold text-bronze">
          ✎ {order.customerNote}
        </p>
      )}

      <button
        type="button"
        onClick={onAdvance}
        disabled={busy}
        className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-basil-700 text-2xl font-extrabold text-cream-50 shadow-card transition-colors hover:bg-basil-600 active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-7 animate-spin" aria-hidden />
        ) : (
          <ChefHat className="size-7" aria-hidden />
        )}
        {nextLabel}
      </button>
    </article>
  );
}

export function KitchenBoard() {
  const { orders, live, refresh } = useOrdersFeed({ alertOnNew: true });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);

  async function move(id: string, next: "preparing" | "ready") {
    setBusyId(id);
    setLastActionError(null);
    try {
      const res = await advanceOrder(id, next);
      if (!res.ok) {
        setLastActionError(res.error ?? "تعذر التحديث");
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const tickets = (orders ?? []).filter(
    (o) => o.status === "received" || o.status === "preparing",
  );

  return (
    <div className="min-h-dvh bg-cream-100">
      <div className="mx-auto max-w-4xl px-4 pt-5 pb-10 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-12" />
            <div>
              <p className="font-display text-2xl font-semibold text-basil-800">
                شاشة المطبخ
              </p>
              <p className="text-sm text-ink-soft">
                {tickets.length} تذاكر مفتوحة
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
              live ? "bg-basil-100 text-basil-800" : "bg-bronze/15 text-bronze"
            }`}
            aria-live="polite"
          >
            <span
              className={`size-2.5 rounded-full ${live ? "bg-basil-600" : "bg-bronze"}`}
              aria-hidden
            />
            {live ? "مباشر" : "إعادة اتصال…"}
          </span>
        </header>

        {lastActionError && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-center font-bold text-terracotta"
          >
            {lastActionError}
          </p>
        )}

        {orders === null ? (
          <div className="flex items-center justify-center gap-3 py-24 text-ink-soft">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            جارٍ التحميل…
          </div>
        ) : tickets.length === 0 ? (
          <div className="mt-10 rounded-card border-4 border-dashed border-cream-300 py-20 text-center">
            <p className="text-3xl font-extrabold text-ink">لا تذاكر الآن</p>
            <p className="mt-2 text-xl text-ink-soft">استمتع بالهدوء 🍃</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {tickets.map((o) => (
              <KitchenTicket
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onAdvance={() =>
                  void move(
                    o.id,
                    o.status === "received" ? "preparing" : "ready",
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
