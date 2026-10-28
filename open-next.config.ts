import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * OpenNext → Cloudflare Workers adapter (production recipe).
 *
 * - R2 incremental cache + regional cache: ISR/SSG survives isolates/colos
 * - DO queue: deduplicated time-based revalidation
 * - D1 tag cache: revalidateTag/revalidatePath actually propagate
 *
 * Required wrangler bindings (see wrangler.jsonc):
 *   NEXT_INC_CACHE_R2_BUCKET, NEXT_TAG_CACHE_D1, NEXT_CACHE_DO_QUEUE,
 *   WORKER_SELF_REFERENCE.
 *
 * KV is deliberately NOT used: it is eventually consistent, and a stale menu
 * after an owner edit is a money-visible bug.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
  }),
  queue: doQueue,
  tagCache: d1NextTagCache,
});
