"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, loginWithPin, logout } from "@/lib/server/session";
import { getConsoleOrders, transitionOrder } from "@/lib/server/orders";

/**
 * Console actions — every one re-checks the session server-side (AGENTS.md
 * RBAC rule: the UI hiding data is never the boundary).
 */

export async function consoleLogin(pin: string): Promise<{ ok: boolean }> {
  const ok = await loginWithPin(pin);
  return { ok };
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
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      address: o.address,
      totalMinor: o.totalMinor,
      deliveryFeeMinor: o.deliveryFeeMinor,
      customerNote: o.customerNote,
      createdAt: o.createdAt.toISOString(),
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
  next: "preparing" | "ready" | "completed" | "cancelled",
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "انتهت الجلسة — سجّل الدخول من جديد." };
  const result = await transitionOrder(orderId, next);
  if (result.ok) revalidatePath("/console");
  return result;
}
