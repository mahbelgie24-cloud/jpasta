/**
 * Pricing utilities — the money boundary (spec §6).
 *
 * All money in JPasta is an integer in minor units (agorot, 1 ₪ = 100).
 * No JS float ever touches a price; conversion from display strings
 * happens only here. Components render via `formatPrice` — never
 * arithmetic on formatted strings.
 */

export type Minor = number;

export const ZERO: Minor = 0;

export function addMinor(a: Minor, b: Minor): Minor {
  return a + b;
}

export function multiplyMinor(minor: Minor, quantity: number): Minor {
  return Math.round(minor * quantity);
}

export function sumMinor(values: readonly Minor[]): Minor {
  return values.reduce((sum, v) => sum + v, 0);
}

/** "22.5" → 2250. String manipulation only — parseFloat is lint-banned. */
export function toMinorUnits(major: string): Minor {
  const trimmed = major.trim();
  if (!trimmed) return 0;
  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [majorPart = "0", fracPart = ""] = abs.split(".");
  const majorInt = Number.parseInt(majorPart, 10);
  if (!Number.isFinite(majorInt)) return 0;
  const frac = (fracPart + "00").slice(0, 2);
  const value = majorInt * 100 + Number.parseInt(frac || "0", 10);
  return negative ? -value : value;
}

/** 2250 → "22.50" */
export function formatPrice(minor: Minor): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${major}.${frac}`;
}
