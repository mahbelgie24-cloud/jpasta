import { describe, expect, it } from "vitest";
import {
  buildCsp,
  buildStaticCsp,
  generateCspNonce,
  reportToHeader,
  reportingEndpointsHeader,
} from "@/lib/csp-nonce";
import { serializeJsonLd } from "@/lib/json-ld";

describe("CSP builder (v2 hardening)", () => {
  it("embeds the per-request nonce in script-src", () => {
    const nonce = generateCspNonce();
    const csp = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("reports violations to the same-origin sink on both tiers", () => {
    for (const csp of [buildCsp(generateCspNonce()), buildStaticCsp()]) {
      expect(csp).toContain("report-uri /api/csp-report");
      expect(csp).toContain("report-to csp-endpoint");
    }
    // Reporting-Endpoints is a Structured Fields dictionary — JSON here
    // fails sf-dictionary parsing and Chrome drops the group silently.
    expect(reportingEndpointsHeader()).toBe('csp-endpoint="/api/csp-report"');
    // The legacy JSON header carries the same relative endpoint.
    expect(reportToHeader()).toContain("/api/csp-report");
    expect(reportToHeader()).not.toContain("https://");
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

  it("scopes upgrade-insecure-requests to HTTPS origins", () => {
    // WebKit applies the directive even on 127.0.0.1 over HTTP: the
    // same-origin chunks get upgraded to a TLS port the dev server does not
    // speak, hydration dies, and React never runs. Production (HTTPS-only)
    // keeps the directive; unknown origins keep the secure default.
    expect(
      buildCsp(generateCspNonce(), "https://jpasta.ascendly.space"),
    ).toContain("upgrade-insecure-requests");
    expect(buildCsp(generateCspNonce(), "http://127.0.0.1:3220")).not.toContain(
      "upgrade-insecure-requests",
    );
    // Both tiers must keep the directive on https origins — deleting it from
    // the static tier alone would otherwise slip past the http-only checks.
    expect(buildStaticCsp("https://jpasta.ascendly.space")).toContain(
      "upgrade-insecure-requests",
    );
    expect(buildStaticCsp("http://127.0.0.1:3220")).not.toContain(
      "upgrade-insecure-requests",
    );
    expect(buildCsp(generateCspNonce())).toContain("upgrade-insecure-requests");
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
