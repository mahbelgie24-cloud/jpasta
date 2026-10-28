import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DishMedia } from "@/components/brand/dish-media";
import { ProductBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { SectionHeading } from "@/components/ui/section-heading";
import { getFeatured } from "@/lib/server/catalog";
import { cn } from "@/lib/utils";

/** Signature dishes — an asymmetric editorial grid, not four identical cards. */
export async function Featured() {
  const products = await getFeatured();
  if (products.length === 0) return null;

  const [lead, ...rest] = products;

  return (
    <section
      id="featured"
      className="container-page py-20 lg:py-28"
      aria-labelledby="featured-title"
    >
      <SectionHeading
        id="featured-title"
        index="01"
        eyebrow="أطباق التوقيع"
        title="الأطباق اللي الكل بيرجع عليها"
        sub="اختيارات زبائننا المفضلة — وكلها تبدأ بعجينة تُصنع في نفس اليوم."
      />

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
        {lead && (
          <Link
            key={lead.id}
            href={`/menu#${lead.slug}`}
            className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-card border border-border-soft bg-brand-deep p-6 text-cream-50 shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift sm:col-span-2 lg:row-span-2"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_55%_18%,oklch(0.45_0.08_90_/_0.3)_0%,transparent_65%)]"
            />
            <DishMedia
              product={lead}
              variant="dark"
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="absolute inset-x-0 top-0 mx-auto w-full max-w-md transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
            />
            <div className="relative mt-auto">
              <div className="flex flex-wrap gap-1.5">
                {lead.badges.slice(0, 2).map((b) => (
                  <ProductBadge key={b} badge={b} />
                ))}
              </div>
              <h3 className="mt-3 font-display-ar text-3xl font-bold text-cream-50">
                {lead.nameAr}
              </h3>
              <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-cream-100/70">
                {lead.descAr}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <Price
                  minor={lead.basePriceMinor}
                  className="text-xl font-extrabold text-wheat-300"
                />
                <span className="inline-flex items-center gap-1 text-sm font-bold text-cream-100 transition-transform group-hover:-translate-x-1">
                  اطلبها
                  <ArrowLeft className="size-4" aria-hidden />
                </span>
              </div>
            </div>
          </Link>
        )}

        {rest.map((p, i) => (
          <Link
            key={p.id}
            href={`/menu#${p.slug}`}
            className={cn(
              "group flex flex-col overflow-hidden rounded-card border border-border-soft bg-paper p-4 shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift",
              rest.length === 3 && i === 2 && "sm:col-span-2 lg:col-span-2",
            )}
          >
            <div className="relative flex min-h-36 items-center justify-center overflow-hidden rounded-xl bg-paper-deep">
              <DishMedia
                product={p}
                className="w-full max-w-48 transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
              />
              <div className="absolute start-2 top-2 flex flex-wrap gap-1.5">
                {p.badges.slice(0, 1).map((b) => (
                  <ProductBadge key={b} badge={b} />
                ))}
              </div>
            </div>
            <h3 className="mt-4 type-title text-ink">{p.nameAr}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary">
              {p.descAr}
            </p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <Price
                minor={p.basePriceMinor}
                className="text-lg font-extrabold text-brand-strong"
              />
              <span className="inline-flex items-center gap-1 text-sm font-bold text-brand transition-transform group-hover:-translate-x-1">
                اطلبها
                <ArrowLeft className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link href="/menu" className={buttonStyles("dark", "lg")}>
          القائمة الكاملة
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
