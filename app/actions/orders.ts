"use server";

import { headers } from "next/headers";
import {
  orderInputSchema,
  getActiveDeliveryZones,
  getOrderForStatus,
  placeOrder,
  quoteCart,
  type PlaceOrderResult,
} from "@/lib/server/orders";
import { requireStaff } from "@/lib/server/session";
import { userMessageOf } from "@/lib/server/guard";

/**
 * Order actions.
 *
 * Storefront intake is public but rate-limited; console intake requires a
 * session and records the actor in the status history. Both go through the
 * same placeOrder pipeline, so prices, zones and idempotency cannot drift.
 */

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function checkOrderRateLimit(
  bindingName: "ORDER_LIMIT",
  key: string,
): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as {
      ORDER_LIMIT?: { limit(key: string): Promise<{ success: boolean }> };
    };
    const binding = env[bindingName];
    if (!binding) return null;
    const { success } = await binding.limit(key);
    if (!success) {
      return "طلبات كثيرة جداً — انتظر دقيقة ثم حاول مجدداً.";
    }
    return null;
  } catch {
    return null; // Node runtime (local dev/tests) — binding is Workers-only
  }
}

export async function placeStorefrontOrder(
  raw: unknown,
): Promise<PlaceOrderResult> {
  const limited = await checkOrderRateLimit("ORDER_LIMIT", await clientIp());
  if (limited) return { ok: false, error: limited };
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "بيانات الطلب غير صحيحة." };
  }
  // Provenance is asserted here, not read from the payload: a client that
  // injects `source: "console"` is stripped by the schema and still takes
  // the storefront enforcement path.
  return placeOrder(parsed.data, { source: "storefront" });
}

/** Console manual entry — authenticated, actor recorded, same money path. */
export async function placeConsoleOrder(
  raw: unknown,
): Promise<PlaceOrderResult> {
  let actorId: string;
  try {
    const user = await requireStaff();
    actorId = user.id;
  } catch (err) {
    return { ok: false, error: userMessageOf(err) };
  }
  // A leaked staff PIN must not become an unbounded order-intake primitive.
  const limited = await checkOrderRateLimit("ORDER_LIMIT", await clientIp());
  if (limited) return { ok: false, error: limited };
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "بيانات الطلب غير صحيحة." };
  }
  return placeOrder(parsed.data, { source: "console", actorId });
}

export async function fetchOrderStatus(orderId: string, token: string) {
  return getOrderForStatus(orderId, token);
}

/** Public zone list — the cart must show the real fee before submitting. */
export async function fetchDeliveryZones() {
  return getActiveDeliveryZones();
}

/**
 * Re-price a persisted cart against the current catalog. Read-only and
 * public by design (the same data the menu already renders); it never
 * creates an order.
 */
export async function fetchCartQuote(lines: unknown) {
  return quoteCart({ lines });
}
