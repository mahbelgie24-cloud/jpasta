import { SHOP_TZ } from "@/lib/domain/time";

/** Arabic relative-time formatting for order tickets. Client-only. */
export function timeAgoAr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHours = Math.floor(diffMin / 60);
  return rtf.format(-diffHours, "hour");
}

export function formatTimeAr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-PS", {
    timeZone: SHOP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
