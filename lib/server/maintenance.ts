import "server-only";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts, orderItems, orders, sessions } from "@/db/schema";

const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Visible replacement for anonymized customer fields. Deliberately distinct
 * from pii.ts's "[تعذر فك التشفير]" so an anonymized order can never be
 * mistaken for a key-encryption incident by the owner reading the console.
 */
export const PII_ANONYMIZED_MARKER = "مجهّل — سياسة الاحتفاظ";

/**
 * PII retention (owner decision 2026-11-18): customer name/phone/address/
 * customer note — and the per-line free-text notes on order_items, which
 * are customer-authored too (often a phone number) — are anonymized once an
 * order is older than the configured retention window (settings key
 * `pii_retention_months`, default 12; a month is approximated as 30 days,
 * which only ever errs toward earlier anonymization). The order itself —
 * numbers, money, items, status, history — stays fully reconstructable:
 * anonymization never deletes anything and never touches
 * order_status_history. `pii_anonymized_at` is the per-row audit mark, and
 * the IS NULL guard makes the job idempotent and cheap to re-run.
 */
export async function anonymizeExpiredPii(
  retentionMonths: number,
): Promise<{ anonymized: number }> {
  const cutoff = new Date(
    Date.now() - retentionMonths * 30 * 24 * 60 * 60 * 1000,
  );
  return db.transaction(async (tx) => {
    const stale = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(lt(orders.createdAt, cutoff), isNull(orders.piiAnonymizedAt)))
      // Bounded per run: the first pass after enabling retention (or a
      // shrunk window) must never lock thousands of rows at once — the IS
      // NULL guard makes the next cron catch the remainder.
      .limit(500);
    if (stale.length === 0) return { anonymized: 0 };

    // The IS NULL predicate is re-checked inside the UPDATE: a concurrent
    // DSAR transaction that anonymized one of these rows in the meantime
    // is skipped, never double-counted.
    const updated = await tx
      .update(orders)
      .set({
        customerName: PII_ANONYMIZED_MARKER,
        customerPhone: PII_ANONYMIZED_MARKER,
        address: null,
        customerNote: null,
        piiAnonymizedAt: new Date(),
      })
      .where(
        and(
          inArray(
            orders.id,
            stale.map((r) => r.id),
          ),
          isNull(orders.piiAnonymizedAt),
        ),
      )
      .returning({ id: orders.id });

    await tx
      .update(orderItems)
      .set({ note: null })
      .where(
        inArray(
          orderItems.orderId,
          updated.map((r) => r.id),
        ),
      );
    return { anonymized: updated.length };
  });
}

/**
 * DSAR core (owner-triggered, settings-page action): anonymize one order's
 * PII by order number. Conditional-transition style (spec §18.2) — a SELECT
 * FOR UPDATE decides between missing/already/done, so two concurrent
 * actions can never both report success on the same transition.
 */
export async function anonymizeOrderPiiByNumber(
  orderNumber: string,
): Promise<"ok" | "missing" | "already"> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: orders.id, piiAnonymizedAt: orders.piiAnonymizedAt })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1)
      .for("update");
    if (!target) return "missing";
    if (target.piiAnonymizedAt !== null) return "already";

    await tx
      .update(orders)
      .set({
        customerName: PII_ANONYMIZED_MARKER,
        customerPhone: PII_ANONYMIZED_MARKER,
        address: null,
        customerNote: null,
        piiAnonymizedAt: new Date(),
      })
      .where(eq(orders.id, target.id));
    await tx
      .update(orderItems)
      .set({ note: null })
      .where(eq(orderItems.orderId, target.id));
    return "ok";
  });
}

/**
 * Small, bounded housekeeping job. It intentionally does NOT delete
 * order_status_history: that is the audit trail the owner may need.
 */
export async function pruneExpiredData(): Promise<{
  sessions: number;
  loginAttempts: number;
}> {
  const now = new Date();
  const attemptCutoff = new Date(Date.now() - ATTEMPT_RETENTION_MS);

  const [expiredSessions, oldAttempts] = await Promise.all([
    db.delete(sessions).where(lt(sessions.expiresAt, now)),
    db.delete(loginAttempts).where(lt(loginAttempts.updatedAt, attemptCutoff)),
  ]);

  return {
    sessions: expiredSessions.rowCount ?? 0,
    loginAttempts: oldAttempts.rowCount ?? 0,
  };
}
