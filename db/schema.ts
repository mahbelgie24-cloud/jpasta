/**
 * JPasta — Database Schema (Drizzle ORM / PostgreSQL).
 * Generated from docs/technical-spec.md §9, hardened in v2.
 *
 * Money convention (spec §6): every money column is an INTEGER in minor
 * units (agorot, 1 ₪ = 100). No numeric-as-string anywhere; no JS float
 * ever touches a price. Quantities that are genuinely fractional (recipe
 * grams, stock) use numeric(12,2) and are handled by lib/domain/qty.ts.
 *
 * v2 invariants enforced at the database boundary:
 *  - totals are arithmetically consistent (CHECK)
 *  - quantity, stock and fees are non-negative (CHECK)
 *  - every order status change is auditable (order_status_history)
 *  - idempotency is bound to the payload (payload_hash)
 *  - order numbers are gap-free per local day (order_counters)
 *  - PIN lookup is O(1) and unique (pin_lookup)
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  primaryKey,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const userRoleEnum = pgEnum("user_role", ["owner", "staff"]);

export const orderChannelEnum = pgEnum("order_channel", [
  "takeaway",
  "delivery",
  "dine_in",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "received",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
export const orderSourceEnum = pgEnum("order_source", [
  "storefront",
  "console",
  "whatsapp",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card_terminal",
  "cash_on_delivery",
]);
export const modifierTypeEnum = pgEnum("modifier_type", ["single", "multi"]);
export const inventoryReasonEnum = pgEnum("inventory_reason", [
  "sale",
  "purchase",
  "waste",
  "adjustment",
]);

// ---------- Identity & sessions ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("owner"),
    // scrypt with per-user salt — never the raw PIN (spec §8.5)
    pinHash: text("pin_hash").notNull(),
    // HMAC-SHA256(pin, AUTH_PEPPER): O(1) login lookup + DB-enforced
    // uniqueness. The hash is useless without the server pepper.
    pinLookup: varchar("pin_lookup", { length: 64 }).notNull(),
    // Bumped on PIN/role change → every existing session becomes invalid.
    sessionVersion: integer("session_version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("users_role_active_idx").on(t.role, t.isActive),
    uniqueIndex("users_pin_lookup_uidx").on(t.pinLookup),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // sha256 of the cookie token — a DB leak cannot mint sessions
    tokenHash: text("token_hash").notNull(),
    // Session version captured at login; compared against users.session_version.
    userVersion: integer("user_version").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uidx").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

/**
 * Failed-login throttle. Key = HMAC(ip + fingerprint) or a global key.
 * A row locks progressively (1m → 5m → 15m → 1h) and is cleared on success.
 */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    key: varchar("key", { length: 128 }).primaryKey(),
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check("login_attempts_failed_count_check", sql`${t.failedCount} >= 0`),
    index("login_attempts_locked_until_idx").on(t.lockedUntil),
  ],
);

// ---------- Catalog ----------
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    blurbAr: text("blurb_ar"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("categories_slug_uidx").on(t.slug),
    index("categories_sort_order_idx").on(t.sortOrder),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionAr: text("description_ar"),
    basePriceMinor: integer("base_price_minor").notNull(),
    // Illustration system inputs (brand.md §6) until real photos arrive
    sauce: text("sauce").notNull().default("golden"),
    toppings: jsonb("toppings").notNull().default([]),
    heat: integer("heat").notNull().default(0),
    badges: jsonb("badges").notNull().default([]),
    // Photo pipeline (R2). Null = the DishArt illustration is rendered.
    imageKey: text("image_key"),
    imageAlt: text("image_alt"),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    imageColor: varchar("image_color", { length: 9 }),
    isAvailable: boolean("is_available").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("products_slug_uidx").on(t.slug),
    index("products_category_available_idx").on(t.categoryId, t.isAvailable),
    check("products_base_price_check", sql`${t.basePriceMinor} >= 0`),
    check("products_heat_check", sql`${t.heat} between 0 and 3`),
  ],
);

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 32 }).notNull(), // size | heat | doneness | extras
    nameAr: text("name_ar").notNull(),
    type: modifierTypeEnum("type").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    maxSelections: integer("max_selections"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("modifier_groups_product_id_idx").on(t.productId),
    check(
      "modifier_groups_max_selections_check",
      sql`${t.maxSelections} is null or ${t.maxSelections} > 0`,
    ),
  ],
);

export const modifiers = pgTable(
  "modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 48 }).notNull(),
    nameAr: text("name_ar").notNull(),
    priceDeltaMinor: integer("price_delta_minor").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("modifiers_group_id_idx").on(t.groupId)],
);

// ---------- Orders ----------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Human-facing, gap-free per local day: JP-YYMMDD-NNN
    orderNumber: varchar("order_number", { length: 20 }).notNull(),
    // Replay guard (spec §9/§12): a retried submit can never duplicate a sale
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull(),
    // sha256 of the normalized payload — replaying with different contents
    // is rejected instead of silently returning someone else's order.
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    // Capability bearer for the public status page (P2-SEC-1 pattern)
    accessToken: uuid("access_token").notNull().defaultRandom(),
    channel: orderChannelEnum("channel").notNull(),
    status: orderStatusEnum("status").notNull().default("received"),
    source: orderSourceEnum("source").notNull().default("storefront"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    address: text("address"),
    zoneId: uuid("zone_id").references(() => deliveryZones.id, {
      onDelete: "set null",
    }),
    paymentMethod: paymentMethodEnum("payment_method")
      .notNull()
      .default("cash"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    customerNote: text("customer_note"),
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("orders_idempotency_key_uidx").on(t.idempotencyKey),
    uniqueIndex("orders_order_number_uidx").on(t.orderNumber),
    uniqueIndex("orders_access_token_uidx").on(t.accessToken),
    index("orders_status_created_at_idx").on(t.status, t.createdAt),
    index("orders_created_at_idx").on(t.createdAt),
    index("orders_zone_id_idx").on(t.zoneId),
    check(
      "orders_amounts_non_negative_check",
      sql`${t.subtotalMinor} >= 0 and ${t.deliveryFeeMinor} >= 0`,
    ),
    check(
      "orders_total_check",
      sql`${t.totalMinor} = ${t.subtotalMinor} + ${t.deliveryFeeMinor}`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // Snapshots — the order stays reconstructable even if the menu changes
    nameAr: text("name_ar").notNull(),
    detailAr: text("detail_ar"),
    note: text("note"),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    check("order_items_quantity_check", sql`${t.quantity} > 0`),
    check(
      "order_items_amounts_check",
      sql`${t.unitPriceMinor} >= 0 and ${t.lineTotalMinor} = ${t.unitPriceMinor} * ${t.quantity}`,
    ),
  ],
);

/**
 * Every status transition, including creation (from_status = null).
 * Cancellations must carry a reason; undo transitions are recorded too.
 */
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("order_status_history_order_id_idx").on(t.orderId),
    index("order_status_history_created_at_idx").on(t.createdAt),
  ],
);

/**
 * Gap-free daily order numbers. The upsert runs inside the order
 * transaction: INSERT … ON CONFLICT … RETURNING last_number.
 */
export const orderCounters = pgTable(
  "order_counters",
  {
    day: date("day").primaryKey(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [check("order_counters_last_number_check", sql`${t.lastNumber} >= 0`)],
);

// ---------- Delivery ----------
export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nameAr: text("name_ar").notNull(),
    feeMinor: integer("fee_minor").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    check("delivery_zones_fee_check", sql`${t.feeMinor} >= 0`),
    index("delivery_zones_active_sort_idx").on(t.isActive, t.sortOrder),
  ],
);

// ---------- Settings ----------
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ---------- Inventory (Phase 4 — schema ready, data-gated) ----------
export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    currentStock: numeric("current_stock", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    reorderThreshold: numeric("reorder_threshold", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    costPerUnitMinor: integer("cost_per_unit_minor").notNull().default(0),
  },
  (t) => [
    check("ingredients_stock_check", sql`${t.currentStock} >= 0`),
    check("ingredients_reorder_check", sql`${t.reorderThreshold} >= 0`),
    check("ingredients_cost_check", sql`${t.costPerUnitMinor} >= 0`),
  ],
);

export const recipes = pgTable(
  "recipes",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    quantityUsed: numeric("quantity_used", {
      precision: 12,
      scale: 2,
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.ingredientId] }),
    index("recipes_ingredient_id_idx").on(t.ingredientId),
    check("recipes_quantity_check", sql`${t.quantityUsed} > 0`),
  ],
);

export const inventoryMoves = pgTable(
  "inventory_moves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    deltaQty: numeric("delta_qty", { precision: 12, scale: 2 }).notNull(),
    reason: inventoryReasonEnum("reason").notNull(),
    refOrderId: uuid("ref_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("inventory_moves_ingredient_id_idx").on(t.ingredientId),
    index("inventory_moves_created_at_idx").on(t.createdAt),
    index("inventory_moves_ref_order_id_idx").on(t.refOrderId),
  ],
);

// Every price change leaves an audit row (spec §9)
export const priceChanges = pgTable(
  "price_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    oldMinor: integer("old_minor").notNull(),
    newMinor: integer("new_minor").notNull(),
    changedBy: uuid("changed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("price_changes_entity_id_idx").on(t.entityId),
    index("price_changes_created_at_idx").on(t.createdAt),
    index("price_changes_changed_by_idx").on(t.changedBy),
  ],
);

// Optional durable Web Push subscriptions for the owner console.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uidx").on(t.endpoint),
    index("push_subscriptions_user_id_idx").on(t.userId),
  ],
);
