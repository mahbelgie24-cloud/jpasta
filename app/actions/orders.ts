"use server";

import {
  orderInputSchema,
  getOrderForStatus,
  placeOrder,
  type PlaceOrderResult,
} from "@/lib/server/orders";

/**
 * Storefront order actions — the only write path from /menu (spec §7).
 * The action validates with zod, then delegates to placeOrder which
 * recomputes every price server-side.
 */

export async function placeStorefrontOrder(
  raw: unknown,
): Promise<PlaceOrderResult> {
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "بيانات الطلب غير صحيحة." };
  }
  return placeOrder(parsed.data);
}

export async function fetchOrderStatus(orderId: string, token: string) {
  return getOrderForStatus(orderId, token);
}
