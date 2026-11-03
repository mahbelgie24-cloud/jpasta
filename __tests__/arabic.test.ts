import { describe, expect, it } from "vitest";
import { arabicCount, arabicPlural, normalizeArabic } from "@/lib/arabic";

const ORDER_FORMS = {
  zero: "لا طلبات",
  one: "طلب واحد",
  two: "طلبان",
  few: "طلبات",
  many: "طلباً",
};

describe("Arabic pluralisation", () => {
  it("selects the zero form when provided", () => {
    expect(arabicCount(0, ORDER_FORMS)).toBe("لا طلبات");
    expect(arabicPlural(0, ORDER_FORMS)).toBe("لا طلبات");
  });

  it("uses the singular and dual forms without a redundant digit", () => {
    expect(arabicCount(1, ORDER_FORMS)).toBe("طلب واحد");
    expect(arabicCount(2, ORDER_FORMS)).toBe("طلبان");
  });

  it("uses the few form for 3–10 and the many form above 10", () => {
    expect(arabicCount(3, ORDER_FORMS)).toBe("3 طلبات");
    expect(arabicCount(10, ORDER_FORMS)).toBe("10 طلبات");
    expect(arabicCount(11, ORDER_FORMS)).toBe("11 طلباً");
    expect(arabicCount(100, ORDER_FORMS)).toBe("100 طلباً");
  });

  it("treats negative magnitudes as positive counts", () => {
    expect(arabicCount(-2, ORDER_FORMS)).toBe("طلبان");
  });
});

describe("Arabic search normalisation", () => {
  it("matches alef, ya and ta-marbuta variants", () => {
    expect(normalizeArabic("إسباجتي")).toBe(normalizeArabic("اسباجتي"));
    expect(normalizeArabic("باستا")).toContain("باستا");
  });
});
