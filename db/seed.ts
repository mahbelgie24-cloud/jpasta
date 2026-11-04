/**
 * Seed — demo-safe.
 *
 * Modes:
 *   npm run db:seed              first provision (aborts if the catalog exists)
 *   npm run db:seed -- --force   DEV ONLY: reset the catalog AND orders
 *   npm run db:seed -- --catalog replace only the catalog; orders, settings,
 *                                zones and the owner account stay untouched
 *   npm run db:seed -- --provision settings/zone/owner only (deploy gate)
 *
 * Loads the catalog from lib/menu-data.ts, provisions the delivery zone,
 * settings, and the owner account from JPASTA_OWNER_PIN (spec §8.5).
 */
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { CATEGORIES, PRODUCTS } from "../lib/menu-data";
import { hashPin, pinLookup } from "../lib/server/pin";
import {
  categories,
  deliveryZones,
  modifierGroups,
  modifiers,
  products,
  settings,
  users,
} from "./schema";

// Minimal .env.local loader (no dependency). CI provides env vars directly.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    const key = m?.[1];
    const value = m?.[2];
    if (key && value !== undefined && !process.env[key])
      process.env[key] = value.trim();
  }
} catch {
  // No .env.local (CI / production shell) — process.env is authoritative.
}

const force = process.argv.includes("--force");
const provisionOnly = process.argv.includes("--provision");
const catalogOnly = process.argv.includes("--catalog");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "✗ DATABASE_URL is required (set it in .env.local or the shell).",
  );
  process.exit(1);
}

let databaseHost = "";
try {
  databaseHost = new URL(databaseUrl).hostname;
} catch {
  console.error("✗ DATABASE_URL is not a valid connection URL.");
  process.exit(1);
}
const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
  databaseHost,
);

if (force && process.env.NODE_ENV === "production") {
  console.error(
    "✗ Refusing to run `db:seed --force` with NODE_ENV=production — it TRUNCATEs orders.",
  );
  process.exit(1);
}
// NODE_ENV is not set by the deploy workflow; the host is the reliable guard.
if (force && !isLoopback && process.env.ALLOW_DESTRUCTIVE_SEED !== "1") {
  console.error(
    `✗ Refusing to run \`db:seed --force\` against non-local host "${databaseHost}". ` +
      "It TRUNCATEs orders. Set ALLOW_DESTRUCTIVE_SEED=1 only if this is intentional.",
  );
  process.exit(1);
}
if (catalogOnly && (force || provisionOnly)) {
  console.error("✗ Use only one of --catalog, --force or --provision.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Inserts the full catalog from lib/menu-data.ts. Returns the product count. */
async function seedCatalog(tx: Tx): Promise<number> {
  const catIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await tx
      .insert(categories)
      .values({
        slug: c.slug,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        blurbAr: c.blurbAr,
        sortOrder: i,
      })
      .returning({ id: categories.id });
    if (!row) throw new Error(`category ${c.slug} insert failed`);
    catIds.set(c.slug, row.id);
  }

  let productCount = 0;
  for (const [i, p] of PRODUCTS.entries()) {
    const categoryId = catIds.get(p.categorySlug);
    if (!categoryId) throw new Error(`missing category ${p.categorySlug}`);

    const [prod] = await tx
      .insert(products)
      .values({
        categoryId,
        slug: p.slug,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descriptionAr: p.descAr,
        basePriceMinor: p.basePriceMinor,
        sauce: p.sauce,
        toppings: p.toppings,
        heat: p.heat,
        badges: p.badges,
        isFeatured: p.featured ?? false,
        sortOrder: i,
      })
      .returning({ id: products.id });
    if (!prod) throw new Error(`product ${p.slug} insert failed`);
    productCount += 1;

    for (const [gi, g] of p.groups.entries()) {
      const [grp] = await tx
        .insert(modifierGroups)
        .values({
          productId: prod.id,
          key: g.id,
          nameAr: g.nameAr,
          type: g.type,
          isRequired: g.required,
          maxSelections: g.maxSelections ?? null,
          sortOrder: gi,
        })
        .returning({ id: modifierGroups.id });
      if (!grp) throw new Error(`group ${g.id} insert failed`);
      await tx.insert(modifiers).values(
        g.options.map((o, oi) => ({
          groupId: grp.id,
          key: o.id,
          nameAr: o.nameAr,
          priceDeltaMinor: o.priceMinor,
          sortOrder: oi,
        })),
      );
    }
  }

  return productCount;
}

async function main() {
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products);
  const count = existing[0]?.n ?? 0;

  if (!provisionOnly && !catalogOnly && count > 0 && !force) {
    console.error(
      `✗ Catalog already exists (${count} products). Use --force to reset it, or --catalog to replace just the menu.`,
    );
    process.exit(1);
  }

  // Replace only the catalog, atomically. order_items.product_id becomes NULL
  // (ON DELETE set null) so historical orders keep their name/price snapshots;
  // orders, settings, zones, users and inventory ingredients are untouched.
  if (catalogOnly) {
    const productCount = await db.transaction(async (tx) => {
      await tx.delete(modifierGroups);
      await tx.delete(products);
      await tx.delete(categories);
      return seedCatalog(tx);
    });
    console.log(
      `✓ catalog replaced: ${productCount} products, ${CATEGORIES.length} categories (orders/settings/owner untouched)`,
    );
    return;
  }

  if (!provisionOnly && count > 0 && force) {
    await db.execute(
      sql`TRUNCATE order_items, orders, modifier_groups, modifiers, products, categories CASCADE`,
    );
    console.log("↺ catalog truncated (--force)");
  }

  let productCount = 0;
  if (!provisionOnly) {
    productCount = await db.transaction((tx) => seedCatalog(tx));
  }

  // delivery zone (placeholder flat fee — Phase 2 adds zones admin)
  const zones = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(deliveryZones);
  if ((zones[0]?.n ?? 0) === 0) {
    await db.insert(deliveryZones).values({
      nameAr: "قلقيلية — داخل المدينة",
      feeMinor: 500,
      sortOrder: 0,
    });
  }

  // settings — runtime-configurable, no deploy needed (spec §8.2)
  const settingRows: Array<{ key: string; value: string }> = [
    { key: "shop_name", value: "JPasta" },
    { key: "shop_phone", value: "0566064976" },
    { key: "whatsapp", value: "970566064976" },
    {
      key: "hours_label",
      value: "يومياً ١:٠٠ ظهراً حتى ١:٠٠ بعد منتصف الليل",
    },
    { key: "opens_at", value: "13:00" },
    { key: "closes_at", value: "01:00" },
    { key: "delivery_eta_minutes", value: "25" },
    { key: "tax_rate_bps", value: "0" },
    { key: "min_order_minor", value: "0" },
    { key: "ordering_enabled", value: "true" },
    { key: "payment_methods", value: "cash,cash_on_delivery,card_terminal" },
    {
      key: "receipt_footer",
      value: "شكراً لكم — JPasta، باستا طازة تُطبخ عند الطلب",
    },
  ];
  for (const s of settingRows) {
    await db.insert(settings).values(s).onConflictDoNothing();
  }

  // owner account
  const ownerPin = process.env.JPASTA_OWNER_PIN;
  if (!ownerPin || !/^\d{6}$/.test(ownerPin)) {
    throw new Error(
      "JPASTA_OWNER_PIN must be set to a 6-digit PIN in .env.local",
    );
  }
  const lookup = await pinLookup(ownerPin);
  const existingOwner = await db
    .select({
      id: users.id,
      pinLookup: users.pinLookup,
      pinHash: users.pinHash,
    })
    .from(users)
    .where(eq(users.role, "owner"))
    .limit(1);
  const owner = existingOwner[0];
  if (!owner) {
    await db.insert(users).values({
      name: "المالك",
      role: "owner",
      pinHash: await hashPin(ownerPin),
      pinLookup: lookup,
    });
  } else if (
    owner.pinLookup !== lookup ||
    !owner.pinHash.startsWith("pbkdf2:")
  ) {
    // Rotate when the PIN changed, or upgrade a legacy scrypt hash to
    // PBKDF2 (Workers-native). A routine deploy with an unchanged PIN does
    // not invalidate the owner's live session.
    await db
      .update(users)
      .set({
        pinHash: await hashPin(ownerPin),
        pinLookup: lookup,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, owner.id));
  }

  console.log(
    `✓ seeded: ${productCount} products, ${CATEGORIES.length} categories, 1 delivery zone, owner account`,
  );
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    return pool.end().then(() => process.exit(1));
  });
