/**
 * VAPID (RFC 8292) for Web Push, implemented with WebCrypto only so the
 * same code runs on Cloudflare Workers and Node. Sends an EMPTY push
 * (a "tickle"); the service worker fetches the pending count and renders
 * the notification. That avoids implementing RFC 8291 payload encryption
 * and keeps the message free of customer data.
 */

export interface VapidKeys {
  /** Private P-256 JWK (kty EC, crv P-256, d, x, y). */
  privateKeyJwk: JsonWebKey;
  /** Uncompressed public point, base64url (65 bytes → 87 chars). */
  publicKey: string;
  /** Contact URI for the VAPID `sub` claim (https: or mailto:). */
  subject: string;
}

/** Hosts browsers actually use for push services. Blocks SSRF. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "wns.windows.com",
  "push.apple.com",
  "web.push.apple.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return PUSH_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Build the `Authorization` header for one push endpoint. The JWT audience
 * is the push service origin, the signature is raw r||s (WebCrypto ECDSA),
 * and the public key is the `k=` parameter the browser subscribed with.
 */
export async function createVapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  nowMs = Date.now(),
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const encoder = new TextEncoder();
  const header = toBase64Url(
    encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(nowMs / 1000) + 12 * 60 * 60,
        sub: keys.subject,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    keys.privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );

  return `vapid t=${signingInput}.${toBase64Url(
    new Uint8Array(signature),
  )}, k=${keys.publicKey}`;
}
