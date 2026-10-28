/**
 * Shop time — the single timezone boundary.
 *
 * Cloudflare Workers run in UTC. Every business-day calculation (reports,
 * Z-cash reconciliation, order numbers, opening hours) must use the shop's
 * wall clock explicitly, never the process timezone.
 *
 * Implemented with Intl only (no dependency) and DST-safe offset correction.
 */

export const SHOP_TZ = "Asia/Hebron";

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz = SHOP_TZ): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value ?? "0";
    return Number.parseInt(value, 10);
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** YYYY-MM-DD in the shop timezone. */
export function toDayString(date: Date, tz = SHOP_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayInShop(now = new Date()): string {
  return toDayString(now);
}

export function addDays(dateStr: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Offset of `tz` at `date`, in milliseconds east of UTC. */
function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  const seconds = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - seconds;
}

/**
 * Convert a wall-clock string ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss")
 * in `tz` to the corresponding UTC instant. Two-pass correction handles
 * DST transitions (including the repeated hour).
 */
export function zonedTimeToUtc(local: string, tz = SHOP_TZ): Date {
  const [datePart = "", timePart = "00:00:00"] = local.split("T");
  const [y = 1970, m = 1, d = 1] = datePart.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const first = offsetMs(new Date(guess), tz);
  let ts = guess - first;
  const second = offsetMs(new Date(ts), tz);
  if (second !== first) ts = guess - second;
  return new Date(ts);
}

/** UTC instants for the half-open range [start, end) of a local day. */
export function zonedDayRange(
  dateStr: string,
  tz = SHOP_TZ,
): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(`${dateStr}T00:00:00`, tz),
    end: zonedTimeToUtc(`${addDays(dateStr, 1)}T00:00:00`, tz),
  };
}

/** Deterministic Arabic time-of-day, safe on server and client. */
export function formatTimeInShop(date: Date | string, tz = SHOP_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-PS", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateInShop(date: Date | string, tz = SHOP_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-PS", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** Shop hours: 13:00 → 01:00, crossing midnight. */
export const SHOP_HOURS = { opensAt: 13, closesAt: 1 } as const;

export function shopOpenState(now = new Date()): {
  open: boolean;
  label: string;
} {
  const { hour, minute } = zonedParts(now);
  const minutes = hour * 60 + minute;
  const opens = SHOP_HOURS.opensAt * 60;
  const closes = SHOP_HOURS.closesAt * 60;
  const open = minutes >= opens || minutes < closes;
  return {
    open,
    label: open ? "مفتوح الآن" : "مغلق الآن",
  };
}
