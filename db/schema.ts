/**
 * JPasta — Database Schema (Drizzle ORM / PostgreSQL).
 * Generated from docs/technical-spec.md §9.
 *
 * Money convention (spec §6): every money column is an INTEGER in minor
 * units (agorot, 1 ₪ = 100). No numeric-as-string anywhere; no JS float
 * ever touches a price. Quantities that are genuinely fractional (recipe
 * grams, stock) use numeric(12,2) and stay out of the money path.
 */
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
  jsonb,
  index,
  uniqueIndex,
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
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("users_role_active_idx").on(t.role, t.isActive)],
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
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uidx").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
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
      .references(() => categories.id),
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
    isAvailable: boolean("is_available").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("products_slug_uidx").on(t.slug),
    index("products_category_available_idx").on(t.categoryId, t.isAvailable),
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
  (t) => [index("modifier_groups_product_id_idx").on(t.productId)],
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
    orderNumber: varchar("order_number", { length: 20 }).notNull(),
    // Replay guard (spec §9/§12): a retried submit can never duplicate a sale
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull(),
    // Capability bearer for the public status page (P2-SEC-1 pattern)
    accessToken: uuid("access_token").notNull().defaultRandom(),
    channel: orderChannelEnum("channel").notNull(),
    status: orderStatusEnum("status").notNull().default("received"),
    source: orderSourceEnum("source").notNull().default("storefront"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    address: text("address"),
    paymentMethod: paymentMethodEnum("payment_method")
      .notNull()
      .default("cash"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    customerNote: text("customer_note"),
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
    index("orders_status_created_at_idx").on(t.status, t.createdAt),
    index("orders_created_at_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    // Snapshots — the order stays reconstructable even if the menu changes
    nameAr: text("name_ar").notNull(),
    detailAr: text("detail_ar"),
    note: text("note"),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
  },
  (t) => [index("order_items_order_id_idx").on(t.orderId)],
);

// ---------- Delivery ----------
export const deliveryZones = pgTable("delivery_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  feeMinor: integer("fee_minor").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// ---------- Settings ----------
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ---------- Inventory (Phase 4 — schema ready, data-gated) ----------
export const ingredients = pgTable("ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  currentStock: numeric("current_stock", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  reorderThreshold: numeric("reorder_threshold", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  costPerUnitMinor: integer("cost_per_unit_minor").notNull().default(0),
});

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
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("inventory_moves_ingredient_id_idx").on(t.ingredientId),
    index("inventory_moves_created_at_idx").on(t.createdAt),
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
  ],
);
