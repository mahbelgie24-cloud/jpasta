/**
 * Next.js instrumentation hook.
 *
 * `onRequestError` catches unhandled server render/action/route errors and
 * emits one structured JSON line — the same shape as lib/server/log.ts —
 * so Workers Logs/Logpush can alert on real production failures. It never
 * includes request bodies or customer PII.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: {
    routerKind?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
  },
): Promise<void> {
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : undefined;

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      event: "server.request_error",
      path: request.path,
      method: request.method,
      router: context.routerKind,
      route: context.routePath,
      type: context.routeType,
      render: context.renderSource,
      message: error instanceof Error ? error.message : "unknown",
      digest,
    }),
  );
}
