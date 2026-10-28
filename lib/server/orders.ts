import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deliveryZones,
  modifierGroups,
  modifiers,
  orderCounters,
  orderItems,
  orderStatusHistory,
  orders,
  products,
} from "@/db/schema";
import { addMinor, multiplyMinor, sumMinor, type Minor } from "@/lib/pricing";
import { notifyOrdersChanged } from "@/lib/server/order-feed";
import { deductForOrder } from "@/lib/server/inventory";
import { sha256Hex, stableStringify } from "@/lib/domain/hash";
import { todayInShop } from "@/lib/domain/time";
import { logEvent } from "@/lib/server/log";

/**
 * Order placement core (spec §9/§12) — the money-critical path.
 *
 * Invariants:
 *  1. Prices are recomputed SERVER-SIDE from the DB. The client sends only
 *     product/option KEYS and quantities — never a price.
 *  2. Every order carries a client-generated idempotencyKey with a UNIQUE
 *     constraint; a replay returns the original order, but only if the
 *     normalized payload matches (payload_hash).
 *  3. Delivery fee comes from the CUSTOMER'S ZONE (zone_id), never the
 *     cheapest active zone and never the client.
 *  4. Line snapshots (name/detail/price) make every order reconstructable.
 *  5. Order numbers are gap-free per local day (order_counters).
 *  6. Every status change is recorded in order_status_history.
 */

class OrderError extends Error {}
class OrderConflict extends Error {}

export type OrderStatus =
  "received" | "preparing" | "ready" | "completed" | "cancelled";

export const orderInputSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(80),
    channel: z.enum(["takeaway", "delivery"]),
    source: z.enum(["storefront", "console"]).default("storefront"),
    zoneId: z.string().uuid().optional(),
    customer: z.object({
      name: z.string().trim().min(2, "الاسم مطلوب").max(60),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\-\s]{9,15}$/, "رقم الهاتف غير صحيح"),
      address: z.string().trim().max(140),
    }),
    note: z.string().trim().max(200).optional(),
    paymentMethod: z
      .enum(["cash", "card_terminal", "cash_on_delivery"])
      .default("cash"),
    lines: z
      .array(
        z.object({
          productId: z
            .string()
            .uuid("أحد الأصناف في سلتك غير متوفر — حدّث الصفحة وأعد إضافته."),
          quantity: z.number().int().min(1).max(20),
          note: z.string().trim().max(140).optional(),
          selections: z
            .array(
              z.object({
                groupKey: z.string().max(32),
                optionKey: z.string().max(48),
              }),
            )
            .max(12),
        }),
      )
      .min(1, "السلة فاضية")
      .max(30),
  })
  .refine(
    (v) =>
      v.channel !== "delivery" ||
      (v.customer.address.length >= 5 && Boolean(v.zoneId)),
    {
      message: "عنوان التوصيل ومنطقته مطلوبان",
      path: ["customer", "address"],
    },
  );

export type OrderInput = z.input<typeof orderInputSchema>;
export type NormalizedOrderInput = z.output<typeof orderInputSchema>;

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  accessToken: string;
  status: OrderStatus;
  totalMinor: Minor;
  channel: "takeaway" | "delivery" | "dine_in";
  createdAt: Date;
}

export type PlaceOrderResult =
  { ok: true; order: PlacedOrder } | { ok: false; error: string };

interface ComputedLine {
  productId: string;
  nameAr: string;
  detailAr: string | null;
  note: string | null;
  quantity: number;
  unitPriceMinor: Minor;
  lineTotalMinor: Minor;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

async function payloadHashOf(input: NormalizedOrderInput): Promise<string> {
  return sha256Hex(stableStringify(input));
}

async function findReplay(
  idempotencyKey: string,
): Promise<(PlacedOrder & { payloadHash: string }) | null> {
  const [row] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      accessToken: orders.accessToken,
      status: orders.status,
      totalMinor: orders.totalMinor,
      channel: orders.channel,
      createdAt: orders.createdAt,
      payloadHash: orders.payloadHash,
    })
    .from(orders)
    .where(eq(orders.idempotencyKey, idempotencyKey))
    .limit(1);
  return row ?? null;
}

function assertReplayMatches(
  existing: { payloadHash: string },
  incomingHash: string,
): void {
  // Legacy rows migrated with an empty hash predate payload binding.
  if (existing.payloadHash && existing.payloadHash !== incomingHash) {
    throw new OrderError(
      "هذا المفتاح مستخدم لطلب سابق مختلف — حدّث الصفحة وابدأ طلباً جديداً.",
    );
  }
}

export async function placeOrder(
  raw: OrderInput,
  options?: { actorId?: string },
): Promise<PlaceOrderResult> {
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "بيانات الطلب غير صحيحة.",
    };
  }
  const input = parsed.data;
  const payloadHash = await payloadHashOf(input);

  try {
    const result = await db.transaction(async (tx) => {
      // (1) idempotent replay — same key + same payload returns the order
      const [existing] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          accessToken: orders.accessToken,
          status: orders.status,
          totalMinor: orders.totalMinor,
          channel: orders.channel,
          createdAt: orders.createdAt,
          payloadHash: orders.payloadHash,
        })
        .from(orders)
        .where(eq(orders.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) {
        assertReplayMatches(existing, payloadHash);
        return { ok: true as const, order: existing };
      }

      // (2) load the requested catalog rows
      const productIds = [...new Set(input.lines.map((l) => l.productId))];
      const prodRows = await tx
        .select()
        .from(products)
        .where(
          and(inArray(products.id, productIds), eq(products.isAvailable, true)),
        );
      if (prodRows.length !== productIds.length) {
        throw new OrderError(
          "صنف في السلة لم يعد متوفراً — حدّث القائمة وحاول مرة أخرى.",
        );
      }
      const prodById = new Map(prodRows.map((p) => [p.id, p]));

      const groupRows = await tx
        .select()
        .from(modifierGroups)
        .where(inArray(modifierGroups.productId, productIds))
        .orderBy(asc(modifierGroups.sortOrder));
      const groupsByProduct = new Map<string, typeof groupRows>();
      for (const g of groupRows) {
        const list = groupsByProduct.get(g.productId) ?? [];
        list.push(g);
        groupsByProduct.set(g.productId, list);
      }

      const optionRows = groupRows.length
        ? await tx
            .select()
            .from(modifiers)
            .where(
              inArray(
                modifiers.groupId,
                groupRows.map((g) => g.id),
              ),
            )
        : [];
      const optionsByGroup = new Map<string, typeof optionRows>();
      for (const o of optionRows) {
        const list = optionsByGroup.get(o.groupId) ?? [];
        list.push(o);
        optionsByGroup.set(o.groupId, list);
      }

      // (3) compute every line server-side — the client's prices are ignored
      const computed: ComputedLine[] = input.lines.map((line) => {
        const product = prodById.get(line.productId);
        if (!product) throw new OrderError("صنف غير معروف في السلة.");

        let unit: Minor = product.basePriceMinor;
        const details: string[] = [];
        const groups = groupsByProduct.get(product.id) ?? [];

        const selectedByGroup = new Map<string, string[]>();
        for (const s of line.selections) {
          const list = selectedByGroup.get(s.groupKey) ?? [];
          list.push(s.optionKey);
          selectedByGroup.set(s.groupKey, list);
        }

        for (const g of groups) {
          const chosen = selectedByGroup.get(g.key) ?? [];
          if (g.isRequired && chosen.length === 0) {
            throw new OrderError(`اختيار مطلوب ناقص: ${g.nameAr}`);
          }
          if (g.type === "single" && chosen.length > 1) {
            throw new OrderError(`خيار واحد فقط مسموح لـ: ${g.nameAr}`);
          }
          if (g.maxSelections !== null && chosen.length > g.maxSelections) {
            throw new OrderError(
              `الحد الأقصى ${g.maxSelections} لـ: ${g.nameAr}`,
            );
          }
          for (const key of chosen) {
            const opt = optionsByGroup.get(g.id)?.find((o) => o.key === key);
            if (!opt) throw new OrderError(`خيار غير صالح في: ${g.nameAr}`);
            unit = addMinor(unit, opt.priceDeltaMinor);
            if (g.key === "size") details.unshift(opt.nameAr);
            else if (g.key === "heat" && opt.key !== "mild")
              details.push(opt.nameAr);
            else if (g.key === "doneness" && opt.key !== "al-dente")
              details.push(opt.nameAr);
            else if (g.key === "extras") details.push(opt.nameAr);
          }
        }

        return {
          productId: product.id,
          nameAr: product.nameAr,
          detailAr: details.length > 0 ? details.join(" • ") : null,
          note: line.note ?? null,
          quantity: line.quantity,
          unitPriceMinor: unit,
          lineTotalMinor: multiplyMinor(unit, line.quantity),
        };
      });

      const subtotal: Minor = sumMinor(computed.map((l) => l.lineTotalMinor));

      // (4) delivery fee from the CUSTOMER'S zone — never from the client
      let fee: Minor = 0;
      let zoneId: string | null = null;
      if (input.channel === "delivery") {
        if (!input.zoneId || !isUuid(input.zoneId)) {
          throw new OrderError("اختر منطقة التوصيل.");
        }
        const [zone] = await tx
          .select({ id: deliveryZones.id, feeMinor: deliveryZones.feeMinor })
          .from(deliveryZones)
          .where(
            and(
              eq(deliveryZones.id, input.zoneId),
              eq(deliveryZones.isActive, true),
            ),
          )
          .limit(1);
        if (!zone) throw new OrderError("منطقة التوصيل غير متاحة حالياً.");
        fee = zone.feeMinor;
        zoneId = zone.id;
      }
      const total: Minor = subtotal + fee;

      // (5) gap-free human-facing number per local day: JP-YYMMDD-NNN
      const day = todayInShop();
      const [counter] = await tx
        .insert(orderCounters)
        .values({ day, lastNumber: 1 })
        .onConflictDoUpdate({
          target: orderCounters.day,
          set: { lastNumber: sql`${orderCounters.lastNumber} + 1` },
        })
        .returning({ lastNumber: orderCounters.lastNumber });
      if (!counter) throw new OrderError("تعذر توليد رقم الطلب.");
      const compactDay = day.slice(2).replace(/-/g, "");
      const orderNumber = `JP-${compactDay}-${String(counter.lastNumber).padStart(3, "0")}`;

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          channel: input.channel,
          source: input.source,
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          address: input.channel === "delivery" ? input.customer.address : null,
          zoneId,
          paymentMethod: input.paymentMethod,
          subtotalMinor: subtotal,
          deliveryFeeMinor: fee,
          totalMinor: total,
          customerNote: input.note ?? null,
        })
        .returning({
          id: orders.id,
          orderNumber: orders.orderNumber,
          accessToken: orders.accessToken,
          status: orders.status,
          totalMinor: orders.totalMinor,
          channel: orders.channel,
          createdAt: orders.createdAt,
        });
      if (!order) throw new OrderError("تعذر حفظ الطلب.");

      await tx.insert(orderItems).values(
        computed.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          nameAr: l.nameAr,
          detailAr: l.detailAr,
          note: l.note,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          lineTotalMinor: l.lineTotalMinor,
        })),
      );

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: null,
        toStatus: "received",
        actorId: options?.actorId ?? null,
      });

      // Phase 4: recipe-driven stock deduction — same transaction as the sale
      await deductForOrder(
        tx,
        order.id,
        computed.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      );

      return { ok: true as const, order };
    });

    // Notify AFTER the transaction commits — notifying inside the callback
    // races the commit (measured ~2.9s instead of milliseconds).
    if (result.ok) await notifyOrdersChanged();
    return result;
  } catch (err) {
    if (err instanceof OrderError)
      return { ok: false as const, error: err.message };
    // concurrent duplicate lost the race on the unique key → serve the winner
    if (isUniqueViolation(err)) {
      const replay = await findReplay(input.idempotencyKey);
      if (replay) {
        try {
          assertReplayMatches(replay, payloadHash);
        } catch (conflict) {
          if (conflict instanceof OrderError)
            return { ok: false as const, error: conflict.message };
          throw conflict;
        }
        return { ok: true as const, order: replay };
      }
    }
    logEvent("error", "order.place_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false as const, error: "تعذر إرسال الطلب — حاول مرة أخرى." };
  }
}

// ---------- Delivery zones (public read) ----------

export interface PublicZone {
  id: string;
  nameAr: string;
  feeMinor: Minor;
}

export async function getActiveDeliveryZones(): Promise<PublicZone[]> {
  return db
    .select({
      id: deliveryZones.id,
      nameAr: deliveryZones.nameAr,
      feeMinor: deliveryZones.feeMinor,
    })
    .from(deliveryZones)
    .where(eq(deliveryZones.isActive, true))
    .orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.feeMinor));
}

// ---------- Status page (token-gated capability) ----------

export type OrderStatusView = {
  orderNumber: string;
  status: OrderStatus;
  channel: "takeaway" | "delivery" | "dine_in";
  subtotalMinor: Minor;
  deliveryFeeMinor: Minor;
  totalMinor: Minor;
  zoneNameAr: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    nameAr: string;
    detailAr: string | null;
    quantity: number;
    lineTotalMinor: Minor;
  }>;
};

export async function getOrderForStatus(
  orderId: string,
  token: string,
): Promise<OrderStatusView | null> {
  if (!isUuid(orderId) || !isUuid(token)) return null;
  const [row] = await db
    .select({
      order: orders,
      zoneNameAr: deliveryZones.nameAr,
    })
    .from(orders)
    .leftJoin(deliveryZones, eq(deliveryZones.id, orders.zoneId))
    .where(and(eq(orders.id, orderId), eq(orders.accessToken, token)))
    .limit(1);
  if (!row) return null;
  const order = row.order;
  const items = await db
    .select({
      nameAr: orderItems.nameAr,
      detailAr: orderItems.detailAr,
      quantity: orderItems.quantity,
      lineTotalMinor: orderItems.lineTotalMinor,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    channel: order.channel,
    subtotalMinor: order.subtotalMinor,
    deliveryFeeMinor: order.deliveryFeeMinor,
    totalMinor: order.totalMinor,
    zoneNameAr: row.zoneNameAr,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
  };
}

// ---------- Console board ----------

export const LEGAL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function getConsoleOrders() {
  const rows = await db
    .select()
    .from(orders)
    .where(inArray(orders.status, ["received", "preparing", "ready"]))
    .orderBy(asc(orders.createdAt));
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push(it);
    itemsByOrder.set(it.orderId, list);
  }
  return rows.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] }));
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
}

export async function transitionOrder(input: {
  orderId: string;
  next: Exclude<OrderStatus, "received">;
  expected: OrderStatus;
  actorId?: string;
  reason?: string;
}): Promise<TransitionResult> {
  const { orderId, next, expected, actorId } = input;
  if (!isUuid(orderId)) return { ok: false, error: "رقم الطلب غير صحيح." };
  if (!LEGAL_TRANSITIONS[expected]?.includes(next)) {
    return {
      ok: false,
      error: `لا يمكن نقل الطلب من ${expected} إلى ${next}`,
    };
  }
  const reason = input.reason?.trim() ?? "";
  if (next === "cancelled" && reason.length < 2) {
    return { ok: false, error: "سبب الإلغاء مطلوب." };
  }

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orders)
        .set({
          status: next,
          updatedAt: new Date(),
          cancelledReason: next === "cancelled" ? reason : null,
        })
        .where(and(eq(orders.id, orderId), eq(orders.status, expected)))
        .returning({ id: orders.id });
      if (!updated) throw new OrderConflict("status-changed");
      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: expected,
        toStatus: next,
        actorId,
        reason: reason || null,
      });
    });
  } catch (err) {
    if (err instanceof OrderConflict) {
      return {
        ok: false,
        conflict: true,
        error: "تغيّرت حالة الطلب من جهاز آخر — حدّث الشاشة.",
      };
    }
    logEvent("error", "order.transition_failed", {
      orderId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, error: "تعذر تحديث الطلب — حاول مرة أخرى." };
  }

  await notifyOrdersChanged();
  return { ok: true };
}

/**
 * Owner undo: revert the most recent transition if it happened within
 * 5 minutes. Mis-taps on a busy KDS are otherwise unrecoverable.
 */
export async function undoLastTransition(input: {
  orderId: string;
  actorId?: string;
}): Promise<TransitionResult> {
  if (!isUuid(input.orderId))
    return { ok: false, error: "رقم الطلب غير صحيح." };

  const [last] = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, input.orderId))
    .orderBy(desc(orderStatusHistory.createdAt))
    .limit(1);

  if (!last || !last.fromStatus) {
    return { ok: false, error: "لا يوجد انتقال سابق للتراجع عنه." };
  }
  if (Date.now() - last.createdAt.getTime() > 5 * 60_000) {
    return { ok: false, error: "انتهت مهلة التراجع (٥ دقائق)." };
  }

  // Capture before entering the transaction closure — narrowing of a mutable
  // object property is not preserved inside a deferred callback.
  const previousStatus = last.fromStatus;
  const currentStatus = last.toStatus;

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orders)
        .set({ status: previousStatus, updatedAt: new Date() })
        .where(
          and(eq(orders.id, input.orderId), eq(orders.status, currentStatus)),
        )
        .returning({ id: orders.id });
      if (!updated) throw new OrderConflict("status-changed");
      await tx.insert(orderStatusHistory).values({
        orderId: input.orderId,
        fromStatus: currentStatus,
        toStatus: previousStatus,
        actorId: input.actorId ?? null,
        reason: "تراجع",
      });
    });
  } catch (err) {
    if (err instanceof OrderConflict) {
      return {
        ok: false,
        conflict: true,
        error: "تغيّرت حالة الطلب — حدّث الشاشة.",
      };
    }
    logEvent("error", "order.undo_failed", {
      orderId: input.orderId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, error: "تعذر التراجع — حاول مرة أخرى." };
  }

  await notifyOrdersChanged();
  return { ok: true };
}

export async function getOrderHistory(orderId: string) {
  if (!isUuid(orderId)) return [];
  return db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(asc(orderStatusHistory.createdAt));
}
