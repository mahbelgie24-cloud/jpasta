import { describe, expect, it } from "vitest";
import {
  formatPrice,
  toMinorUnits,
  tryToMinorUnits,
  multiplyMinor,
  sumMinor,
} from "@/lib/pricing";

describe("pricing — the money boundary", () => {
  it("converts major strings to agorot without floats", () => {
    expect(toMinorUnits("24")).toBe(2400);
    expect(toMinorUnits("19.00")).toBe(1900);
    expect(toMinorUnits("2.5")).toBe(250);
    expect(toMinorUnits("0.1")).toBe(10);
    expect(toMinorUnits("0.05")).toBe(5);
  });

  it("truncates beyond scale 2 (contract-locked)", () => {
    expect(toMinorUnits("1.999")).toBe(199);
    expect(toMinorUnits("1.005")).toBe(100);
  });

  it("handles edge inputs defensively", () => {
    expect(toMinorUnits("")).toBe(0);
    expect(toMinorUnits(".")).toBe(0);
    expect(toMinorUnits("-3.5")).toBe(-350);
    expect(toMinorUnits("abc")).toBe(0);
  });

  it("formats back for display", () => {
    expect(formatPrice(2400)).toBe("24.00");
    expect(formatPrice(250)).toBe("2.50");
    expect(formatPrice(5)).toBe("0.05");
    expect(formatPrice(-350)).toBe("-3.50");
  });

  it("multiplies and sums without drift", () => {
    expect(multiplyMinor(3650, 3)).toBe(10950);
    expect(sumMinor([2400, 1900, 550])).toBe(4850);
    expect(multiplyMinor(1999, 0)).toBe(0);
  });

  it("round-trips", () => {
    for (const value of [0, 5, 250, 1999, 123456]) {
      expect(toMinorUnits(formatPrice(value))).toBe(value);
    }
  });
});

describe("strict money parsing (owner-entered values)", () => {
  it("accepts a clean amount, including the Arabic decimal separator", () => {
    expect(tryToMinorUnits("24.50")).toBe(2450);
    expect(tryToMinorUnits("0")).toBe(0);
    expect(tryToMinorUnits("12\u066B5")).toBe(1250);
  });

  it("returns null instead of silently coercing garbage to zero", () => {
    expect(tryToMinorUnits("")).toBeNull();
    expect(tryToMinorUnits("abc")).toBeNull();
    expect(tryToMinorUnits("12abc")).toBeNull();
    expect(tryToMinorUnits("1.999")).toBeNull();
    expect(tryToMinorUnits("-5")).toBeNull();
    expect(tryToMinorUnits("12,50")).toBeNull();
  });
});
