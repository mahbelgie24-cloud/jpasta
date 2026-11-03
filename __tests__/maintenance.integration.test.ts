import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { loginAttempts, sessions, users } from "@/db/schema";
import { pruneExpiredData } from "@/lib/server/maintenance";
import { testDatabaseUrl } from "@/test/db";

const DB_READY = Boolean(testDatabaseUrl());
const d = DB_READY ? describe : describe.skip;

d("maintenance pruning", () => {
  afterAll(async () => {
    await pool.end();
  });

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
