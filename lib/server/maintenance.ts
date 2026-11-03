import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts, sessions } from "@/db/schema";

const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
