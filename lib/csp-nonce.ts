import "server-only";

/**
 * CSP builder (Phase 5 hardening, OWASP ASVS 5.0 V14.4). A per-request
 * nonce + strict-dynamic replaces script allowlisting; the documented
 * relaxations (style-src inline for Tailwind attributes, img data:) mirror
 * the security decisions recorded for the Ayasofia platform (D5).
 */

export function generateCspNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function wsOrigin(origin?: string): string {
  if (!origin) return "wss:";
  try {
    const url = new URL(origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return "wss:";
  }
}

export function buildCsp(nonce: string, origin?: string): string {
  // React needs eval() for its development debugging features; production
  // never does. Keep the relaxation strictly scoped to `next dev`.
  const devEval =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src 'self' ${wsOrigin(origin)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Static (prerendered) routes cannot carry a per-request nonce. Their inline
 * flight payload requires 'unsafe-inline'; emitted scripts are pinned by SRI
 * (experimental.sri). Keep this tier as small as possible.
 */
export function buildStaticCsp(origin?: string): string {
  const devEval =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src 'self' ${wsOrigin(origin)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
