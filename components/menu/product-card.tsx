"use client";

import { useState } from "react";
import { Flame, Plus } from "lucide-react";
import { DishMedia } from "@/components/brand/dish-media";
import { ProductBadge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { ItemSheet } from "@/components/menu/item-sheet";
import type { Product } from "@/lib/menu-data";

/** Heat level — icon + count (never emoji, never color alone). */
function HeatLevel({ level }: { level: number }) {
  return (
    <span
      role="img"
      className="inline-flex items-center gap-0.5 rounded-full bg-terracotta/10 px-2 py-0.5 text-terracotta"
      aria-label={`مستوى حرارة ${level} من 3`}
    >
      {Array.from({ length: level }, (_, i) => (
        <Flame key={i} className="size-3" aria-hidden />
      ))}
    </span>
  );
}

/** Menu product card — opens the customization sheet. */
export function ProductCard({
  product,
  orderingEnabled = true,
}: {
  product: Product;
  orderingEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasPriceVariation = product.groups.some((group) =>
    group.options.some((option) => option.priceMinor > 0),
  );

  return (
    <article
      id={product.slug}
      className="group flex scroll-mt-40 flex-col rounded-card border border-border-soft bg-surface-raised p-4 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex min-h-36 w-full items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(85%_75%_at_50%_20%,var(--color-cream-50)_0%,var(--color-cream-100)_100%)]"
          aria-label={`تخصيص ${product.nameAr}`}
        >
          <DishMedia
            product={product}
            decorative
            className="w-full max-w-52 transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </button>
        <div className="pointer-events-none absolute start-2 top-2 flex flex-wrap gap-1.5">
          {product.badges.map((b) => (
            <ProductBadge key={b} badge={b} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-2">
        <h3 className="type-title text-ink">{product.nameAr}</h3>
        {product.heat > 0 && <HeatLevel level={product.heat} />}
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary">
        {product.descAr}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div>
          <Price
            minor={product.basePriceMinor}
            className="text-lg font-extrabold text-basil-800"
          />
          <span className="block text-xs text-text-secondary">
            {hasPriceVariation ? "يبدأ من" : "السعر"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-5 text-sm font-bold text-action-text shadow-card transition-[background-color,transform] duration-150 ease-out hover:bg-action-hover active:scale-[0.96]"
        >
          <Plus className="size-4" aria-hidden />
          {orderingEnabled ? "أضف" : "عرض"}
        </button>
      </div>

      {/* Mount the sheet only while open: 18 hidden dialog trees on /menu was
          the largest avoidable DOM/interaction cost in v1. */}
      {open && (
        <ItemSheet
          product={product}
          open={open}
          onClose={() => setOpen(false)}
          orderingEnabled={orderingEnabled}
        />
      )}
    </article>
  );
}
