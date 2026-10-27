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

export function buildCsp(nonce: string): string {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  return csp;
}
