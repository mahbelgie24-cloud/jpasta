"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DishIllustration } from "@/components/brand/dish-illustration";
import { ProductBadge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { ItemSheet } from "@/components/menu/item-sheet";
import type { Product } from "@/lib/menu-data";

/** Menu product card — opens the customization sheet. */
export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);

  return (
    <article
      id={product.slug}
      className="group flex scroll-mt-40 flex-col rounded-card border border-cream-200 bg-cream-100 p-4 shadow-card transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-32 w-full items-center justify-center rounded-xl bg-cream-50"
          aria-label={`تخصيص ${product.nameAr}`}
        >
          <DishIllustration
            sauce={product.sauce}
            toppings={product.toppings}
            className="w-full max-w-44"
          />
        </button>
        <div className="pointer-events-none absolute start-2 top-2 flex flex-wrap gap-1.5">
          {product.badges.map((b) => (
            <ProductBadge key={b} badge={b} />
          ))}
        </div>
      </div>

      <h3 className="mt-4 type-title text-ink">
        {product.nameAr}
        {product.heat > 0 && (
          <span
            className="ms-1.5 align-middle text-terracotta"
            aria-label={`مستوى حرارة ${product.heat} من 3`}
          >
            {"🌶".repeat(product.heat)}
          </span>
        )}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">
        {product.descAr}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div>
          <Price
            minor={product.basePriceMinor}
            className="text-lg text-basil-800"
          />
          <span className="block text-xs text-ink-soft">يبدأ من</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-basil-700 px-5 text-sm font-bold text-cream-50 shadow-card transition-colors hover:bg-basil-600 active:scale-[0.98]"
        >
          <Plus className="size-4" aria-hidden />
          أضف
        </button>
      </div>

      <ItemSheet product={product} open={open} onClose={() => setOpen(false)} />
    </article>
  );
}
