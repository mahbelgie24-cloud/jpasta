import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DishIllustration } from "@/components/brand/dish-illustration";
import { ProductBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { SectionHeading } from "@/components/ui/section-heading";
import { getFeatured } from "@/lib/server/catalog";

/** Featured dishes — the four bestsellers, illustrated placeholders. */
export async function Featured() {
  const products = await getFeatured();

  return (
    <section
      id="featured"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24"
      aria-labelledby="featured-title"
    >
      <SectionHeading
        index="1"
        eyebrow="قائمة الطازة"
        title="الأطباق اللي الكل بيجي عليها"
        sub="اختيارات زبائننا المفضلة — وكلها تبدأ باستا تُصنع في نفس اليوم."
      />

      <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`/menu#${p.slug}`}
              className="group flex h-full flex-col rounded-card border border-cream-200 bg-cream-100 p-4 shadow-card transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative">
                <div className="flex min-h-28 items-center justify-center rounded-xl bg-cream-50">
                  <DishIllustration
                    sauce={p.sauce}
                    toppings={p.toppings}
                    className="w-full max-w-40"
                  />
                </div>
                <div className="absolute start-2 top-2 flex flex-wrap gap-1.5">
                  {p.badges.slice(0, 1).map((b) => (
                    <ProductBadge key={b} badge={b} />
                  ))}
                </div>
              </div>
              <h3 className="mt-4 type-title text-ink">{p.nameAr}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                {p.descAr}
              </p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <Price
                  minor={p.basePriceMinor}
                  className="text-lg text-basil-800"
                />
                <span className="inline-flex items-center gap-1 text-sm font-bold text-basil-700 transition-transform group-hover:-translate-x-1">
                  اطلبها
                  <ArrowLeft className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 text-center">
        <Link href="/menu" className={buttonStyles("dark", "lg")}>
          القائمة الكاملة
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
