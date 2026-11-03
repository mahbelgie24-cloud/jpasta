import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import {
  categories,
  modifierGroups,
  modifiers,
  orders,
  products,
} from "@/db/schema";

/**
 * The database is the last line of defence. These tests exercise the
 * constraints added in 0003 directly, so an app-level regression can never
 * silently reintroduce duplicate factory keys or a cancelled order without
 * a reason.
 */

const DB_READY = Boolean(process.env.DATABASE_URL);
const d = DB_READY ? describe : describe.skip;

/** Drizzle wraps driver errors; the Postgres constraint lives on `cause`. */
async function expectConstraint(
  promise: Promise<unknown>,
  constraint: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ cause: { constraint } });
}

function orderBase() {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const numeric = `${String(Date.now()).slice(-6)}${String(
    Math.floor(Math.random() * 1000),
  ).padStart(3, "0")}`;
  return {
    orderNumber: `JP-260101-${numeric}`,
    idempotencyKey: `constraint-${suffix}`,
    payloadHash: "a".repeat(64),
    channel: "takeaway" as const,
    customerName: "زبون الاختبار",
    customerPhone: "0566064976",
    subtotalMinor: 1000,
    deliveryFeeMinor: 0,
    totalMinor: 1000,
  };
}

d("database integrity constraints", () => {
  let categoryId = "";
  let productId = "";
  let groupId = "";

  beforeAll(async () => {
    const [category] = await db
      .insert(categories)
      .values({
        slug: `constraints-${crypto.randomUUID().slice(0, 8)}`,
        nameAr: "اختبار القيود",
        nameEn: "Constraints",
        sortOrder: 999,
      })
      .returning({ id: categories.id });
    if (!category) throw new Error("category insert failed");
    categoryId = category.id;

    const [product] = await db
      .insert(products)
      .values({
        categoryId,
        slug: `constraints-${crypto.randomUUID().slice(0, 8)}`,
        nameAr: "طبق اختبار",
        nameEn: "Test dish",
        basePriceMinor: 1000,
        sortOrder: 999,
      })
      .returning({ id: products.id });
    if (!product) throw new Error("product insert failed");
    productId = product.id;

    const [group] = await db
      .insert(modifierGroups)
      .values({
        productId,
        key: "size",
        nameAr: "الحجم",
        type: "single",
        sortOrder: 0,
      })
      .returning({ id: modifierGroups.id });
    if (!group) throw new Error("group insert failed");
    groupId = group.id;
  });

  afterAll(async () => {
    // Deleting the product cascades groups/modifiers; the category is
    // restricted by products, so it must go last.
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(categories).where(eq(categories.id, categoryId));
    await pool.end();
  });

  it("rejects a duplicate option key within the same group", async () => {
    await db.delete(modifiers).where(eq(modifiers.groupId, groupId));
    await db.insert(modifiers).values({
      groupId,
      key: "large",
      nameAr: "كبير",
      priceDeltaMinor: 500,
      sortOrder: 0,
    });

    await expectConstraint(
      db.insert(modifiers).values({
        groupId,
        key: "large",
        nameAr: "كبير مكرر",
        priceDeltaMinor: 700,
        sortOrder: 1,
      }),
      "modifiers_group_key_uidx",
    );
  });

  it("rejects a duplicate group key within the same product", async () => {
    await expectConstraint(
      db.insert(modifierGroups).values({
        productId,
        key: "size",
        nameAr: "الحجم مكرر",
        type: "single",
        sortOrder: 1,
      }),
      "modifier_groups_product_key_uidx",
    );
  });

  it("rejects a cancelled order without a reason", async () => {
    await expectConstraint(
      db.insert(orders).values({
        ...orderBase(),
        status: "cancelled",
        cancelledReason: null,
      }),
      "orders_cancel_reason_check",
    );
  });

  it("rejects a malformed order number", async () => {
    await expectConstraint(
      db.insert(orders).values({
        ...orderBase(),
        orderNumber: "JP-BAD",
      }),
      "orders_order_number_check",
    );
  });

  it("rejects an empty or malformed payload hash", async () => {
    await expectConstraint(
      db.insert(orders).values({
        ...orderBase(),
        payloadHash: "",
      }),
      "orders_payload_hash_check",
    );
  });

  it("accepts the explicit legacy payload sentinel", async () => {
    const [row] = await db
      .insert(orders)
      .values({
        ...orderBase(),
        payloadHash: `legacy:${crypto.randomUUID()}`,
      })
      .returning({ id: orders.id });
    expect(row?.id).toBeTruthy();
    if (row) await db.delete(orders).where(eq(orders.id, row.id));
  });
});
