import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, modifierGroups, modifiers, products } from "@/db/schema";
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
 * Catalog read path — DB first, beautiful placeholder as the DB-degraded
 * fallback (build without a reachable DB still succeeds; runtime uses the
 * real catalog). Cached per request via React cache.
 */
export const getCatalog = cache(
  async (): Promise<{ categories: Category[]; products: Product[] }> => {
    try {
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
        return { categories: CATEGORIES, products: PRODUCTS };
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
        p.categorySlug =
          slugById.get(p.categorySlug) ?? cats[0]?.slug ?? "classics";
      }

      const mappedCategories: Category[] = cats.map((c) => ({
        slug: c.slug,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        blurbAr: c.blurbAr ?? "",
      }));

      return { categories: mappedCategories, products: mappedProducts };
    } catch {
      // DB-degraded mode — the Phase 0 placeholder catalog keeps the storefront alive
      return { categories: CATEGORIES, products: PRODUCTS };
    }
  },
);

export async function getFeatured(): Promise<Product[]> {
  const { products: all } = await getCatalog();
  return all.filter((p) => p.badges.includes("bestseller")).slice(0, 4);
}
