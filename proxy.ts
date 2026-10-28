import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, buildStaticCsp, generateCspNonce } from "@/lib/csp-nonce";

/**
 * Proxy (Next 16 — formerly Middleware). UX/headers layer only; it never
 * replaces server-side authorization (AGENTS.md).
 *
 * CSP is tiered by route class (docs/ARCHITECTURE.md §7 Security):
 * - DYNAMIC routes (console, order status, api): per-request nonce +
 *   strict-dynamic — Next nonces its bootstrap scripts at render time.
 * - STATIC routes (/, /menu, /privacy): prerendered HTML cannot carry
 *   per-request nonces (Next docs §"Static vs Dynamic Rendering with CSP")
 *   — script-src allows same-origin + the build-time inline flight payload,
 *   and external scripts carry SRI integrity attributes
 *   (experimental.sri in next.config.ts).
 */
const DYNAMIC_CSP_PREFIXES = ["/console", "/order", "/api"];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Optimistic auth redirect for the console. This is a UX optimisation, not
  // the authorization boundary — every action/page still verifies the session.
  const sessionCookie =
    request.cookies.get("__Host-jpasta_session")?.value ??
    request.cookies.get("jpasta_session")?.value;
  if (
    sessionCookie === undefined &&
    path.startsWith("/console") &&
    path !== "/console/login"
  ) {
    const login = request.nextUrl.clone();
    login.pathname = "/console/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  const isDynamicRoute = DYNAMIC_CSP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  const origin = request.nextUrl.origin;
  const csp = isDynamicRoute
    ? buildCsp(generateCspNonce(), origin)
    : buildStaticCsp(origin);

  const requestHeaders = new Headers(request.headers);
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
