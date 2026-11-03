import { describe, expect, it } from "vitest";
import {
  addDays,
  shopOpenState,
  toDayString,
  todayInShop,
  zonedDayRange,
  zonedTimeToUtc,
} from "@/lib/domain/time";
import { normalizeArabic, arabicIncludes } from "@/lib/arabic";
import {
  signRealtimeToken,
  verifyRealtimeToken,
} from "@/lib/domain/realtime-token";
import { hashPin, pinLookup, verifyPin } from "@/lib/server/pin";

describe("shop time — Asia/Hebron", () => {
  it("converts a UTC instant to the shop calendar day", () => {
    // 22:30 UTC on Jan 15 = 00:30 on Jan 16 in Hebron (UTC+2).
    expect(toDayString(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-16");
  });

  it("computes the local-day range as half-open UTC instants", () => {
    const { start, end } = zonedDayRange("2026-01-15");
    expect(start.toISOString()).toBe("2026-01-14T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-15T22:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-15T00:00:00").toISOString()).toBe(
      "2026-01-14T22:00:00.000Z",
    );
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles the 13:00 → 01:00 opening window", () => {
    // 12:30 UTC = 14:30 local → open
    expect(shopOpenState(new Date("2026-01-15T12:30:00Z")).open).toBe(true);
    // 09:30 UTC = 11:30 local → closed
    expect(shopOpenState(new Date("2026-01-15T09:30:00Z")).open).toBe(false);
    // 22:30 UTC = 00:30 local → still open (crosses midnight)
    expect(shopOpenState(new Date("2026-01-15T22:30:00Z")).open).toBe(true);
    // 23:30 UTC = 01:30 local → closed
    expect(shopOpenState(new Date("2026-01-15T23:30:00Z")).open).toBe(false);
  });

  it("todayInShop is stable for a fixed instant", () => {
    expect(todayInShop(new Date("2026-07-01T21:30:00Z"))).toBe("2026-07-02");
  });

  it("honours owner-configured hours (same-day window)", () => {
    // Palestine winter time (UTC+2) keeps these mappings stable.
    const hours = { opensAt: "09:00", closesAt: "21:00" };
    // 08:59 local → closed, 09:30 → open, 20:59 → open, 21:30 → closed
    expect(shopOpenState(new Date("2026-01-15T06:59:00Z"), hours).open).toBe(
      false,
    );
    expect(shopOpenState(new Date("2026-01-15T07:30:00Z"), hours).open).toBe(
      true,
    );
    expect(shopOpenState(new Date("2026-01-15T18:59:00Z"), hours).open).toBe(
      true,
    );
    expect(shopOpenState(new Date("2026-01-15T19:30:00Z"), hours).open).toBe(
      false,
    );
  });

  it("honours owner-configured hours (crossing midnight)", () => {
    const hours = { opensAt: "22:00", closesAt: "02:00" };
    // 21:59 local → closed, 22:30 → open, 01:59 → open, 02:30 → closed
    expect(shopOpenState(new Date("2026-01-15T19:59:00Z"), hours).open).toBe(
      false,
    );
    expect(shopOpenState(new Date("2026-01-15T20:30:00Z"), hours).open).toBe(
      true,
    );
    expect(shopOpenState(new Date("2026-01-15T23:59:00Z"), hours).open).toBe(
      true,
    );
    expect(shopOpenState(new Date("2026-01-16T00:30:00Z"), hours).open).toBe(
      false,
    );
  });

  it("falls back to the default window on malformed settings", () => {
    const broken = { opensAt: "25:00", closesAt: "بكرا" };
    // 14:30 local — open under the default 13:00 → 01:00 window.
    expect(shopOpenState(new Date("2026-01-15T12:30:00Z"), broken).open).toBe(
      true,
    );
    // 11:30 local — closed under the default window.
    expect(shopOpenState(new Date("2026-01-15T09:30:00Z"), broken).open).toBe(
      false,
    );
  });
});

describe("Arabic search normalisation", () => {
  it("matches hamza/alef and ta-marbuta variants", () => {
    expect(normalizeArabic("إسباجتي")).toBe("اسباجتي");
    expect(arabicIncludes("إسباجتي بولونيز", "اسباجتي")).toBe(true);
    expect(arabicIncludes("باستا", "بستا")).toBe(false);
    expect(arabicIncludes("صلصة طازة", "صلصه")).toBe(true);
  });

  it("strips diacritics and punctuation", () => {
    expect(normalizeArabic("دَجَاج مشوي!")).toBe("دجاج مشوي");
  });
});

describe("realtime token", () => {
  const secret = "test-secret-that-is-long-enough-for-hmac";

  it("round-trips valid claims", async () => {
    const token = await signRealtimeToken(
      { sub: "user-1", role: "owner" },
      secret,
      60,
    );
    const claims = await verifyRealtimeToken(token, secret);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.role).toBe("owner");
  });

  it("rejects tampering and expiry", async () => {
    const token = await signRealtimeToken(
      { sub: "user-1", role: "staff" },
      secret,
      60,
    );
    expect(await verifyRealtimeToken(`${token}x`, secret)).toBeNull();
    expect(await verifyRealtimeToken(token, "another-secret")).toBeNull();

    const expired = await signRealtimeToken(
      { sub: "user-1", role: "staff" },
      secret,
      -1,
    );
    expect(await verifyRealtimeToken(expired, secret)).toBeNull();
  });
});

describe("PIN credentials", () => {
  it("is deterministic and unique per PIN lookup", async () => {
    const a = await pinLookup("135790");
    const b = await pinLookup("135790");
    const c = await pinLookup("246810");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes with PBKDF2 and verifies in constant time", async () => {
    const stored = await hashPin("135790");
    expect(stored.startsWith("pbkdf2:")).toBe(true);
    expect(await verifyPin("135790", stored)).toBe(true);
    expect(await verifyPin("000000", stored)).toBe(false);
    expect(await verifyPin("135790", "garbage")).toBe(false);
  });
});
