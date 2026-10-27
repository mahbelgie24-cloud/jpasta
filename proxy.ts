import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateCspNonce } from "@/lib/csp-nonce";

/**
 * Proxy (Next 16 — formerly Middleware). UX/headers layer only; it never
 * replaces server-side authorization (AGENTS.md). Sets a per-request CSP
 * nonce: Next.js picks the CSP header up automatically and nonces its own
 * bootstrap scripts.
 */
export function proxy(request: NextRequest) {
  const nonce = generateCspNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // everything except static assets (Next static, images, fonts, icons)
    "/((?!_next/static|_next/image|favicon.ico|brand/|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
