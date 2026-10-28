-- 0002 — JPasta v2 hardening
-- Safe to run against the existing Phase 0–5 database: every new NOT NULL
-- column is backfilled first, and legacy data is normalised before the new
-- CHECK constraints are attached.

-- ---------------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------------
CREATE TABLE "login_attempts" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_failed_count_check" CHECK ("login_attempts"."failed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"day" date PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_counters_last_number_check" CHECK ("order_counters"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. New columns (nullable while we backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE "delivery_zones" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_moves" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payload_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "zone_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_color" varchar(9);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_lookup" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Backfill legacy rows
-- ---------------------------------------------------------------------------
-- Legacy orders predate payload binding. Empty means "legacy: skip the
-- payload comparison" in lib/server/orders.ts.
UPDATE "orders" SET "payload_hash" = '' WHERE "payload_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payload_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payload_hash" SET DEFAULT '';--> statement-breakpoint

-- Legacy PIN lookup: a unique placeholder. Login falls back to scanning
-- legacy rows, verifies the scrypt hash, then upgrades the row to the real
-- HMAC lookup on the first successful login.
UPDATE "users"
SET "pin_lookup" = 'legacy:' || replace("id"::text, '-', '')
WHERE "pin_lookup" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "pin_lookup" SET NOT NULL;--> statement-breakpoint

-- Gap-free daily counters: seed each existing day with its order count.
INSERT INTO "order_counters" ("day", "last_number")
SELECT ("created_at" AT TIME ZONE 'Asia/Hebron')::date, count(*)
FROM "orders"
GROUP BY 1
ON CONFLICT ("day") DO UPDATE
SET "last_number" = GREATEST("order_counters"."last_number", EXCLUDED."last_number");--> statement-breakpoint

-- Normalise anything the new CHECK constraints would reject.
UPDATE "ingredients" SET "current_stock" = 0 WHERE "current_stock" < 0;--> statement-breakpoint
UPDATE "ingredients" SET "reorder_threshold" = 0 WHERE "reorder_threshold" < 0;--> statement-breakpoint
UPDATE "ingredients" SET "cost_per_unit_minor" = 0 WHERE "cost_per_unit_minor" < 0;--> statement-breakpoint
UPDATE "products" SET "base_price_minor" = 0 WHERE "base_price_minor" < 0;--> statement-breakpoint
UPDATE "products" SET "heat" = 0 WHERE "heat" < 0 OR "heat" > 3;--> statement-breakpoint
UPDATE "delivery_zones" SET "fee_minor" = 0 WHERE "fee_minor" < 0;--> statement-breakpoint
DELETE FROM "recipes" WHERE "quantity_used" <= 0;--> statement-breakpoint
UPDATE "order_items" SET "quantity" = 1 WHERE "quantity" <= 0;--> statement-breakpoint
UPDATE "order_items"
SET "line_total_minor" = "unit_price_minor" * "quantity"
WHERE "line_total_minor" <> "unit_price_minor" * "quantity";--> statement-breakpoint
UPDATE "orders"
SET "subtotal_minor" = GREATEST("subtotal_minor", 0),
    "delivery_fee_minor" = GREATEST("delivery_fee_minor", 0);--> statement-breakpoint
UPDATE "orders"
SET "total_minor" = "subtotal_minor" + "delivery_fee_minor"
WHERE "total_minor" <> "subtotal_minor" + "delivery_fee_minor";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_moves" ADD CONSTRAINT "inventory_moves_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_categories_id_fk";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX "login_attempts_locked_until_idx" ON "login_attempts" USING btree ("locked_until");--> statement-breakpoint
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_created_at_idx" ON "order_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_uidx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_zones_active_sort_idx" ON "delivery_zones" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "inventory_moves_ref_order_id_idx" ON "inventory_moves" USING btree ("ref_order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_access_token_uidx" ON "orders" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "orders_zone_id_idx" ON "orders" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "price_changes_changed_by_idx" ON "price_changes" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_pin_lookup_uidx" ON "users" USING btree ("pin_lookup");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. CHECK constraints
-- ---------------------------------------------------------------------------
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_fee_check" CHECK ("delivery_zones"."fee_minor" >= 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_stock_check" CHECK ("ingredients"."current_stock" >= 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_reorder_check" CHECK ("ingredients"."reorder_threshold" >= 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_cost_check" CHECK ("ingredients"."cost_per_unit_minor" >= 0);--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_max_selections_check" CHECK ("modifier_groups"."max_selections" is null or "modifier_groups"."max_selections" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amounts_check" CHECK ("order_items"."unit_price_minor" >= 0 and "order_items"."line_total_minor" = "order_items"."unit_price_minor" * "order_items"."quantity");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative_check" CHECK ("orders"."subtotal_minor" >= 0 and "orders"."delivery_fee_minor" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("orders"."total_minor" = "orders"."subtotal_minor" + "orders"."delivery_fee_minor");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_base_price_check" CHECK ("products"."base_price_minor" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_heat_check" CHECK ("products"."heat" between 0 and 3);--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_quantity_check" CHECK ("recipes"."quantity_used" > 0);
