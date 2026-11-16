import { afterAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "@/test/db";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { deliveryZones, products } from "@/db/schema";
import { placeOrder, verifyOrderAccessToken } from "@/lib/server/orders";

/**
 * Customer realtime capability (Phase C): the WebSocket token endpoint gates
 * on the (orderId, accessToken) pair. These tests prove the pair check is a
 * real capability — right pair passes, anything else fails closed.
 */

const DB_READY = Boolean(testDatabaseUrl());
const d = DB_READY ? describe : describe.skip;

d("customer realtime capability", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("verifies the real (orderId, accessToken) pair and nothing else", async () => {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "penne-alfredo"))
      .limit(1);
    if (!row) throw new Error("seeded product missing");
    const [zone] = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .limit(1);
    if (!zone) throw new Error("seeded delivery zone missing");

    const result = await placeOrder({
      idempotencyKey: `realtime-customer-${Date.now()}`,
      channel: "takeaway",
      customer: { name: "زبون لحظي", phone: "0599000666", address: "" },
      lines: [{ productId: row.id, quantity: 1, selections: [] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { id, accessToken } = result.order;
    expect(await verifyOrderAccessToken(id, accessToken)).toBe(true);
    // Wrong token / wrong order / malformed input — all fail closed.
    expect(
      await verifyOrderAccessToken(id, "00000000-0000-4000-8000-000000000000"),
    ).toBe(false);
    expect(
      await verifyOrderAccessToken(
        "00000000-0000-4000-8000-000000000000",
        accessToken,
      ),
    ).toBe(false);
    expect(await verifyOrderAccessToken("not-a-uuid", accessToken)).toBe(false);
    expect(await verifyOrderAccessToken(id, "")).toBe(false);
  });
});
