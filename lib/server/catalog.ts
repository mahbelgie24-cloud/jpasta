import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, modifierGroups, modifiers, products } from "@/db/schema";
import { DISH_PHOTOS_BY_KEY } from "@/lib/dish-photos.generated";
import {
  CATEGORIES,
  PRODUCTS,
  type Badge,
  type Category,
  type Product,
  type SauceKind,
  type ToppingKind,
} from "@/lib/menu-data";

/**
 * Catalog read path — DB-backed catalog cached with the `catalog` tag
 * (revalidate every 5 min as a bound, invalidated on-demand by menu-admin
 * mutations). The store menu changes when the OWNER changes it, so ISR +
 * tag revalidation serves the menu from the edge instantly while edits
 * propagate immediately. The placeholder remains the DB-degraded fallback
 * (build without a reachable DB still succeeds).
 */
export type CatalogSource = "db" | "placeholder";

export interface CatalogResult {
  categories: Category[];
  products: Product[];
  source: CatalogSource;
  /** Ordering is only safe when the catalog ids exist in the database. */
  orderingEnabled: boolean;
}

const getCatalogFromDb = unstable_cache(
  async (): Promise<CatalogResult> => {
    const [cats, prods] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder)),
      db
        .select()
        .from(products)
        .where(eq(products.isAvailable, true))
        .orderBy(asc(products.sortOrder)),
    ]);
    if (cats.length === 0 || prods.length === 0) {
      // Placeholder ids are slugs, not database UUIDs — display only.
      return {
        categories: CATEGORIES,
        products: PRODUCTS,
        source: "placeholder",
        orderingEnabled: false,
      };
    }

    const groupRows = await db
      .select()
      .from(modifierGroups)
      .orderBy(asc(modifierGroups.sortOrder));
    const optionRows = await db
      .select()
      .from(modifiers)
      .orderBy(asc(modifiers.sortOrder));
    const optionsByGroup = new Map<string, typeof optionRows>();
    for (const o of optionRows) {
      const list = optionsByGroup.get(o.groupId) ?? [];
      list.push(o);
      optionsByGroup.set(o.groupId, list);
    }

    const mappedProducts: Product[] = prods.map((p) => ({
      id: p.id,
      slug: p.slug,
      categorySlug: p.categoryId, // resolved below
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descAr: p.descriptionAr ?? "",
      basePriceMinor: p.basePriceMinor,
      sauce: p.sauce as SauceKind,
      toppings: (p.toppings as ToppingKind[]) ?? [],
      heat: (p.heat as 0 | 1 | 2 | 3) ?? 0,
      badges: (p.badges as Badge[]) ?? [],
      featured: p.isFeatured,
      ...(p.imageKey
        ? {
            image: {
              key: p.imageKey,
              alt: p.imageAlt ?? p.nameAr,
              width: p.imageWidth ?? 1200,
              height: p.imageHeight ?? 900,
              color: p.imageColor ?? undefined,
              blurDataURL: DISH_PHOTOS_BY_KEY[p.imageKey]?.blurDataURL,
            },
          }
        : {}),
      groups: groupRows
        .filter((g) => g.productId === p.id)
        .map((g) => ({
          id: g.key,
          nameAr: g.nameAr,
          type: g.type,
          required: g.isRequired,
          maxSelections: g.maxSelections ?? undefined,
          options: (optionsByGroup.get(g.id) ?? []).map((o) => ({
            id: o.key,
            nameAr: o.nameAr,
            priceMinor: o.priceDeltaMinor,
          })),
        })),
    }));

    // map categoryId (uuid) → category slug for the client shape
    const slugById = new Map(cats.map((c) => [c.id, c.slug]));
    for (const p of mappedProducts) {
      p.categorySlug = slugById.get(p.categorySlug) ?? cats[0]?.slug ?? "pasta";
    }

    const mappedCategories: Category[] = cats.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      blurbAr: c.blurbAr ?? "",
    }));

    return {
      categories: mappedCategories,
      products: mappedProducts,
      source: "db" as const,
      orderingEnabled: true,
    };
  },
  ["catalog"],
  { tags: ["catalog"], revalidate: 300 },
);

export const getCatalog = cache(async (): Promise<CatalogResult> => {
  try {
    return await getCatalogFromDb();
  } catch {
    // DB-degraded mode: show the menu for browsing, but never let a customer
    // submit an order whose product ids do not exist in the database.
    return {
      categories: CATEGORIES,
      products: PRODUCTS,
      source: "placeholder",
      orderingEnabled: false,
    };
  }
});

export async function getFeatured(): Promise<Product[]> {
  const { products: all } = await getCatalog();
  const curated = all.filter((p) => p.featured);
  return (
    curated.length > 0
      ? curated
      : all.filter((p) => p.badges.includes("bestseller"))
  ).slice(0, 4);
}
