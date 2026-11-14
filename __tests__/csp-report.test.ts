import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The CSP sink must actually capture real browser payloads — this is the
 * test that was missing when the sink first shipped blind to Chrome (the
 * modern Reporting envelope carries camelCase keys inside `body`, and
 * Reporting-Endpoints is a Structured Fields dictionary, not JSON).
 */

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
  warnSpy.mockClear();
});

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/csp-report/route");
  return POST(
    new Request("https://jpasta.test/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: JSON.stringify(body),
    }),
  );
}

function lastLoggedFields(): Record<string, unknown> | null {
  const calls = warnSpy.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) return null;
  const line = last[0];
  return typeof line === "string"
    ? (JSON.parse(line) as Record<string, unknown>)
    : null;
}

describe("CSP report sink", () => {
  it("captures the modern Reporting API envelope (Chrome/Edge)", async () => {
    const res = await post([
      {
        type: "csp-violation",
        url: "https://jpasta.test/menu",
        body: {
          documentURL: "https://jpasta.test/order/status/abc?t=secret-token",
          effectiveDirective: "script-src-elem",
          blockedURL: "inline",
          sourceFile: "https://evil.test/inject.js",
          lineNumber: 12,
        },
      },
    ]);
    expect(res.status).toBe(204);

    const fields = lastLoggedFields();
    expect(fields?.event).toBe("csp.violation");
    expect(fields?.directive).toBe("script-src-elem");
    // Host only — the capability token in the query string never reaches the log.
    expect(fields?.document).toBe("jpasta.test");
    expect(fields?.blocked).toBe("inline");
    expect(fields?.source).toBe("evil.test");
    expect(fields?.line).toBe(12);
    expect(JSON.stringify(fields)).not.toContain("secret-token");
  });

  it("captures the legacy report-uri envelope (Firefox/Safari)", async () => {
    const res = await post({
      "csp-report": {
        "document-uri": "https://jpasta.test/menu",
        "effective-directive": "style-src-elem",
        "blocked-uri": "https://cdn.evil.test/x.css",
        "source-file": "https://jpasta.test/menu",
        "line-number": 3,
      },
    });
    expect(res.status).toBe(204);

    const fields = lastLoggedFields();
    expect(fields?.directive).toBe("style-src-elem");
    expect(fields?.blocked).toBe("cdn.evil.test");
    expect(fields?.line).toBe(3);
  });

  it("enforces the body cap and the array cap", async () => {
    // >4096 bytes of actual payload (undici strips hand-set content-length
    // headers — the route measures the real bytes it received).
    const oversized = await post({
      "csp-report": { "effective-directive": "x".repeat(5000) },
    });
    expect(oversized.status).toBe(413);

    const warnBefore = warnSpy.mock.calls.length;
    const flooded = Array.from({ length: 12 }, (_, i) => ({
      type: "csp-violation",
      body: { effectiveDirective: `dir-${i}` },
    }));
    const res = await post(flooded);
    expect(res.status).toBe(204);
    // At most 5 reports logged for one request.
    expect(warnSpy.mock.calls.length - warnBefore).toBeLessThanOrEqual(5);
  });
});
