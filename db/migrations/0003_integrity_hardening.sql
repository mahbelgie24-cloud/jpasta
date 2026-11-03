-- 0003 — Integrity hardening
--
-- 1. Deduplicate factory keys BEFORE the new UNIQUE indexes. Pricing
--    resolves a chosen option with `.find(o => o.key === key)`; a duplicate
--    key silently priced the first match and dropped the rest.
-- 2. Replace legacy payload hashes with an explicit sentinel. Legacy rows
--    are never replayable (assertReplayMatches requires exact equality).
-- 3. Repair the daily counters from the actual order numbers, not count(*):
--    deleting an order used to make the next number collide.
-- 4. Add CHECK constraints so the database, not only the app, enforces the
--    cancellation reason, the order-number shape, and the payload hash.
-- 5. Replace single-column indexes with the composite shapes the queries
--    actually use, and fix two cascade rules.

-- ---------------------------------------------------------------------------
-- 1. Deduplicate modifier keys (keep the lowest sort_order, id as tie-break)
-- ---------------------------------------------------------------------------
DELETE FROM "modifier_groups" a
USING "modifier_groups" b
WHERE a."product_id" = b."product_id"
  AND a."key" = b."key"
  AND (
    a."sort_order" > b."sort_order"
    OR (a."sort_order" = b."sort_order" AND a."id" > b."id")
  );--> statement-breakpoint

DELETE FROM "modifiers" a
USING "modifiers" b
WHERE a."group_id" = b."group_id"
  AND a."key" = b."key"
  AND (
    a."sort_order" > b."sort_order"
    OR (a."sort_order" = b."sort_order" AND a."id" > b."id")
  );--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Legacy rows: explicit, non-replayable sentinels
-- ---------------------------------------------------------------------------
UPDATE "orders"
SET "payload_hash" = 'legacy:' || "id"::text
WHERE "payload_hash" IS NULL OR "payload_hash" = '';--> statement-breakpoint

UPDATE "orders"
SET "cancelled_reason" = 'legacy'
WHERE "status" = 'cancelled'
  AND ("cancelled_reason" IS NULL OR length(trim("cancelled_reason")) < 2);--> statement-breakpoint

ALTER TABLE "inventory_moves" DROP CONSTRAINT "inventory_moves_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "price_changes" DROP CONSTRAINT "price_changes_changed_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "inventory_moves_ingredient_id_idx";--> statement-breakpoint
DROP INDEX "order_status_history_order_id_idx";--> statement-breakpoint
DROP INDEX "price_changes_entity_id_idx";--> statement-breakpoint
DROP INDEX "login_attempts_locked_until_idx";--> statement-breakpoint
ALTER TABLE "inventory_moves" ADD CONSTRAINT "inventory_moves_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_active_sort_idx" ON "categories" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "inventory_moves_ingredient_created_idx" ON "inventory_moves" USING btree ("ingredient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "modifier_groups_product_key_uidx" ON "modifier_groups" USING btree ("product_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "modifiers_group_key_uidx" ON "modifiers" USING btree ("group_id","key");--> statement-breakpoint
CREATE INDEX "order_status_history_order_created_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "price_changes_entity_idx" ON "price_changes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "products_available_sort_idx" ON "products" USING btree ("is_available","sort_order");--> statement-breakpoint
CREATE INDEX "login_attempts_locked_until_idx" ON "login_attempts" USING btree ("locked_until") WHERE "login_attempts"."locked_until" is not null;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Counter repair: max suffix per local day, not count(*)
-- ---------------------------------------------------------------------------
INSERT INTO "order_counters" ("day", "last_number")
SELECT
  ("created_at" AT TIME ZONE 'Asia/Hebron')::date,
  max(split_part("order_number", '-', 3)::int)
FROM "orders"
WHERE "order_number" ~ '^JP-[0-9]{6}-[0-9]+$'
GROUP BY 1
ON CONFLICT ("day") DO UPDATE
SET "last_number" = GREATEST("order_counters"."last_number", EXCLUDED."last_number");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. CHECK constraints
-- ---------------------------------------------------------------------------
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_check" CHECK ("orders"."order_number" ~ '^JP-[0-9]{6}-[0-9]{3,}$');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payload_hash_check" CHECK ("orders"."payload_hash" ~ '^[0-9a-f]{64}$' or "orders"."payload_hash" like 'legacy:%');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancel_reason_check" CHECK ("orders"."status" <> 'cancelled' or ("orders"."cancelled_reason" is not null and length(trim("orders"."cancelled_reason")) >= 2));
