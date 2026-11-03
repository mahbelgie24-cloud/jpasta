import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { products, settings } from "@/db/schema";
import {
  parseShopSettings,
  readShopSettings,
  SHOP_SETTINGS_DEFAULTS,
} from "@/lib/server/settings";
import { placeOrder } from "@/lib/server/orders";

/**
 * Settings-driven behaviour (HANDOFF §11.4): the owner's table drives hours,
 * minimum order, payment methods and the ordering flag without a deploy.
 * Requires the seeded local database (npm run db:migrate && npm run db:seed).
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

d("shop settings", () => {
  // Each case starts from the seeded shop: the minimum-order case raises the
  // floor, and the ordering/payment cases flip switches — without this reset
  // one case would leak its state into the next.
  beforeEach(async () => {
    await db
      .update(settings)
      .set({ value: "0" })
      .where(eq(settings.key, "min_order_minor"));
    await db
      .update(settings)
      .set({ value: "true" })
      .where(eq(settings.key, "ordering_enabled"));
    await db
      .update(settings)
      .set({ value: "cash,cash_on_delivery,card_terminal" })
      .where(eq(settings.key, "payment_methods"));
  });

  afterAll(async () => {
    // Always restore the seeded default so other suites see a clean shop.
    await db
      .update(settings)
      .set({ value: "0" })
      .where(eq(settings.key, "min_order_minor"));
    await db
      .update(settings)
      .set({ value: "true" })
      .where(eq(settings.key, "ordering_enabled"));
    await db
      .update(settings)
      .set({ value: "cash,cash_on_delivery,card_terminal" })
      .where(eq(settings.key, "payment_methods"));
    await pool.end();
  });

  it("parses the seeded settings into typed values", async () => {
    const shop = await readShopSettings();
    expect(shop.opensAt).toBe("13:00");
    expect(shop.closesAt).toBe("01:00");
    expect(shop.minOrderMinor).toBe(0);
    expect(shop.orderingEnabled).toBe(true);
    expect(shop.paymentMethods).toContain("cash");
    expect(shop.taxRateBps).toBe(0);
  });

  it("falls back per key on malformed rows", () => {
    const parsed = parseShopSettings([
      { key: "opens_at", value: "99:99" },
      { key: "min_order_minor", value: "-5" },
      { key: "ordering_enabled", value: "maybe" },
      { key: "payment_methods", value: "cash,bogus" },
      { key: "delivery_eta_minutes", value: "999" },
    ]);
    expect(parsed.opensAt).toBe(SHOP_SETTINGS_DEFAULTS.opensAt);
    expect(parsed.minOrderMinor).toBe(0);
    expect(parsed.orderingEnabled).toBe(true);
    expect(parsed.paymentMethods).toEqual(["cash"]);
    expect(parsed.deliveryEtaMinutes).toBe(
      SHOP_SETTINGS_DEFAULTS.deliveryEtaMinutes,
    );
  });

  it("enforces the owner-configured minimum order server-side", async () => {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "penne-alfredo"))
      .limit(1);
    if (!row) throw new Error("seeded product missing — run npm run db:seed");

    // Raise the minimum above one penne alfredo (20.00 ₪ → 2000 agorot).
    await db
      .update(settings)
      .set({ value: "5000" })
      .where(eq(settings.key, "min_order_minor"));

    const below = await placeOrder({
      idempotencyKey: `test-min-below-${Date.now()}`,
      channel: "takeaway",
      customer: {
        name: "اختبار الحد الأدنى",
        phone: "0599000111",
        address: "",
      },
      lines: [
        {
          productId: row.id,
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(below.ok).toBe(false);
    if (!below.ok) expect(below.error).toContain("الحد الأدنى");

    // Three units (60.00 ₪) clear the minimum and place normally.
    const above = await placeOrder({
      idempotencyKey: `test-min-above-${Date.now()}`,
      channel: "takeaway",
      customer: {
        name: "اختبار الحد الأدنى",
        phone: "0599000111",
        address: "",
      },
      lines: [
        {
          productId: row.id,
          quantity: 3,
          selections: [],
        },
      ],
    });
    expect(above.ok).toBe(true);
  });

  it("enforces the ordering master switch on the server (console entry stays open)", async () => {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "penne-alfredo"))
      .limit(1);
    if (!row) throw new Error("seeded product missing — run npm run db:seed");

    await db
      .update(settings)
      .set({ value: "false" })
      .where(eq(settings.key, "ordering_enabled"));

    const base = {
      channel: "takeaway" as const,
      customer: {
        name: "اختبار إيقاف الطلب",
        phone: "0599000111",
        address: "",
      },
      lines: [
        {
          productId: row.id,
          quantity: 1,
          selections: [],
        },
      ],
    };

    // The storefront path is refused even if a client calls the action
    // directly — the menu's view-only state is not the security boundary.
    const storefront = await placeOrder({
      ...base,
      idempotencyKey: `test-ordering-off-${Date.now()}`,
    });
    expect(storefront.ok).toBe(false);
    if (!storefront.ok) expect(storefront.error).toContain("غير متاح");

    // Manual console entry is a different channel: the owner is taking a
    // phone order and must not be blocked by the storefront switch.
    const consoleOrder = await placeOrder({
      ...base,
      idempotencyKey: `test-ordering-console-${Date.now()}`,
      source: "console",
    });
    expect(consoleOrder.ok).toBe(true);

    await db
      .update(settings)
      .set({ value: "true" })
      .where(eq(settings.key, "ordering_enabled"));
  });

  it("rejects a payment method the owner disabled", async () => {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "penne-alfredo"))
      .limit(1);
    if (!row) throw new Error("seeded product missing — run npm run db:seed");

    await db
      .update(settings)
      .set({ value: "cash" })
      .where(eq(settings.key, "payment_methods"));

    const res = await placeOrder({
      idempotencyKey: `test-payment-off-${Date.now()}`,
      channel: "takeaway",
      paymentMethod: "card_terminal",
      customer: {
        name: "اختبار الدفع",
        phone: "0599000111",
        address: "",
      },
      lines: [
        {
          productId: row.id,
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("طريقة الدفع");

    await db
      .update(settings)
      .set({ value: "cash,cash_on_delivery,card_terminal" })
      .where(eq(settings.key, "payment_methods"));
  });
});
