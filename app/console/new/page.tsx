import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, modifierGroups, modifiers, products } from "@/db/schema";
import { getSessionUser } from "@/lib/server/session";
import { ManualEntry, type ManualProduct } from "./manual-entry";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "طلب يدوي",
  robots: { index: false, follow: false },
};

export default async function NewOrderPage() {
  const user = await getSessionUser();
  if (!user) redirect("/console/login");

  const rows = await db
    .select({
      id: products.id,
      nameAr: products.nameAr,
      basePriceMinor: products.basePriceMinor,
      categoryAr: categories.nameAr,
      categorySort: categories.sortOrder,
      productSort: products.sortOrder,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.isAvailable, true))
    .orderBy(asc(categories.sortOrder), asc(products.sortOrder));

  const groupRows = await db
    .select()
    .from(modifierGroups)
    .orderBy(asc(modifierGroups.sortOrder));
  const optionRows = await db
    .select()
    .from(modifiers)
    .orderBy(asc(modifiers.sortOrder));

  const groupsByProduct = new Map<string, typeof groupRows>();
  for (const group of groupRows) {
    const list = groupsByProduct.get(group.productId) ?? [];
    list.push(group);
    groupsByProduct.set(group.productId, list);
  }
  const optionsByGroup = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const list = optionsByGroup.get(option.groupId) ?? [];
    list.push(option);
    optionsByGroup.set(option.groupId, list);
  }

  const catalog: ManualProduct[] = rows.map((p) => ({
    id: p.id,
    nameAr: p.nameAr,
    basePriceMinor: p.basePriceMinor,
    categoryNameAr: p.categoryAr,
    groups: (groupsByProduct.get(p.id) ?? []).map((group) => ({
      key: group.key,
      nameAr: group.nameAr,
      type: group.type,
      required: group.isRequired,
      maxSelections: group.maxSelections ?? undefined,
      options: (optionsByGroup.get(group.id) ?? []).map((option) => ({
        key: option.key,
        nameAr: option.nameAr,
        deltaMinor: option.priceDeltaMinor,
      })),
    })),
  }));

  return <ManualEntry products={catalog} ownerName={user.name} />;
}
