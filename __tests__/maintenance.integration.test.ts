import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import {
  loginAttempts,
  orderStatusHistory,
  orders,
  sessions,
  users,
} from "@/db/schema";
import {
  anonymizeExpiredPii,
  anonymizeOrderPiiByNumber,
  PII_ANONYMIZED_MARKER,
  pruneExpiredData,
} from "@/lib/server/maintenance";
import { testDatabaseUrl } from "@/test/db";

const DB_READY = Boolean(testDatabaseUrl());
const d = DB_READY ? describe : describe.skip;

// One shared teardown: closing the pool inside either describe would kill
// the second describe's tests.
afterAll(async () => {
  await pool.end();
});

d("maintenance pruning", () => {
  it("removes expired sessions and old login attempts, keeping live rows", async () => {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "owner"))
      .limit(1);
    if (!owner) throw new Error("seeded owner missing");

    const expiredToken = `prune-${crypto.randomUUID()}`;
    const liveToken = `keep-${crypto.randomUUID()}`;
    await db.insert(sessions).values({
      userId: owner.id,
      tokenHash: expiredToken,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    await db.insert(sessions).values({
      userId: owner.id,
      tokenHash: liveToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const oldKey = `prune-${crypto.randomUUID()}`;
    const freshKey = `keep-${crypto.randomUUID()}`;
    await db.insert(loginAttempts).values({
      key: oldKey,
      failedCount: 3,
      updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    await db.insert(loginAttempts).values({ key: freshKey, failedCount: 1 });

    const result = await pruneExpiredData();
    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(result.loginAttempts).toBeGreaterThanOrEqual(1);

    expect(
      await db
        .select()
        .from(sessions)
        .where(eq(sessions.tokenHash, expiredToken)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(loginAttempts)
        .where(eq(loginAttempts.key, oldKey)),
    ).toHaveLength(0);
    expect(
      await db.select().from(sessions).where(eq(sessions.tokenHash, liveToken)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(loginAttempts)
        .where(eq(loginAttempts.key, freshKey)),
    ).toHaveLength(1);

    await db.delete(sessions).where(eq(sessions.tokenHash, liveToken));
    await db.delete(loginAttempts).where(eq(loginAttempts.key, freshKey));
  });
});

// A fresh random order number per insert: an assert failure mid-test must
// never leak a row whose unique number then masks the next test's real
// failure with an unrelated uniqueness violation.
async function insertTestOrder(
  dayPrefix: string,
  createdAt: Date,
): Promise<{ id: string; orderNumber: string }> {
  const orderNumber = `JP-${dayPrefix}-${Math.floor(Math.random() * 900) + 100}`;
  const [row] = await db
    .insert(orders)
    .values({
      orderNumber,
      idempotencyKey: `retention-${crypto.randomUUID()}`,
      payloadHash: "a".repeat(64),
      channel: "takeaway",
      customerName: "زبون اختبار",
      customerPhone: "0599000000",
      address: "قلقيلية",
      subtotalMinor: 2500,
      totalMinor: 2500,
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: orders.id });
  if (!row) throw new Error("test order insert failed");
  return { id: row.id, orderNumber };
}

d("pii retention", () => {
  it("anonymizes only orders past the window and never touches the audit trail", async () => {
    const THIRTEEN_MONTHS = new Date(
      Date.now() - 13 * 30 * 24 * 60 * 60 * 1000,
    );
    const old = await insertTestOrder("251001", THIRTEEN_MONTHS);
    const fresh = await insertTestOrder("261118", new Date());
    await db.insert(orderStatusHistory).values({
      orderId: old.id,
      fromStatus: null,
      toStatus: "received",
    });

    const { anonymized } = await anonymizeExpiredPii(12);
    expect(anonymized).toBeGreaterThanOrEqual(1);

    const [oldRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, old.id));
    expect(oldRow?.customerName).toBe(PII_ANONYMIZED_MARKER);
    expect(oldRow?.customerPhone).toBe(PII_ANONYMIZED_MARKER);
    expect(oldRow?.address).toBeNull();
    expect(oldRow?.piiAnonymizedAt).not.toBeNull();
    // Money, payload binding and the capability token survive — the order
    // stays reconstructable (spec §9) after anonymization.
    expect(oldRow?.totalMinor).toBe(2500);
    expect(oldRow?.payloadHash).toBe("a".repeat(64));

    const [freshRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, fresh.id));
    expect(freshRow?.customerName).toBe("زبون اختبار");
    expect(freshRow?.piiAnonymizedAt).toBeNull();

    // The audit trail is the one thing this job must never lose.
    const history = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, old.id));
    expect(history).toHaveLength(1);

    await db.delete(orders).where(eq(orders.id, old.id));
    await db.delete(orders).where(eq(orders.id, fresh.id));
  });

  it("is idempotent: a second pass anonymizes nothing new", async () => {
    const old = await insertTestOrder(
      "251001",
      new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000),
    );
    await anonymizeExpiredPii(12);
    const second = await anonymizeExpiredPii(12);
    expect(second.anonymized).toBe(0);
    await db.delete(orders).where(eq(orders.id, old.id));
  });

  it("respects the configured window: a 13-month-old order survives 24 months", async () => {
    const old = await insertTestOrder(
      "251001",
      new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000),
    );
    await anonymizeExpiredPii(24);
    // Our 13-month-old order is inside a 24-month window: untouched. (The
    // batch count is not asserted — other suites may leave older rows.)
    const [row] = await db.select().from(orders).where(eq(orders.id, old.id));
    expect(row?.piiAnonymizedAt).toBeNull();
    expect(row?.customerName).toBe("زبون اختبار");
    await db.delete(orders).where(eq(orders.id, old.id));
  });

  it("DSAR core: anonymizes by order number, reports missing/already", async () => {
    const old = await insertTestOrder(
      "251001",
      new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000),
    );

    expect(await anonymizeOrderPiiByNumber(old.orderNumber)).toBe("ok");
    const [row] = await db.select().from(orders).where(eq(orders.id, old.id));
    expect(row?.piiAnonymizedAt).not.toBeNull();

    expect(await anonymizeOrderPiiByNumber(old.orderNumber)).toBe("already");
    expect(await anonymizeOrderPiiByNumber("JP-990101-999")).toBe("missing");

    await db.delete(orders).where(eq(orders.id, old.id));
  });
});
