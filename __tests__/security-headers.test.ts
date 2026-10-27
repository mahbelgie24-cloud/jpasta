import { describe, expect, it } from "vitest";
import { buildCsp, generateCspNonce } from "@/lib/csp-nonce";

describe("CSP builder (Phase 5 hardening)", () => {
  it("embeds the per-request nonce in script-src", () => {
    const nonce = generateCspNonce();
    const csp = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it("never allows unsafe-eval and locks framing/base down", () => {
    const csp = buildCsp(generateCspNonce());
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("keeps connect-src self-only (server actions + SSE)", () => {
    const csp = buildCsp(generateCspNonce());
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/connect-src[^\n;]*https?:\/\//);
  });

  it("nonces differ per request", () => {
    expect(generateCspNonce()).not.toBe(generateCspNonce());
  });
});
