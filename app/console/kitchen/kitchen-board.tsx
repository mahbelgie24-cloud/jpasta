"use client";

import { arabicCount } from "@/lib/arabic";

import { useEffect, useState } from "react";
import {
  Bike,
  ChefHat,
  HandPlatter,
  Maximize2,
  Minimize2,
  UtensilsCrossed,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { TwirlLoader } from "@/components/ui/twirl-loader";
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
  // Bronze/cream is 3.3:1. The chip is rendered at 20px bold (>= 14pt bold
  // = WCAG large text), where 3:1 is the AA requirement — the 18px version
  // was just under the large-text threshold and failed.
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
  /** Omitted for the "ready" lane, which waits for the pass. */
  onAdvance?: () => void;
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
            className={`rounded-full px-4 py-1.5 text-xl font-bold tabular-nums ${chipClass(minutes)}`}
          >
            {minutes === 0 ? "الآن" : `قبل ${minutes} د`}
          </span>
          <span className="inline-flex items-center gap-1.5 text-base font-bold text-ink-soft">
            {order.channel === "delivery" ? (
              <>
                <Bike className="size-5" aria-hidden /> توصيل
              </>
            ) : order.channel === "dine_in" ? (
              <>
                <UtensilsCrossed className="size-5" aria-hidden /> داخل المحل
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
              <p className="mt-1 text-xl font-bold text-warning">✎ {it.note}</p>
            )}
          </li>
        ))}
      </ul>

      {order.customerNote && (
        <p className="mt-4 rounded-xl bg-bronze/10 px-4 py-3 text-xl font-bold text-warning">
          ✎ {order.customerNote}
        </p>
      )}

      {onAdvance && (
        <button
          type="button"
          onClick={onAdvance}
          disabled={busy}
          className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-basil-700 text-2xl font-extrabold text-cream-50 shadow-card transition-colors hover:bg-basil-600 active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? (
            <TwirlLoader className="size-9" label="جارٍ التحديث…" />
          ) : (
            <ChefHat className="size-7" aria-hidden />
          )}
          {nextLabel}
        </button>
      )}
    </article>
  );
}

export function KitchenBoard() {
  const { orders, connection, refresh } = useOrdersFeed({
    alertOnNew: true,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFullscreen(Boolean(document.fullscreenElement));
    }
  }

  async function move(id: string, next: "preparing" | "ready") {
    const current = orders?.find((o) => o.id === id);
    if (!current) return;
    setBusyId(id);
    setLastActionError(null);
    try {
      const res = await advanceOrder(id, next, current.status);
      if (!res.ok) {
        setLastActionError(res.error ?? "تعذر التحديث");
      } else {
        await refresh();
      }
    } catch {
      setLastActionError("تعذر التحديث — تحقق من الاتصال.");
    } finally {
      setBusyId(null);
    }
  }

  const tickets = (orders ?? []).filter(
    (o) =>
      o.status === "received" ||
      o.status === "preparing" ||
      o.status === "ready",
  );

  const lanes = [
    { status: "received" as const, label: "جديدة" },
    { status: "preparing" as const, label: "قيد التحضير" },
    { status: "ready" as const, label: "جاهزة للتسليم" },
  ];

  return (
    <div className="min-h-dvh bg-cream-100">
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-10 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-12" />
            <div>
              <h1 className="font-display-ar text-2xl font-semibold text-basil-800">
                شاشة المطبخ
              </h1>
              <p className="text-sm text-ink-soft">
                {arabicCount(tickets.length, {
                  zero: "لا تذاكر مفتوحة",
                  one: "تذكرة واحدة مفتوحة",
                  two: "تذكرتان مفتوحتان",
                  few: "تذاكر مفتوحة",
                  many: "تذكرة مفتوحة",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-pressed={fullscreen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-sm font-bold text-ink-soft hover:bg-cream-200"
            >
              {fullscreen ? (
                <Minimize2 className="size-4" aria-hidden />
              ) : (
                <Maximize2 className="size-4" aria-hidden />
              )}
              {fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
                connection === "live"
                  ? "bg-basil-100 text-basil-800"
                  : connection === "offline"
                    ? "bg-terracotta/10 text-terracotta"
                    : "bg-bronze/15 text-warning"
              }`}
              aria-live="polite"
            >
              <span
                className={`size-2.5 rounded-full ${
                  connection === "live"
                    ? "bg-basil-600"
                    : connection === "offline"
                      ? "bg-terracotta"
                      : "bg-bronze"
                }`}
                aria-hidden
              />
              {connection === "live"
                ? "مباشر"
                : connection === "polling"
                  ? "تحديث دوري"
                  : connection === "offline"
                    ? "غير متصل"
                    : "جارٍ الاتصال…"}
            </span>
          </div>
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
            <TwirlLoader className="size-8" label="جارٍ تحميل التذاكر…" />
            جارٍ التحميل…
          </div>
        ) : tickets.length === 0 ? (
          <div className="mt-10 rounded-card border-4 border-dashed border-cream-300 py-20 text-center">
            <p className="text-3xl font-extrabold text-ink">لا تذاكر الآن</p>
            <p className="mt-2 text-xl text-ink-soft">استمتع بالهدوء 🍃</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {lanes.map((lane) => {
              const laneTickets = tickets.filter(
                (o) => o.status === lane.status,
              );
              return (
                <section
                  key={lane.status}
                  aria-labelledby={`lane-${lane.status}`}
                  className="rounded-card border border-cream-200 bg-cream-50/40 p-3"
                >
                  <h2
                    id={`lane-${lane.status}`}
                    className="flex items-center justify-between px-1 pb-2 font-display-ar text-xl font-bold text-basil-800"
                  >
                    {lane.label}
                    <span className="rounded-full bg-basil-100 px-2.5 py-0.5 text-sm font-bold text-basil-800 tabular-nums">
                      {laneTickets.length}
                    </span>
                  </h2>
                  <div className="space-y-4">
                    {laneTickets.length === 0 ? (
                      <p className="py-6 text-center text-sm text-ink-soft">
                        لا تذاكر
                      </p>
                    ) : (
                      laneTickets.map((o) => (
                        <KitchenTicket
                          key={o.id}
                          order={o}
                          busy={busyId === o.id}
                          onAdvance={
                            lane.status === "ready"
                              ? undefined
                              : () =>
                                  void move(
                                    o.id,
                                    lane.status === "received"
                                      ? "preparing"
                                      : "ready",
                                  )
                          }
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
