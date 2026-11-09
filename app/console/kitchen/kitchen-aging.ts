import { arabicCount } from "@/lib/arabic";

/**
 * Ticket aging for the kitchen display.
 *
 * The escalation thresholds are a product rule (spec Phase 2): under five
 * minutes is calm, five-to-nine needs attention, ten-plus is late. The label
 * stays in Arabic plural forms and steps up to hours/days so a stale ticket
 * from a previous shift never reads as «منذ ١٢٠٠ دقيقة».
 */
export type AgingTone = "fresh" | "aging" | "late";

export interface TicketAge {
  /** Whole minutes since the order was created. */
  minutes: number;
  tone: AgingTone;
  /** Visible chip label, e.g. «منذ ٧ دقائق». */
  label: string;
  /** Screen-reader label without the relative prefix. */
  ariaLabel: string;
}

function plural(
  value: number,
  one: string,
  two: string,
  few: string,
  many: string,
): string {
  return arabicCount(value, { one, two, few, many });
}

export function ticketAge(
  createdAt: string | Date,
  now = Date.now(),
): TicketAge {
  const created =
    typeof createdAt === "string"
      ? new Date(createdAt).getTime()
      : createdAt.getTime();
  const elapsedMs = now - created;
  const minutes = Number.isFinite(elapsedMs)
    ? Math.max(0, Math.floor(elapsedMs / 60_000))
    : 0;

  const tone: AgingTone =
    minutes >= 10 ? "late" : minutes >= 5 ? "aging" : "fresh";

  let label: string;
  if (minutes === 0) {
    label = "الآن";
  } else if (minutes < 60) {
    label = `منذ ${plural(minutes, "دقيقة", "دقيقتين", "دقائق", "دقيقة")}`;
  } else if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    label = `منذ ${plural(hours, "ساعة", "ساعتين", "ساعات", "ساعة")}`;
  } else {
    const days = Math.floor(minutes / (24 * 60));
    label = `منذ ${plural(days, "يوم", "يومين", "أيام", "يوماً")}`;
  }

  return {
    minutes,
    tone,
    label,
    ariaLabel:
      minutes === 0
        ? "عمر التذكرة: أقل من دقيقة"
        : `عمر التذكرة: ${label.replace(/^منذ /, "")}`,
  };
}
