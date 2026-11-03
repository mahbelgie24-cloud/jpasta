"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ShoppingBag, X } from "lucide-react";
import { CartProvider, useCart } from "@/components/menu/cart-context";
import { CartDrawer } from "@/components/menu/cart-drawer";
import { ProductCard } from "@/components/menu/product-card";
import { Price } from "@/components/ui/price";
import { registerOfflineSync } from "@/lib/offline/sync";
import { placeStorefrontOrder } from "@/app/actions/orders";
import { arabicCount, arabicIncludes } from "@/lib/arabic";
import type { Category, Product } from "@/lib/menu-data";
import type { PaymentMethod } from "@/lib/domain/payment";
import { cn } from "@/lib/utils";

/**
 * Menu shell — sticky category rail, forgiving Arabic search, and the cart
 * bar in the thumb zone. The catalog arrives from the server (DB, with a
 * browse-only placeholder fallback).
 */

function itemCountLabel(count: number): string {
  return arabicCount(count, {
    one: "صنف واحد",
    two: "صنفان",
    few: "أصناف",
    many: "صنفاً",
  });
}

function MenuContent({
  categories,
  products: allProducts,
  orderingEnabled,
  paymentMethods,
  minOrderMinor,
  deliveryEtaMinutes,
}: {
  categories: Category[];
  products: Product[];
  orderingEnabled: boolean;
  paymentMethods?: PaymentMethod[];
  minOrderMinor: number;
  deliveryEtaMinutes: number;
}) {
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.slug ?? "",
  );
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => registerOfflineSync(placeStorefrontOrder), []);

  const grouped = useMemo(() => {
    return categories
      .map((c) => ({
        category: c,
        products: allProducts.filter(
          (p) =>
            p.categorySlug === c.slug &&
            (arabicIncludes(p.nameAr, query) ||
              arabicIncludes(p.descAr, query) ||
              arabicIncludes(c.nameAr, query)),
        ),
      }))
      .filter((g) => g.products.length > 0);
  }, [categories, allProducts, query]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        const slug = visible?.target.getAttribute("data-slug");
        if (slug) setActiveCategory(slug);
      },
      { rootMargin: "-180px 0px -55% 0px", threshold: [0, 0.2] },
    );
    for (const el of sectionRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [grouped]);

  return (
    <>
      <div className="container-page mt-6">
        <label className="relative block">
          <span className="sr-only">ابحث في القائمة</span>
          <Search
            className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن طبق… (مثال: ألفريدو، دجاج، حار)"
            className="min-h-13 w-full rounded-full border border-border-strong bg-surface ps-12 pe-12 text-sm transition-colors outline-none placeholder:text-text-secondary/70 focus:border-brand"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="مسح البحث"
              className="absolute end-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary hover:bg-paper-deep hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </label>
      </div>

      {/* sticky category nav */}
      <nav
        aria-label="فئات القائمة"
        className="sticky top-16 z-30 mt-4 border-b border-border-soft glass-bar"
      >
        <div className="container-page flex [scrollbar-width:none] gap-2 overflow-x-auto py-3 [&::-webkit-scrollbar]:hidden">
          {grouped.map(({ category }) => {
            const active = activeCategory === category.slug;
            return (
              <a
                key={category.slug}
                href={`#cat-${category.slug}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors",
                  active
                    ? "border-brand bg-brand text-cream-50"
                    : "border-border-strong bg-paper text-text-secondary hover:border-brand/40",
                )}
              >
                {category.nameAr}
              </a>
            );
          })}
        </div>
      </nav>

      <div className="container-page pt-10 pb-36">
        {grouped.length === 0 ? (
          <div className="mx-auto max-w-md py-20 text-center">
            <p className="font-display-ar text-3xl font-bold text-ink">
              ما لقينا شي
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              جرّب كلمة ثانية — أو تصفّح كل الفئات.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-bold text-cream-50"
            >
              مسح البحث
            </button>
          </div>
        ) : (
          grouped.map(({ category, products: categoryProducts }) => (
            <section
              key={category.slug}
              id={`cat-${category.slug}`}
              data-slug={category.slug}
              ref={(el) => {
                if (el) sectionRefs.current.set(category.slug, el);
                else sectionRefs.current.delete(category.slug);
              }}
              className="scroll-mt-40 pt-8 first:pt-0"
              aria-labelledby={`cat-title-${category.slug}`}
            >
              <div className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-4">
                <div>
                  <h2
                    id={`cat-title-${category.slug}`}
                    className="font-display-ar type-section text-ink"
                  >
                    {category.nameAr}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {category.blurbAr}{" "}
                    <span dir="ltr" className="font-display italic">
                      · {category.nameEn}
                    </span>
                  </p>
                </div>
                <span className="hidden text-xs font-bold text-text-secondary tabular-nums sm:block">
                  {itemCountLabel(categoryProducts.length)}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryProducts.map((p) => (
                  <li key={p.id}>
                    <ProductCard
                      product={p}
                      orderingEnabled={orderingEnabled}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* cart bar — thumb zone */}
      {orderingEnabled && cart.count > 0 && !cartOpen && (
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-fade-up motion-reduce:animate-none">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-brand-strong px-5 font-bold text-cream-50 shadow-lift transition-transform active:scale-[0.99]"
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

      <p aria-live="polite" className="sr-only">
        {cart.count > 0
          ? arabicCount(cart.count, {
              one: "عنصر واحد في السلة",
              two: "عنصران في السلة",
              few: "عناصر في السلة",
              many: "عنصراً في السلة",
            })
          : ""}
      </p>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        paymentMethods={paymentMethods}
        minOrderMinor={minOrderMinor}
        deliveryEtaMinutes={deliveryEtaMinutes}
      />
    </>
  );
}

export function MenuShell({
  categories,
  products,
  orderingEnabled = true,
  paymentMethods,
  minOrderMinor = 0,
  deliveryEtaMinutes = 25,
}: {
  categories: Category[];
  products: Product[];
  orderingEnabled?: boolean;
  paymentMethods?: PaymentMethod[];
  minOrderMinor?: number;
  deliveryEtaMinutes?: number;
}) {
  return (
    <CartProvider>
      <MenuContent
        categories={categories}
        products={products}
        orderingEnabled={orderingEnabled}
        paymentMethods={paymentMethods}
        minOrderMinor={minOrderMinor}
        deliveryEtaMinutes={deliveryEtaMinutes}
      />
    </CartProvider>
  );
}
