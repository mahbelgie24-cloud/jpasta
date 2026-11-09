"use client";

import {
  Bike,
  ChefHat,
  Clock3,
  HandPlatter,
  MessageSquareText,
  PackageCheck,
  PencilLine,
  Timer,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { TwirlLoader } from "@/components/ui/twirl-loader";
import { SHOP_TZ } from "@/lib/domain/time";
import { formatTimeAr } from "@/lib/format";
import type { FeedOrder } from "@/hooks/use-orders-feed";
import { cn } from "@/lib/utils";
import { ticketAge, type AgingTone } from "./kitchen-aging";

const TONE_BAR: Record<AgingTone, string> = {
  fresh: "bg-brand",
  aging: "bg-warning",
  late: "bg-danger",
};

const TONE_CHIP: Record<AgingTone, string> = {
  fresh: "bg-brand/15 text-brand ring-1 ring-brand/30",
  aging: "bg-warning/15 text-warning ring-1 ring-warning/35",
  late: "bg-danger text-surface-sunken",
};

const TONE_ICON: Record<AgingTone, LucideIcon> = {
  fresh: Clock3,
  aging: Timer,
  late: TriangleAlert,
};

const CHANNEL: Record<
  FeedOrder["channel"],
  { label: string; icon: LucideIcon }
> = {
  takeaway: { label: "استلام", icon: HandPlatter },
  delivery: { label: "توصيل", icon: Bike },
  dine_in: { label: "داخل المحل", icon: UtensilsCrossed },
};

const STEP: Record<
  "received" | "preparing",
  { label: string; icon: LucideIcon }
> = {
  received: { label: "ابدأ التحضير", icon: ChefHat },
  preparing: { label: "جاهز للتسليم", icon: PackageCheck },
};

const fullTimestamp = new Intl.DateTimeFormat("ar-PS", {
  timeZone: SHOP_TZ,
  dateStyle: "medium",
  timeStyle: "short",
});

export function KitchenTicket({
  order,
  now,
  busy,
  onAdvance,
}: {
  order: FeedOrder;
  /** Shared 15-second board clock — no per-ticket timers. */
  now: number;
  busy: boolean;
  /** Omitted for the ready lane, which waits for the pass. */
  onAdvance?: () => void;
}) {
  const age = ticketAge(order.createdAt, now);
  const AgeIcon = TONE_ICON[age.tone];
  const channel = CHANNEL[order.channel];
  const ChannelIcon = channel.icon;
  const step =
    order.status === "received" || order.status === "preparing"
      ? STEP[order.status]
      : null;
  const StepIcon = step?.icon;

  return (
    <article className="relative overflow-hidden rounded-card bg-surface-raised p-4 shadow-card ring-1 ring-line/70 sm:p-5">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 start-0 w-1.5", TONE_BAR[age.tone])}
      />

      <div className="min-w-0">
        <h3
          className="type-kds-number whitespace-nowrap text-text-primary"
          dir="ltr"
        >
          {order.orderNumber}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 type-kds-meta text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <ChannelIcon className="size-4" aria-hidden />
            {channel.label}
          </span>
          <span aria-hidden className="text-text-secondary/40">
            ·
          </span>
          <time
            dateTime={order.createdAt}
            title={fullTimestamp.format(new Date(order.createdAt))}
            className="tabular-nums"
          >
            {formatTimeAr(order.createdAt)}
          </time>
          <span
            className={cn(
              "ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 type-kds-meta tabular-nums",
              TONE_CHIP[age.tone],
            )}
            aria-label={age.ariaLabel}
          >
            <AgeIcon className="size-4" aria-hidden />
            {age.label}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-3 border-t border-line/70 pt-4">
        {order.items.map((item, index) => (
          <li key={`${item.nameAr}-${index}`} className="flex gap-3">
            <span
              className="mt-0.5 inline-flex min-h-8 min-w-9 shrink-0 items-center justify-center rounded-lg bg-brand px-2 font-display type-kds-meta text-surface-sunken tabular-nums"
              dir="ltr"
              aria-label={`الكمية ${item.quantity}`}
            >
              {item.quantity}×
            </span>
            <div className="min-w-0">
              <p className="type-kds-item text-text-primary">{item.nameAr}</p>
              {item.detailAr && (
                <p className="mt-0.5 type-kds-meta text-brand">
                  {item.detailAr}
                </p>
              )}
              {item.note && (
                <p className="mt-1 flex items-start gap-1.5 type-kds-meta text-warning">
                  <PencilLine className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {item.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {order.customerNote && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 p-3 ring-1 ring-warning/25">
          <MessageSquareText
            className="mt-0.5 size-5 shrink-0 text-warning"
            aria-hidden
          />
          <p className="type-kds-meta text-warning">{order.customerNote}</p>
        </div>
      )}

      <div className="mt-4">
        {step && onAdvance ? (
          <button
            type="button"
            onClick={onAdvance}
            disabled={busy}
            aria-busy={busy}
            className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-action px-5 type-kds-item text-action-text shadow-card transition-[background-color,transform] duration-150 ease-out hover:bg-action-hover active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
          >
            {busy ? (
              <TwirlLoader className="size-7" label="جارٍ تحديث الطلب…" />
            ) : (
              StepIcon && <StepIcon className="size-6" aria-hidden />
            )}
            {busy ? "جارٍ التحديث…" : step.label}
          </button>
        ) : order.status === "ready" ? (
          <div className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-success/10 px-4 type-kds-meta text-success ring-1 ring-success/25">
            <PackageCheck className="size-5" aria-hidden />
            جاهزة — بانتظار التسليم
          </div>
        ) : null}
      </div>
    </article>
  );
}
