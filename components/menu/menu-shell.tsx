"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { CartProvider, useCart } from "@/components/menu/cart-context";
import { CartDrawer } from "@/components/menu/cart-drawer";
import { ProductCard } from "@/components/menu/product-card";
import { Price } from "@/components/ui/price";
import { registerOfflineSync } from "@/lib/offline/sync";
import { placeStorefrontOrder } from "@/app/actions/orders";
import type { Category, Product } from "@/lib/menu-data";

/**
 * Menu shell — sticky category nav, per-category sections, and the cart
 * bar. One-hand mobile ergonomics: the cart lives at the thumb (spec §12.2).
 * The catalog comes from the server (DB with placeholder fallback).
 */

function MenuContent({
  categories,
  products: allProducts,
}: {
  categories: Category[];
  products: Product[];
}) {
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.slug ?? "",
  );

  // Phase 2: offline orders queued in IndexedDB replay exactly-once when
  // connectivity returns (payloads carry their own idempotency keys).
  useEffect(() => registerOfflineSync(placeStorefrontOrder), []);

  const grouped = useMemo(() => {
    return categories
      .map((c) => ({
        category: c,
        products: allProducts.filter((p) => p.categorySlug === c.slug),
      }))
      .filter((g) => g.products.length > 0);
  }, [categories, allProducts]);

  useEffect(() => {
    const slugs = grouped.map((g) => g.category.slug);
    const onScroll = () => {
      let current = slugs[0] ?? "";
      for (const slug of slugs) {
        const el = document.getElementById(`cat-${slug}`);
        if (el && el.getBoundingClientRect().top <= 190) current = slug;
      }
      setActiveCategory(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [grouped]);

  return (
    <>
      {/* sticky category nav — below the glass header */}
      <nav
        aria-label="فئات القائمة"
        className="sticky top-16 z-30 border-b border-cream-200 glass-bar"
      >
        <div className="mx-auto flex max-w-6xl [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-3 sm:px-6 [&::-webkit-scrollbar]:hidden">
          {grouped.map(({ category }) => {
            const active = activeCategory === category.slug;
            return (
              <a
                key={category.slug}
                href={`#cat-${category.slug}`}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-basil-700 bg-basil-700 px-4 text-sm font-bold text-cream-50"
                    : "inline-flex min-h-11 shrink-0 items-center rounded-full border border-cream-300 bg-cream-100 px-4 text-sm font-bold text-ink-soft transition-colors hover:border-basil-300"
                }
              >
                {category.nameAr}
              </a>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pt-8 pb-36 sm:px-6">
        {grouped.map(({ category, products: categoryProducts }) => (
          <section
            key={category.slug}
            id={`cat-${category.slug}`}
            className="scroll-mt-40 pt-6 first:pt-0"
            aria-labelledby={`cat-title-${category.slug}`}
          >
            <div className="mb-5">
              <h2
                id={`cat-title-${category.slug}`}
                className="type-section text-ink"
              >
                {category.nameAr}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {category.blurbAr}{" "}
                <span dir="ltr" className="font-display italic opacity-70">
                  · {category.nameEn}
                </span>
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryProducts.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* cart bar — thumb zone */}
      {cart.count > 0 && !cartOpen && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md animate-fade-up motion-reduce:animate-none">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-basil-800 px-5 font-bold text-cream-50 shadow-lift transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-wheat-300 text-sm font-extrabold text-basil-950 tabular-nums">
                {cart.count}
              </span>
              عرض السلة
            </span>
            <Price minor={cart.subtotal} className="text-lg" />
            <ShoppingBag className="size-5" aria-hidden />
          </button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

export function MenuShell({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  return (
    <CartProvider>
      <MenuContent categories={categories} products={products} />
    </CartProvider>
  );
}
