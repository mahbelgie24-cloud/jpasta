import { describe, expect, it } from "vitest";
import { buildCsp, buildStaticCsp, generateCspNonce } from "@/lib/csp-nonce";
import { serializeJsonLd } from "@/lib/json-ld";

describe("CSP builder (v2 hardening)", () => {
  it("embeds the per-request nonce in script-src", () => {
    const nonce = generateCspNonce();
    const csp = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("never allows unsafe-eval and locks framing/base down", () => {
    const csp = buildCsp(generateCspNonce());
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("allows only same-origin HTTP + same-origin WebSocket", () => {
    const csp = buildCsp(generateCspNonce(), "https://jpasta.ps");
    expect(csp).toContain("connect-src 'self' wss://jpasta.ps");
    expect(csp).not.toMatch(/connect-src[^\n;]*https?:\/\//);
  });

  it("keeps the static tier free of external hosts", () => {
    const csp = buildStaticCsp("https://jpasta.ps");
    expect(csp).toContain("connect-src 'self' wss://jpasta.ps");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("nonces differ per request", () => {
    expect(generateCspNonce()).not.toBe(generateCspNonce());
  });
});

describe("JSON-LD serialization (stored-XSS hardening)", () => {
  it("cannot break out of the script element", () => {
    const payload = { name: "</script><img src=x onerror=alert(1)>" };
    const out = serializeJsonLd(payload);
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script\\u003e");
    // Still valid JSON with the original value.
    expect(JSON.parse(out)).toEqual(payload);
  });
});
