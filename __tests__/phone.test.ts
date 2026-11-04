import { describe, expect, it } from "vitest";
import { isPlausiblePhone, phoneDigitCount } from "@/lib/domain/phone";

describe("phone validation", () => {
  it("rejects punctuation-only values that pass a naive shape regex", () => {
    expect(isPlausiblePhone("---------", 9)).toBe(false);
    expect(isPlausiblePhone("+() -", 6)).toBe(false);
  });

  it("accepts local and international shapes with enough digits", () => {
    expect(isPlausiblePhone("0566064976", 9)).toBe(true);
    expect(isPlausiblePhone("+970 56 606 4976", 9)).toBe(true);
    expect(isPlausiblePhone("(09) 234-5678", 9)).toBe(true);
  });

  it("enforces the caller's minimum digit count", () => {
    expect(isPlausiblePhone("123456", 6)).toBe(true);
    expect(isPlausiblePhone("123456", 9)).toBe(false);
  });

  it("rejects overlong and non-phone characters", () => {
    expect(isPlausiblePhone("0".repeat(16), 9)).toBe(false);
    expect(isPlausiblePhone("0599abc123", 9)).toBe(false);
    expect(isPlausiblePhone("", 6)).toBe(false);
  });

  it("counts digits, not characters", () => {
    expect(phoneDigitCount("+970 (56) 606-4976")).toBe(12);
  });
});
