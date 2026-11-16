"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Search, ShoppingBag, X } from "lucide-react";
import { CartProvider, useCart } from "@/components/menu/cart-context";
import { ProductCard } from "@/components/menu/product-card";
import { Price } from "@/components/ui/price";
import { SheetSkeleton } from "@/components/ui/sheet";
import { ToastProvider, useToast } from "@/components/ui/toast";
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

// The drawer is the heaviest off-interaction chunk on /menu: it ships only
// when the customer first opens the cart (preloaded on the first add below).
const CartDrawer = dynamic(
  () => import("@/components/menu/cart-drawer").then((m) => m.CartDrawer),
  { ssr: false, loading: () => <SheetSkeleton /> },
);

function itemCountLabel(count: number): string {
  return arabicCount(count, {
    one: "صنف واحد",
    two: "صنفان",
    few: "أصناف",
    many: "صنفاً",
  });
}

/** Above-the-fold photo count — the /menu LCP candidates (2 covers the sm
 * two-column row; on lg the third card lazy-loads right behind them, and on
 * single-column mobile the two extra high-priority fetches would only steal
 * bandwidth from the real LCP image). */
const FIRST_ROW_PHOTOS = 2;

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
  // Mount-once: after the first open the drawer stays mounted (closed) so a
  // close mid-submit never drops the in-flight result or the idempotency
  // scope — unmounting it would turn a retry into a duplicate sale.
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.slug ?? "",
  );
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => registerOfflineSync(placeStorefrontOrder), []);

  // The offline queue replays in the background (lib/offline/sync). The
  // confirmation screen covers the moment of queueing; without this toast a
  // customer who queued offline never learns the order actually landed.
  const toast = useToast();
  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ sent: number }>).detail;
      const count = detail?.sent ?? 1;
      // Arabic dual form — "وصلنا 2 طلبات" is broken grammar.
      toast(
        count === 2
          ? "وصل طلباك المؤجلان — شكراً لصبرك"
          : count > 2
            ? `وصلنا ${count} طلبات مؤجلة — شكراً لصبرك`
            : "وصلنا طلبك المؤجل — شكراً لصبرك",
        "success",
      );
    };
    window.addEventListener("jpasta:orders-synced", onSynced);
    return () => window.removeEventListener("jpasta:orders-synced", onSynced);
  }, [toast]);

  // First add → quietly fetch the drawer chunk so opening the cart is
  // instant even on a slow connection.
  const shouldPreloadDrawer = cart.count > 0;
  useEffect(() => {
    if (shouldPreloadDrawer) void import("@/components/menu/cart-drawer");
  }, [shouldPreloadDrawer]);

  const grouped = useMemo(() => {
    const groups = categories.map((c) => ({
      category: c,
      products: allProducts.filter(
        (p) =>
          p.categorySlug === c.slug &&
          (arabicIncludes(p.nameAr, query) ||
            arabicIncludes(p.descAr, query) ||
            arabicIncludes(c.nameAr, query)),
      ),
    }));
    // Global card index per section (pure — no reassignment of render-scope
    // variables, which react-hooks/immutability forbids): the first section's
    // cards are the /menu LCP candidates and render their photos eagerly.
    const starts = groups.map((_, i) =>
      groups.slice(0, i).reduce((sum, g) => sum + g.products.length, 0),
    );
    return groups
      .map((g, i) => ({ ...g, start: starts[i] ?? 0 }))
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
        {/* Siblings, not label-nested: WebKit's accessibility tree swallows
            interactive elements inside a <label>, which made the clear
            button invisible to Safari users (and untestable). The label
            pairs with the input through htmlFor/id instead. */}
        <div className="relative block">
          <label htmlFor="menu-search" className="sr-only">
            ابحث في القائمة
          </label>
          <Search
            className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            id="menu-search"
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
              className="absolute end-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary hover:bg-paper-deep hover:text-text-primary"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
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
            <p className="font-display-ar text-3xl font-bold text-text-primary">
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
          grouped.map(({ category, products: categoryProducts, start }) => {
            // Above-the-fold photos render eagerly: the first section's cards
            // are the /menu LCP candidates (one row on every breakpoint).
            const sectionStart = start;
            return (
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
                      className="font-display-ar type-section text-text-primary"
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
                  {categoryProducts.map((p, i) => (
                    <li key={p.id}>
                      <ProductCard
                        product={p}
                        orderingEnabled={orderingEnabled}
                        eager={sectionStart + i < FIRST_ROW_PHOTOS}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {/* cart bar — thumb zone */}
      {orderingEnabled && cart.count > 0 && !cartOpen && (
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-fade-up motion-reduce:animate-none">
          <button
            type="button"
            onClick={() => {
              setCartOpen(true);
              setDrawerMounted(true);
            }}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-brand-strong px-5 font-bold text-cream-50 shadow-lift transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-wheat-300 text-sm font-extrabold text-text-primary tabular-nums">
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

      {/* Mount-once (chunk loads on first open, then stays mounted closed so
          mid-submit closes can never drop the in-flight order result). */}
      {drawerMounted && (
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          paymentMethods={paymentMethods}
          minOrderMinor={minOrderMinor}
          deliveryEtaMinutes={deliveryEtaMinutes}
        />
      )}
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
      <ToastProvider>
        <MenuContent
          categories={categories}
          products={products}
          orderingEnabled={orderingEnabled}
          paymentMethods={paymentMethods}
          minOrderMinor={minOrderMinor}
          deliveryEtaMinutes={deliveryEtaMinutes}
        />
      </ToastProvider>
    </CartProvider>
  );
}
