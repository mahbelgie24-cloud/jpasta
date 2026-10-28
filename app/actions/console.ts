"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getSessionUser,
  loginWithPin,
  logout,
  requireOwner,
  requireStaff,
} from "@/lib/server/session";
import {
  getConsoleOrders,
  getOrderHistory,
  transitionOrder,
  undoLastTransition,
  type OrderStatus,
} from "@/lib/server/orders";
import { userMessageOf } from "@/lib/server/guard";

/**
 * Console actions — every one re-checks the session server-side (AGENTS.md
 * RBAC rule: the UI hiding data is never the boundary).
 */

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function consoleLogin(pin: string): Promise<{
  ok: boolean;
  error?: string;
  retryAfterSec?: number;
}> {
  try {
    // Per-colo Workers limiter first (cheap, fails open only on Node).
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const env = getCloudflareContext().env as {
        AUTH_LIMIT?: { limit(key: string): Promise<{ success: boolean }> };
      };
      if (env.AUTH_LIMIT) {
        const { success } = await env.AUTH_LIMIT.limit(await clientIp());
        if (!success) {
          return {
            ok: false,
            error: "محاولات كثيرة — انتظر دقيقة ثم حاول مرة أخرى.",
            retryAfterSec: 60,
          };
        }
      }
    } catch {
      // Node runtime — the DB throttle still applies.
    }

    const result = await loginWithPin(pin, { ip: await clientIp() });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        retryAfterSec: result.retryAfterSec,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: userMessageOf(err, "تعذر تسجيل الدخول.") };
  }
}

export async function consoleLogout(): Promise<void> {
  await logout();
}

export async function fetchConsoleBoard() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "unauthenticated" };
  const orders = await getConsoleOrders();
  return {
    ok: true as const,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      channel: o.channel,
      source: o.source,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      address: o.address,
      zoneId: o.zoneId,
      totalMinor: o.totalMinor,
      subtotalMinor: o.subtotalMinor,
      deliveryFeeMinor: o.deliveryFeeMinor,
      customerNote: o.customerNote,
      cancelledReason: o.cancelledReason,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      items: o.items.map((it) => ({
        nameAr: it.nameAr,
        detailAr: it.detailAr,
        note: it.note,
        quantity: it.quantity,
        lineTotalMinor: it.lineTotalMinor,
      })),
    })),
  };
}

export async function advanceOrder(
  orderId: string,
  next: Exclude<OrderStatus, "received">,
  expected: OrderStatus,
  reason?: string,
): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  try {
    const user = await requireStaff();
    const result = await transitionOrder({
      orderId,
      next,
      expected,
      actorId: user.id,
      reason,
    });
    if (result.ok) revalidatePath("/console");
    return result;
  } catch (err) {
    return { ok: false, error: userMessageOf(err) };
  }
}

export async function undoOrder(
  orderId: string,
): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  try {
    const user = await requireOwner();
    const result = await undoLastTransition({ orderId, actorId: user.id });
    if (result.ok) revalidatePath("/console");
    return result;
  } catch (err) {
    return { ok: false, error: userMessageOf(err) };
  }
}

export async function fetchOrderHistory(orderId: string) {
  try {
    await requireStaff();
    return { ok: true as const, rows: await getOrderHistory(orderId) };
  } catch (err) {
    return { ok: false as const, error: userMessageOf(err) };
  }
}
