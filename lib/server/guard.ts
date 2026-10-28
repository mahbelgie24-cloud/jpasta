import "server-only";
import { requireOwner, requireStaff, type SessionUser } from "./session";

/**
 * Central action guards. Every exported server action that touches
 * restricted data must go through one of these wrappers — a guard that is
 * forgotten or not awaited is a security bug (see v1 reports action).
 */

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export class GuardError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
    this.name = "GuardError";
  }
}

export function userMessageOf(
  err: unknown,
  fallback = "تعذر إكمال العملية — حاول مرة أخرى.",
): string {
  if (err instanceof GuardError) return err.userMessage;
  if (err instanceof Error && err.message === "owner-only")
    return "هذه الصفحة للمالك فقط.";
  if (err instanceof Error && err.message === "unauthenticated")
    return "انتهت الجلسة — سجّل الدخول من جديد.";
  return fallback;
}

export async function asOwner<T>(
  fn: (user: SessionUser) => Promise<T>,
  fallback?: string,
): Promise<ActionResult<T>> {
  try {
    const user = await requireOwner();
    return { ok: true, data: await fn(user) };
  } catch (err) {
    return { ok: false, error: userMessageOf(err, fallback) };
  }
}

export async function asStaff<T>(
  fn: (user: SessionUser) => Promise<T>,
  fallback?: string,
): Promise<ActionResult<T>> {
  try {
    const user = await requireStaff();
    return { ok: true, data: await fn(user) };
  } catch (err) {
    return { ok: false, error: userMessageOf(err, fallback) };
  }
}
