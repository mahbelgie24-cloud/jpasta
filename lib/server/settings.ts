import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { settings } from "@/db/schema";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/payment";

/**
 * Shop settings — the operational surface the owner edits without a deploy
 * (spec §8.2). Every storefront/console behaviour that used to be hardcoded
 * (hours, minimum order, payment methods, the ordering flag) reads through
 * here.
 *
 * Two readers, deliberately:
 *  - `getShopSettings()` — cached with the `settings` tag for pages/UI.
 *  - `readShopSettings()` — a fresh DB read for correctness-critical money
 *    paths (placeOrder), where a stale cached minimum could accept an order
 *    the owner already raised. One extra PK lookup per order is nothing.
 *
 * Every key parses defensively: a malformed row falls back to the default
 * for that key only — a typo can never take the storefront down.
 */

export const SETTINGS_TAG = "settings";

export {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/domain/payment";

export interface ShopSettings {
  shopName: string;
  shopPhone: string;
  whatsapp: string;
  hoursLabel: string;
  /** "HH:mm" 24h wall clock in Asia/Hebron; may cross midnight. */
  opensAt: string;
  closesAt: string;
  /** Integer agorot — a subtotal below this is rejected server-side. */
  minOrderMinor: number;
  deliveryEtaMinutes: number;
  taxRateBps: number;
  paymentMethods: PaymentMethod[];
  /** Master switch ANDed with the catalog-derived ordering readiness. */
  orderingEnabled: boolean;
  receiptFooter: string;
}

export const SHOP_SETTINGS_DEFAULTS: ShopSettings = {
  shopName: "JPasta",
  shopPhone: "0566064976",
  whatsapp: "970566064976",
  hoursLabel: "يومياً ١:٠٠ ظهراً حتى ١:٠٠ بعد منتصف الليل",
  opensAt: "13:00",
  closesAt: "01:00",
  minOrderMinor: 0,
  deliveryEtaMinutes: 25,
  taxRateBps: 0,
  paymentMethods: ["cash", "cash_on_delivery", "card_terminal"],
  orderingEnabled: true,
  receiptFooter: "شكراً لكم — JPasta، باستا طازة تُطبخ عند الطلب",
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

function clockOr(value: string | undefined, fallback: string): string {
  return value !== undefined && CLOCK.test(value) ? value : fallback;
}

function intOr(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
}

function boolOr(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function paymentMethodsOr(value: string | undefined): PaymentMethod[] {
  if (!value) return SHOP_SETTINGS_DEFAULTS.paymentMethods;
  const parsed = value
    .split(",")
    .map((m) => m.trim())
    .filter((m): m is PaymentMethod =>
      PAYMENT_METHODS.includes(m as PaymentMethod),
    );
  // A config that drops every method would make checkout impossible.
  return parsed.length > 0 ? parsed : SHOP_SETTINGS_DEFAULTS.paymentMethods;
}

export function parseShopSettings(
  rows: Array<{ key: string; value: string }>,
): ShopSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const d = SHOP_SETTINGS_DEFAULTS;
  return {
    shopName: map.get("shop_name")?.trim() || d.shopName,
    shopPhone: map.get("shop_phone")?.trim() || d.shopPhone,
    whatsapp: map.get("whatsapp")?.trim() || d.whatsapp,
    hoursLabel: map.get("hours_label")?.trim() || d.hoursLabel,
    opensAt: clockOr(map.get("opens_at"), d.opensAt),
    closesAt: clockOr(map.get("closes_at"), d.closesAt),
    minOrderMinor: intOr(
      map.get("min_order_minor"),
      d.minOrderMinor,
      10_000_000,
    ),
    deliveryEtaMinutes: intOr(
      map.get("delivery_eta_minutes"),
      d.deliveryEtaMinutes,
      240,
    ),
    taxRateBps: intOr(map.get("tax_rate_bps"), d.taxRateBps, 10_000),
    paymentMethods: paymentMethodsOr(map.get("payment_methods")),
    orderingEnabled: boolOr(map.get("ordering_enabled"), d.orderingEnabled),
    receiptFooter: map.get("receipt_footer")?.trim() || d.receiptFooter,
  };
}

/**
 * The settings table is the owner's kill switch and money floor. A read
 * failure must never silently fall back to "ordering enabled, minimum 0" on
 * the money path — that is the opposite of failing safe.
 */
export class ShopSettingsUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("shop-settings-unavailable");
    this.name = "ShopSettingsUnavailableError";
    this.cause = cause;
  }
}

export async function readShopSettings(): Promise<ShopSettings> {
  try {
    const rows = await db.select().from(settings);
    return parseShopSettings(rows);
  } catch (err) {
    const { logEvent } = await import("./log");
    logEvent("error", "settings.read_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    throw new ShopSettingsUnavailableError(err);
  }
}

function readShopSettingsCached(): Promise<ShopSettings> {
  return unstable_cache(readShopSettings, ["shop-settings"], {
    tags: [SETTINGS_TAG],
    revalidate: 300,
  })();
}

/**
 * Request-deduped, tag-cached read for pages and server components.
 * Display surfaces may degrade to defaults (a shop name is not a money
 * rule); the money path calls `readShopSettings()` and fails closed.
 */
export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  try {
    return await readShopSettingsCached();
  } catch {
    try {
      return await readShopSettings();
    } catch {
      const { logEvent } = await import("./log");
      logEvent("warn", "settings.display_fallback");
      return SHOP_SETTINGS_DEFAULTS;
    }
  }
});
