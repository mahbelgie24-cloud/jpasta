/**
 * Quantity arithmetic for fractional stock (numeric(12,2)).
 *
 * Stock/recipe quantities are stored with two decimals. Routing them through
 * JS floats violates the project's "no float on business values" rule, so
 * every operation happens in integer hundredths ("centi-units") and the
 * database value is produced as a decimal string.
 */

export type Centi = number; // 1.00 unit = 100 centi

export function toCenti(value: string | number): Centi {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("كمية غير صحيحة");
    return Math.round(value * 100);
  }
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [whole = "0", frac = ""] = abs.split(".");
  const wholeInt = Number.parseInt(whole, 10);
  if (!Number.isFinite(wholeInt)) throw new Error("كمية غير صحيحة");
  const fracInt = Number.parseInt((frac + "00").slice(0, 2), 10);
  const centi = wholeInt * 100 + fracInt;
  return negative ? -centi : centi;
}

export function fromCenti(centi: Centi): string {
  const negative = centi < 0;
  const abs = Math.abs(Math.round(centi));
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function addCenti(a: Centi, b: Centi): Centi {
  return a + b;
}

export function subtractCenti(a: Centi, b: Centi): Centi {
  return a - b;
}

export function multiplyCenti(centi: Centi, quantity: number): Centi {
  return Math.round(centi * quantity);
}

export function clampNonNegative(centi: Centi): Centi {
  return centi < 0 ? 0 : centi;
}

export function formatQty(value: string | number, unit?: string): string {
  const centi = toCenti(value);
  const text = fromCenti(centi).replace(/\.00$/, "");
  return unit ? `${text} ${unit}` : text;
}
