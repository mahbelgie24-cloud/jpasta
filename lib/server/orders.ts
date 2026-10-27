import "server-only";
import { z } from "zod";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deliveryZones,
  modifierGroups,
  modifiers,
  orderItems,
  orders,
  products,
} from "@/db/schema";
import { addMinor, multiplyMinor, sumMinor, type Minor } from "@/lib/pricing";
import { notifyOrdersChanged } from "@/lib/server/bus";
import { deductForOrder } from "@/lib/server/inventory";

/**
 * Order placement core (spec §9/§12) — the money-critical path.
 *
 * Invariants:
 *  1. Prices are recomputed SERVER-SIDE from the DB. The client sends only
 *     product/option KEYS and quantities — never a price.
 *  2. Every order carries a client-generated idempotencyKey with a UNIQUE
 *     constraint; a replay returns the original order (inside the same
 *     transaction, plus a concurrent-race fallback on unique violation).
 *  3. Delivery fee comes from the DB (delivery_zones), never from the client.
 *  4. Line snapshots (name/detail/price) make every order reconstructable.
 */

/** Thrown for user-facing validation failures — rolls the txn back. */
class OrderError extends Error {}

export const orderInputSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(80),
    channel: z.enum(["takeaway", "delivery"]),
    source: z.enum(["storefront", "console"]).default("storefront"),
    customer: z.object({
      name: z.string().trim().min(2, "الاسم مطلوب").max(60),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\-\s]{9,15}$/, "رقم الهاتف غير صحيح"),
      address: z.string().trim().max(140),
    }),
    note: z.string().trim().max(200).optional(),
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
  .refine((v) => v.channel !== "delivery" || v.customer.address.length >= 5, {
    message: "عنوان التوصيل مطلوب",
    path: ["customer", "address"],
  });

export type OrderInput = z.input<typeof orderInputSchema>;

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  accessToken: string;
  status: "received" | "preparing" | "ready" | "completed" | "cancelled";
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

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

async function findReplay(idempotencyKey: string): Promise<PlacedOrder | null> {
  const [row] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      accessToken: orders.accessToken,
      status: orders.status,
      totalMinor: orders.totalMinor,
      channel: orders.channel,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.idempotencyKey, idempotencyKey))
    .limit(1);
  return row ?? null;
}

export async function placeOrder(raw: OrderInput): Promise<PlaceOrderResult> {
  // Normalize (apply schema defaults like source=storefront) — direct
  // callers (tests, scripts) get the same defaults as the server action.
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "بيانات الطلب غير صحيحة.",
    };
  }
  const input = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      // (1) idempotent replay — same key returns the original order
      const [existing] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          accessToken: orders.accessToken,
          status: orders.status,
          totalMinor: orders.totalMinor,
          channel: orders.channel,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return { ok: true as const, order: existing };

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

      // (4) delivery fee from the DB — never from the client
      let fee: Minor = 0;
      if (input.channel === "delivery") {
        const [zone] = await tx
          .select({ feeMinor: deliveryZones.feeMinor })
          .from(deliveryZones)
          .where(eq(deliveryZones.isActive, true))
          .orderBy(asc(deliveryZones.feeMinor))
          .limit(1);
        fee = zone?.feeMinor ?? 0;
      }
      const total: Minor = subtotal + fee;

      // (5) sequential human-facing number: JP-00001
      const numRes = await tx.execute(
        sql`SELECT 'JP-' || lpad(nextval('order_seq')::text, 5, '0') AS num`,
      );
      const numRow = (numRes.rows as Array<{ num: string }>)[0];
      if (!numRow) throw new OrderError("تعذر توليد رقم الطلب.");
      const orderNumber = numRow.num;

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          idempotencyKey: input.idempotencyKey,
          channel: input.channel,
          source: input.source,
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          address: input.channel === "delivery" ? input.customer.address : null,
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

      // Phase 4: recipe-driven stock deduction — same transaction as the
      // sale, one audited inventory_moves row per affected ingredient.
      await deductForOrder(
        tx,
        order.id,
        computed.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      );

      return { ok: true as const, order };
    });
    // Notify AFTER the transaction commits — notifying inside the callback
    // races the commit: subscribers would read pre-commit data and fall back
    // to the slow poll (measured ~2.9s instead of milliseconds).
    if (result.ok) notifyOrdersChanged();
    return result;
  } catch (err) {
    if (err instanceof OrderError)
      return { ok: false as const, error: err.message };
    // concurrent duplicate lost the race on the unique key → serve the winner
    if (isUniqueViolation(err)) {
      const replay = await findReplay(input.idempotencyKey);
      if (replay) return { ok: true as const, order: replay };
    }
    console.error("placeOrder failed:", err);
    return { ok: false as const, error: "تعذر إرسال الطلب — حاول مرة أخرى." };
  }
}

// ---------- Status page (token-gated capability) ----------

export type OrderStatusView = {
  orderNumber: string;
  status: "received" | "preparing" | "ready" | "completed" | "cancelled";
  channel: "takeaway" | "delivery" | "dine_in";
  totalMinor: Minor;
  createdAt: Date;
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
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(token))
    return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.accessToken, token)))
    .limit(1);
  if (!order) return null;
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
    totalMinor: order.totalMinor,
    createdAt: order.createdAt,
    items,
  };
}

// ---------- Console board ----------

export const LEGAL_TRANSITIONS: Record<string, string[]> = {
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
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

export async function transitionOrder(
  orderId: string,
  next: "preparing" | "ready" | "completed" | "cancelled",
): Promise<{ ok: boolean; error?: string }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { ok: false, error: "الطلب غير موجود" };
  if (!LEGAL_TRANSITIONS[order.status]?.includes(next)) {
    return {
      ok: false,
      error: `لا يمكن نقل الطلب من ${order.status} إلى ${next}`,
    };
  }
  await db
    .update(orders)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  notifyOrdersChanged();
  return { ok: true };
}
