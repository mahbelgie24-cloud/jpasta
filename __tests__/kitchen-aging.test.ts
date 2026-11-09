import { describe, expect, it } from "vitest";
import { ticketAge } from "@/app/console/kitchen/kitchen-aging";

/**
 * The 5/10-minute escalation is a product rule (spec Phase 2). These tests
 * also lock the Arabic plural forms so a stale ticket never shows a
 * grammatically wrong chip.
 */
const BASE = Date.parse("2026-11-08T10:00:00.000Z");
const MINUTE = 60_000;

function ageAt(minutes: number) {
  return ticketAge(new Date(BASE), BASE + minutes * MINUTE);
}

describe("kitchen ticket aging", () => {
  it("escalates at five and ten minutes", () => {
    expect(ageAt(0).tone).toBe("fresh");
    expect(ageAt(4).tone).toBe("fresh");
    expect(ageAt(5).tone).toBe("aging");
    expect(ageAt(9).tone).toBe("aging");
    expect(ageAt(10).tone).toBe("late");
    expect(ageAt(600).tone).toBe("late");
  });

  it("uses Arabic plural forms for minutes", () => {
    expect(ageAt(0).label).toBe("الآن");
    expect(ageAt(1).label).toBe("منذ دقيقة");
    expect(ageAt(2).label).toBe("منذ دقيقتين");
    expect(ageAt(3).label).toBe("منذ 3 دقائق");
    expect(ageAt(10).label).toBe("منذ 10 دقائق");
    expect(ageAt(11).label).toBe("منذ 11 دقيقة");
  });

  it("steps up to hours and days for stale tickets", () => {
    expect(ageAt(60).label).toBe("منذ ساعة");
    expect(ageAt(120).label).toBe("منذ ساعتين");
    expect(ageAt(180).label).toBe("منذ 3 ساعات");
    expect(ageAt(24 * 60).label).toBe("منذ يوم");
    expect(ageAt(2 * 24 * 60).label).toBe("منذ يومين");
    expect(ageAt(3 * 24 * 60).label).toBe("منذ 3 أيام");
  });

  it("provides a full screen-reader label", () => {
    expect(ageAt(0).ariaLabel).toBe("عمر التذكرة: أقل من دقيقة");
    expect(ageAt(7).ariaLabel).toBe("عمر التذكرة: 7 دقائق");
    expect(ageAt(120).ariaLabel).toBe("عمر التذكرة: ساعتين");
  });

  it("clamps future and invalid timestamps to zero", () => {
    expect(ticketAge(new Date(BASE + 5 * MINUTE), BASE).minutes).toBe(0);
    expect(ticketAge("not-a-date", BASE).minutes).toBe(0);
    expect(ticketAge("not-a-date", BASE).label).toBe("الآن");
  });
});
