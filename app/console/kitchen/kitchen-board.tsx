"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ChefHat,
  CircleCheck,
  Inbox,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  TriangleAlert,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { arabicCount } from "@/lib/arabic";
import {
  getServerSoundPreference,
  getSoundPreference,
  setSoundPreference,
  subscribeSoundPreference,
} from "@/lib/alert";
import { formatTimeAr } from "@/lib/format";
import {
  useOrdersFeed,
  type FeedConnection,
  type FeedOrder,
} from "@/hooks/use-orders-feed";
import { advanceOrder } from "@/app/actions/console";
import { cn } from "@/lib/utils";
import { KitchenTicket } from "./kitchen-ticket";

/**
 * Kitchen display (KDS) — the kitchen's command surface.
 *
 * Readable from two metres: huge order numbers, a shared aging clock,
 * three explicit swimlanes, and one-tap advancement. Aging escalates at
 * five and ten minutes with icon + label + colour (never colour alone).
 *
 * The feed is WebSocket-first with an 8-second visibility-aware polling
 * fallback; the sound toggle shares the persisted preference with the
 * orders board so one mute covers the whole shop.
 */

type LaneStatus = "received" | "preparing" | "ready";

interface Lane {
  status: LaneStatus;
  label: string;
  icon: LucideIcon;
  tint: string;
  count: string;
  empty: string;
}

const LANES: Lane[] = [
  {
    status: "received",
    label: "جديدة",
    icon: Inbox,
    tint: "bg-brand/15 text-brand",
    count: "bg-brand/10 text-brand ring-brand/25",
    empty: "التذاكر الجديدة تظهر هنا فور وصولها",
  },
  {
    status: "preparing",
    label: "قيد التحضير",
    icon: ChefHat,
    tint: "bg-warning/15 text-warning",
    count: "bg-warning/10 text-warning ring-warning/25",
    empty: "التذاكر التي تبدأ تحضيرها تظهر هنا",
  },
  {
    status: "ready",
    label: "جاهزة للتسليم",
    icon: CircleCheck,
    tint: "bg-success/15 text-success",
    count: "bg-success/10 text-success ring-success/25",
    empty: "التذاكر الجاهزة بانتظار التسليم تظهر هنا",
  },
];

const CONNECTION: Record<
  FeedConnection,
  { label: string; icon: LucideIcon; className: string }
> = {
  live: {
    label: "مباشر",
    icon: Wifi,
    className: "bg-success/10 text-success ring-success/25",
  },
  polling: {
    label: "تحديث دوري",
    icon: RefreshCw,
    className: "bg-warning/10 text-warning ring-warning/25",
  },
  offline: {
    label: "غير متصل",
    icon: WifiOff,
    className: "bg-danger/10 text-danger ring-danger/25",
  },
  connecting: {
    label: "جارٍ الاتصال…",
    icon: LoaderCircle,
    className: "bg-surface-raised text-text-secondary ring-line",
  },
};

const controlClass =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-raised px-3.5 type-caption font-bold text-text-secondary ring-1 ring-line transition-colors hover:bg-surface-sunken hover:text-text-primary";

function KitchenClock() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setLabel(formatTimeAr(new Date()));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return <span className="tabular-nums">{label ?? "—"}</span>;
}

function Lane({
  lane,
  tickets,
  now,
  busyId,
  onMove,
}: {
  lane: Lane;
  tickets: FeedOrder[];
  now: number;
  busyId: string | null;
  onMove: (id: string, next: "preparing" | "ready") => Promise<void>;
}) {
  const Icon = lane.icon;
  const next =
    lane.status === "received"
      ? ("preparing" as const)
      : lane.status === "preparing"
        ? ("ready" as const)
        : null;

  return (
    <section
      aria-labelledby={`lane-${lane.status}`}
      className="overflow-hidden rounded-card bg-surface/60 ring-1 ring-line/60"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full",
              lane.tint,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <h2
            id={`lane-${lane.status}`}
            className="truncate font-display-ar type-kds-title text-text-primary"
          >
            {lane.label}
          </h2>
        </div>
        <span
          className={cn(
            "inline-flex min-w-9 shrink-0 items-center justify-center rounded-full px-2.5 py-1 type-kds-meta tabular-nums ring-1",
            lane.count,
          )}
        >
          {tickets.length}
        </span>
      </header>

      <div className="space-y-3 p-3 sm:p-4">
        {tickets.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line/70 bg-surface-sunken/50 px-4 py-6 text-center">
            <Icon className="size-6 text-text-secondary/50" aria-hidden />
            <p className="type-kds-meta text-text-secondary">
              لا تذاكر في هذه المرحلة
            </p>
            <p className="type-micro text-text-secondary/70">{lane.empty}</p>
          </div>
        ) : (
          tickets.map((order) => (
            <KitchenTicket
              key={order.id}
              order={order}
              now={now}
              busy={busyId === order.id}
              onAdvance={next ? () => void onMove(order.id, next) : undefined}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div
      className="mt-5 grid gap-4 lg:grid-cols-3"
      role="status"
      aria-label="جارٍ تحميل تذاكر المطبخ"
    >
      {LANES.map((lane) => (
        <div
          key={lane.status}
          className="overflow-hidden rounded-card bg-surface/60 ring-1 ring-line/60"
        >
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="size-9 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
              <span className="h-6 w-28 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
            </div>
            <span className="size-8 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
          </div>
          <div className="space-y-3 p-3 sm:p-4">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-card bg-surface-raised motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-5 flex flex-col items-center gap-3 rounded-card bg-surface/60 px-5 py-16 text-center ring-1 ring-line/60"
    >
      <span className="grid size-14 place-items-center rounded-full bg-danger/10 text-danger ring-1 ring-danger/25">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <p className="type-kds-title text-text-primary">
        تعذر تحميل تذاكر المطبخ
      </p>
      <p className="max-w-md type-kds-meta text-text-secondary">
        تحقق من اتصال الجهاز ثم أعد المحاولة — التذاكر محفوظة في الخادم.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-action px-5 type-kds-meta text-action-text transition-colors hover:bg-action-hover"
      >
        <RefreshCw className="size-4" aria-hidden />
        إعادة المحاولة
      </button>
    </div>
  );
}

export function KitchenBoard() {
  const { orders, connection, lastUpdated, refresh } = useOrdersFeed({
    alertOnNew: true,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const boardRef = useRef<HTMLDivElement>(null);
  const soundEnabled = useSyncExternalStore(
    subscribeSoundPreference,
    getSoundPreference,
    getServerSoundPreference,
  );

  // One shared clock for every ticket; no per-ticket intervals.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const connectionView = CONNECTION[connection];
  const ConnectionIcon = connectionView.icon;
  const tickets = orders ?? [];
  const openCount = tickets.length;
  const initialError = orders === null && connection === "offline";
  const summary = initialError
    ? "تعذر تحميل التذاكر"
    : orders === null
      ? "جارٍ تحميل التذاكر…"
      : arabicCount(openCount, {
          zero: "لا تذاكر مفتوحة",
          one: "تذكرة واحدة مفتوحة",
          two: "تذكرتان مفتوحتان",
          few: "تذاكر مفتوحة",
          many: "تذكرة مفتوحة",
        });

  function toggleSound() {
    setSoundPreference(!soundEnabled);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (boardRef.current) {
        await boardRef.current.requestFullscreen();
      }
    } catch {
      setFullscreen(Boolean(document.fullscreenElement));
    }
  }

  async function move(id: string, next: "preparing" | "ready") {
    const current = orders?.find((order) => order.id === id);
    if (!current) {
      await refresh();
      return;
    }

    setBusyId(id);
    setLastActionError(null);
    try {
      const result = await advanceOrder(id, next, current.status);
      if (!result.ok) setLastActionError(result.error ?? "تعذر تحديث الطلب.");
      // Refresh on both outcomes: a conflict means this screen is stale.
      await refresh();
    } catch {
      setLastActionError("تعذر التحديث — تحقق من الاتصال.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      ref={boardRef}
      data-fullscreen={fullscreen}
      className="relative min-h-dvh overflow-x-hidden bg-canvas data-[fullscreen=true]:h-dvh data-[fullscreen=true]:overflow-y-auto"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(75% 100% at 50% 0%, color-mix(in oklab, var(--color-brand) 12%, transparent) 0%, transparent 72%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line/60 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="size-11 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display-ar type-kds-title text-text-primary">
                شاشة المطبخ
              </h1>
              <p className="flex flex-wrap items-center gap-x-2 type-kds-meta text-text-secondary">
                <span>{summary}</span>
                <span aria-hidden className="text-text-secondary/40">
                  ·
                </span>
                <KitchenClock />
              </p>
            </div>
          </div>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              aria-label="كتم صوت التنبيه"
              aria-pressed={!soundEnabled}
              className={controlClass}
            >
              {soundEnabled ? (
                <Volume2 className="size-4" aria-hidden />
              ) : (
                <VolumeX className="size-4" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {soundEnabled ? "الصوت مفعّل" : "الصوت مكتوم"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-pressed={fullscreen}
              aria-label={fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
              className={controlClass}
            >
              {fullscreen ? (
                <Minimize2 className="size-4" aria-hidden />
              ) : (
                <Maximize2 className="size-4" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
              </span>
            </button>

            <span
              role="status"
              title={
                lastUpdated
                  ? `آخر تحديث ${formatTimeAr(new Date(lastUpdated))}`
                  : undefined
              }
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 type-caption font-bold ring-1",
                connectionView.className,
              )}
            >
              <ConnectionIcon
                className={cn(
                  "size-4",
                  connection === "connecting" && "motion-safe:animate-spin",
                )}
                aria-hidden
              />
              {connectionView.label}
            </span>
          </div>
        </header>

        {lastActionError && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger/10 px-4 py-3 text-danger ring-1 ring-danger/25"
          >
            <span className="inline-flex items-center gap-2 type-kds-meta">
              <TriangleAlert className="size-5 shrink-0" aria-hidden />
              {lastActionError}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-raised px-4 type-caption font-bold text-text-primary ring-1 ring-line transition-colors hover:bg-surface-sunken"
            >
              <RefreshCw className="size-4" aria-hidden />
              تحديث الشاشة
            </button>
          </div>
        )}

        {initialError ? (
          <BoardError onRetry={() => void refresh()} />
        ) : orders === null ? (
          <BoardSkeleton />
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:items-start">
            {LANES.map((lane) => (
              <Lane
                key={lane.status}
                lane={lane}
                tickets={tickets.filter(
                  (order) => order.status === lane.status,
                )}
                now={now}
                busyId={busyId}
                onMove={move}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
