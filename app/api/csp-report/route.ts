import { logEvent } from "@/lib/server/log";

export const dynamic = "force-dynamic";

/**
 * CSP violation sink. Two wire formats arrive here:
 *  - report-uri (Firefox/Safari): {"csp-report":{…}} with kebab-case keys.
 *  - report-to (Chrome/Edge, modern Reporting API): [{type, body:{…}}] with
 *    camelCase keys inside `body`.
 * Rules for the sink:
 *  - Never persist a full URL: document-uri on /order/status carries the
 *    capability token in its query string. Only directive + blocked host +
 *    source file/line are logged.
 *  - No auth (browser-initiated, no credentials available) — so it writes
 *    nothing but bounded log lines: fixed body cap, array cap, field cap.
 *  - content-length is enforced when present (browsers always send it); a
 *    lying/streamed header can still buffer in request.json() — the array
 *    and field caps below bound the log cost either way.
 */

const MAX_BODY_BYTES = 4096;
const MAX_REPORTS = 5;
const MAX_FIELD = 128;

function hostOnly(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const clipped = value.slice(0, MAX_FIELD);
  try {
    return new URL(clipped).host || null;
  } catch {
    return clipped.startsWith("inline") || clipped === "eval" ? clipped : null;
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, MAX_FIELD)
    : null;
}

/** Read a field in both wire spellings (modern camelCase, legacy kebab). */
function pick(report: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (report[key] !== undefined) return report[key];
  }
  return undefined;
}

export async function POST(request: Request) {
  // Own key class on the shared READ_LIMIT binding: a misbehaving page must
  // not be able to flood the log with violation reports.
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const binding = (
      getCloudflareContext().env as {
        READ_LIMIT?: { limit(key: string): Promise<{ success: boolean }> };
      }
    ).READ_LIMIT;
    if (binding) {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await binding.limit(`csp:${ip}`)).success) {
        return new Response(null, { status: 429 });
      }
    }
  } catch {
    // Node runtime (local dev/tests) — no edge binding by design.
  }

  // Fast path: an honest content-length over the cap is rejected without a
  // parse. The header is client-controlled though, so the ACTUAL payload is
  // measured below before anything is logged.
  const rawLength = request.headers.get("content-length");
  const declared = rawLength === null ? Number.NaN : Number(rawLength);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  // Malformed JSON is a broken client, not an error worth a 500 — reports
  // are best-effort telemetry.
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }

  // Normalize both wire formats to the inner report object.
  const reports = Array.isArray(body)
    ? body.map((item) =>
        item && typeof item === "object" && "body" in item
          ? (item as { body: unknown }).body
          : item,
      )
    : body !== null &&
        typeof body === "object" &&
        "csp-report" in (body as Record<string, unknown>)
      ? [(body as Record<string, unknown>)["csp-report"]]
      : [];

  for (const report of reports.slice(0, MAX_REPORTS)) {
    if (report === null || typeof report !== "object") continue;
    const r = report as Record<string, unknown>;
    logEvent("warn", "csp.violation", {
      directive:
        text(pick(r, "effectiveDirective", "effective-directive")) ??
        text(pick(r, "violatedDirective", "violated-directive")) ??
        "unknown",
      blocked: hostOnly(pick(r, "blockedURL", "blocked-uri")),
      source: hostOnly(pick(r, "sourceFile", "source-file")),
      line: (() => {
        const line = pick(r, "lineNumber", "line-number");
        return typeof line === "number" && Number.isFinite(line) ? line : null;
      })(),
      // Host only — the disposition never carries query strings.
      document: hostOnly(pick(r, "documentURL", "document-uri")),
    });
  }

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
