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
