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

  const groupRows = await db.select().from(modifierGroups);
  const optionRows = await db
    .select()
    .from(modifiers)
    .orderBy(asc(modifiers.sortOrder));

  const catalog: ManualProduct[] = rows.map((p) => {
    const sizeGroup = groupRows.find(
      (g) => g.productId === p.id && g.key === "size",
    );
    const sizeOptions = sizeGroup
      ? optionRows
          .filter((o) => o.groupId === sizeGroup.id)
          .map((o) => ({
            key: o.key,
            nameAr: o.nameAr,
            deltaMinor: o.priceDeltaMinor,
          }))
      : [];
    const extrasGroup = groupRows.find(
      (g) => g.productId === p.id && g.key === "extras",
    );
    const extras = extrasGroup
      ? optionRows
          .filter((o) => o.groupId === extrasGroup.id)
          .map((o) => ({
            key: o.key,
            nameAr: o.nameAr,
            deltaMinor: o.priceDeltaMinor,
          }))
      : [];
    return {
      id: p.id,
      nameAr: p.nameAr,
      basePriceMinor: p.basePriceMinor,
      categoryNameAr: p.categoryAr,
      sizeOptions,
      extras,
    };
  });

  return <ManualEntry products={catalog} ownerName={user.name} />;
}
