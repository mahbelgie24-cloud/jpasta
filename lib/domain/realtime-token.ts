/**
 * Short-lived realtime tokens.
 *
 * The WebSocket handshake is handled by the custom Cloudflare worker before
 * it reaches Next.js. Rather than giving that worker database access, the
 * authenticated Next route mints a 2-minute HMAC token; the worker and the
 * Durable Object verify it with WebCrypto only.
 */

import { hmacSha256Hex, timingSafeEqualText } from "./hash";

export interface RealtimeClaims {
  sub: string;
  role: "owner" | "staff";
  exp: number;
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

export async function signRealtimeToken(
  claims: Omit<RealtimeClaims, "exp">,
  secret: string,
  ttlSeconds = 120,
): Promise<string> {
  const payload: RealtimeClaims = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = await hmacSha256Hex(body, secret);
  return `${body}.${signature}`;
}

/**
 * Server-to-Durable-Object broadcast authorization. The DO's `/broadcast`
 * route is only reachable through the binding today, but a future route,
 * binding, or refactor must not turn it into an unauthenticated fan-out
 * primitive. Constant-time comparison; missing secret = deny.
 */
export function isAuthorizedBroadcast(
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  // The same 32-character floor as requireSecret(): a short/empty secret
  // must never authorize a fan-out, even if a future router exposes this
  // route beyond the binding.
  if (!secret || secret.length < 32) return false;
  return timingSafeEqualText(authorizationHeader ?? "", `Bearer ${secret}`);
}

/** The broadcast timestamp is echoed to clients — keep it plausible. */
export function isFreshBroadcastTimestamp(
  at: unknown,
  now = Date.now(),
  windowMs = 5 * 60_000,
): boolean {
  return (
    at === undefined ||
    (typeof at === "number" &&
      Number.isFinite(at) &&
      Math.abs(now - at) <= windowMs)
  );
}

export async function verifyRealtimeToken(
  token: string,
  secret: string,
): Promise<RealtimeClaims | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacSha256Hex(body, secret);
  if (!timingSafeEqualText(signature, expected)) return null;
  try {
    const claims = JSON.parse(fromBase64Url(body)) as RealtimeClaims;
    if (
      typeof claims.sub !== "string" ||
      (claims.role !== "owner" && claims.role !== "staff") ||
      typeof claims.exp !== "number" ||
      claims.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
