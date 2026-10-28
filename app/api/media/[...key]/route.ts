import { getCloudflareContext } from "@opennextjs/cloudflare";

const KEY_PATTERN = /^[a-zA-Z0-9/_-]+\.(?:avif|webp|jpe?g|png)$/;

/**
 * Serve product media from R2 with immutable caching.
 *
 * In production you may point a public R2 custom domain at the bucket for
 * lower latency; this route is the zero-config fallback and keeps CSP
 * same-origin (no third-party image host).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");
  if (!KEY_PATTERN.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  let bucket: R2Bucket | undefined;
  try {
    bucket = getCloudflareContext().env.MEDIA as R2Bucket | undefined;
  } catch {
    bucket = undefined;
  }
  if (!bucket) {
    return new Response("Media is not configured", { status: 404 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      ...(object.httpEtag ? { etag: object.httpEtag } : {}),
    },
  });
}
