import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { deliveryZones, orders, products } from "@/db/schema";
import { decryptPii, encryptPii, isEncryptedPii } from "@/lib/server/pii";
import { placeOrder } from "@/lib/server/orders";
import { getConsoleOrders } from "@/lib/server/orders";

/**
 * Field-level PII encryption (spec §13, SECURITY.md V8): customer fields are
 * ciphertext at rest when PII_ENCRYPTION_KEY is set, and the only read
 * surface (the console board) returns plaintext. Runs against the seeded
 * local database.
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

describe("pii primitives", () => {
  it("round-trips and never re-encrypts ciphertext", async () => {
    const cipher = await encryptPii("0599123456");
    if (process.env.PII_ENCRYPTION_KEY) {
      expect(isEncryptedPii(cipher)).toBe(true);
      expect(cipher).not.toContain("0599123456");
    } else {
      expect(cipher).toBe("0599123456"); // key-gated passthrough
    }
    expect(await decryptPii(cipher)).toBe("0599123456");
    expect(await decryptPii("legacy plain row")).toBe("legacy plain row");
    expect(await decryptPii(null)).toBe("");
    expect(await decryptPii("enc:v1:garbage:garbage")).toBe(""); // tamper-safe
  });
});

d("pii at rest", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("stores customer fields as ciphertext and the board reads them back", async () => {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "fettuccine-mushroom"))
      .limit(1);
    if (!row) throw new Error("seeded product missing");

    const key = process.env.PII_ENCRYPTION_KEY;
    const [zone] = await db
      .select({ id: deliveryZones.id })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .limit(1);
    if (!zone) throw new Error("seeded delivery zone missing");

    const result = await placeOrder({
      idempotencyKey: `pii-at-rest-${Date.now()}`,
      channel: "delivery",
      zoneId: zone.id,
      customer: {
        name: "زبون الخصوصية",
        phone: "0599000777",
        address: "حي الاختبار الآلي، قلقيلية",
      },
      lines: [
        {
          productId: row.id,
          quantity: 1,
          selections: [],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [stored] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.order.id))
      .limit(1);
    if (!stored) throw new Error("placed order row not found");
    if (key) {
      // At rest: ciphertext only — no plaintext PII in the row.
      expect(isEncryptedPii(stored.customerName)).toBe(true);
      expect(isEncryptedPii(stored.customerPhone)).toBe(true);
      expect(isEncryptedPii(stored.address ?? "")).toBe(true);
      expect(stored.customerPhone).not.toContain("0599000777");
    }

    // The console board is the single decryption point.
    const board = await getConsoleOrders();
    const mine = board.find((o) => o.id === result.order.id);
    if (mine) {
      expect(mine.customerName).toBe("زبون الخصوصية");
      expect(mine.customerPhone).toBe("0599000777");
      expect(mine.address).toBe("حي الاختبار الآلي، قلقيلية");
    }
  });
});
