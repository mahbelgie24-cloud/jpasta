import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { products } from "@/db/schema";
import { todayInShop } from "@/lib/domain/time";
import {
  getOrderDetail,
  getOrdersForDay,
  placeOrder,
} from "@/lib/server/orders";

/**
 * Order archive (console history + receipt) — the PII-decrypting read path.
 * Requires the seeded local database. The search intentionally runs after
 * decryption (customer fields are ciphertext at rest), so this suite proves
 * the decrypt + filter + detail composition, not just SQL.
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

d("order archive", () => {
  let penneId = "";
  let orderId = "";
  let orderNumber = "";

  beforeAll(async () => {
    const [penne] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "penne-alfredo"))
      .limit(1);
    if (!penne) throw new Error("seed missing — run npm run db:seed");
    penneId = penne.id;
    await db.execute(sql`TRUNCATE order_items, orders CASCADE`);

    const result = await placeOrder({
      idempotencyKey: `archive-test-${Date.now()}`,
      channel: "takeaway",
      customer: {
        name: "زبون الأرشيف الاختباري",
        phone: "0599000666",
        address: "",
      },
      lines: [
        {
          productId: penneId,
          quantity: 2,
          selections: [],
        },
      ],
    });
    if (!result.ok) throw new Error(`placeOrder failed: ${result.error}`);
    orderId = result.order.id;
    orderNumber = result.order.orderNumber;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns the day's orders with decrypted customer fields", async () => {
    const rows = await getOrdersForDay(todayInShop());
    const mine = rows.find((row) => row.id === orderId);
    expect(mine).toBeDefined();
    expect(mine?.orderNumber).toBe(orderNumber);
    expect(mine?.customerName).toBe("زبون الأرشيف الاختباري");
    expect(mine?.customerPhone).toBe("0599000666");
    expect(mine?.itemCount).toBe(2);
    expect(mine?.itemsSummary[0]).toContain("بيني ألفريدو");
  });

  it("searches order number, name, phone digits and item name", async () => {
    const date = todayInShop();
    for (const query of [orderNumber, "زبون الأرشيف", "0666", "بيني ألفريدو"]) {
      const rows = await getOrdersForDay(date, { query });
      expect(
        rows.some((row) => row.id === orderId),
        query,
      ).toBe(true);
    }
    const none = await getOrdersForDay(date, { query: "لا-يوجد-هذا" });
    expect(none.some((row) => row.id === orderId)).toBe(false);
  });

  it("filters by status and rejects invalid dates", async () => {
    const received = await getOrdersForDay(todayInShop(), {
      status: "received",
    });
    expect(received.some((row) => row.id === orderId)).toBe(true);

    const cancelled = await getOrdersForDay(todayInShop(), {
      status: "cancelled",
    });
    expect(cancelled.some((row) => row.id === orderId)).toBe(false);

    expect(await getOrdersForDay("2026-13-40")).toEqual([]);
    expect(await getOrdersForDay("")).toEqual([]);
  });

  it("returns the full detail with items and audit history", async () => {
    const detail = await getOrderDetail(orderId);
    expect(detail?.customerName).toBe("زبون الأرشيف الاختباري");
    expect(detail?.customerPhone).toBe("0599000666");
    expect(detail?.items).toHaveLength(1);
    expect(detail?.items[0]?.quantity).toBe(2);
    expect(detail?.items[0]?.lineTotalMinor).toBe(4000);
    expect(detail?.history).toHaveLength(1);
    expect(detail?.history[0]?.fromStatus).toBeNull();
    expect(detail?.history[0]?.toStatus).toBe("received");
  });

  it("returns null for a malformed or unknown order id", async () => {
    expect(await getOrderDetail("not-a-uuid")).toBeNull();
    expect(
      await getOrderDetail("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });
});
