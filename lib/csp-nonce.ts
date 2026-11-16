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

/**
 * Violation reporting: without it, CSP enforcement is blind — a blocked
 * injection attempt is invisible. Reports POST to /api/csp-report, which
 * logs directive/host pairs only (never full URLs — document URIs carry the
 * order-status capability token in their query string).
 */
export const CSP_REPORT_URI = "/api/csp-report";

/**
 * Reporting-Endpoints takes a Structured Fields dictionary, NOT JSON — a
 * JSON body fails sf-dictionary parsing and Chrome drops the group silently.
 * While the policy carries a `report-to` directive, CSP3 skips report-uri
 * entirely, so this header being malformed would blind Chrome (the majority
 * browser) while Firefox/Safari kept working — the worst possible split.
 */
export function reportingEndpointsHeader(): string {
  return `csp-endpoint="${CSP_REPORT_URI}"`;
}

/** Legacy JSON header for browsers that only implement Report-To. */
export function reportToHeader(): string {
  return JSON.stringify({
    group: "csp-endpoint",
    max_age: 10886400,
    endpoints: [{ url: CSP_REPORT_URI }],
  });
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

/**
 * `upgrade-insecure-requests` protects HTTPS pages from mixed content, and
 * production is HTTPS-only — so it ships there. On an HTTP page (local
 * `next start`, E2E) WebKit applies it even to 127.0.0.1 and upgrades the
 * same-origin JS chunks to a TLS port the dev server does not speak: every
 * chunk request fails, hydration never runs, and React is dead (the
 * cross-browser smoke gate caught this — Chromium/Firefox exempt localhost,
 * webkit does not). HTTP pages omit the directive; unknown origins keep the
 * secure default.
 */
function upgradeDirective(origin?: string): string {
  if (!origin) return "upgrade-insecure-requests";
  try {
    return new URL(origin).protocol === "https:"
      ? "upgrade-insecure-requests"
      : "";
  } catch {
    return "upgrade-insecure-requests";
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
    `report-uri ${CSP_REPORT_URI}`,
    "report-to csp-endpoint",
    upgradeDirective(origin),
  ]
    .filter(Boolean)
    .join("; ");
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
    `report-uri ${CSP_REPORT_URI}`,
    "report-to csp-endpoint",
    upgradeDirective(origin),
  ]
    .filter(Boolean)
    .join("; ");
}
