import type { Metadata } from "next";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { OpenStatus } from "@/components/site/open-status";
import { MenuShell } from "@/components/menu/menu-shell";
import { getCatalog } from "@/lib/server/catalog";
import { SITE } from "@/lib/site";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "القائمة — اطلب أونلاين",
  description:
    "قائمة JPasta الكاملة: باستا طازة يومياً بصلصات بيتية ودجاج طازج. خصّص طبقك — الحجم، الإضافات، الحرارة — واطلب استلام أو توصيل داخل قلقيلية.",
  alternates: { canonical: "/menu" },
  openGraph: {
    title: "قائمة JPasta — باستا طازة يومياً",
    description:
      "تصفّح القائمة كاملة، خصّص طبقك، واطلب توصيل أو استلام من قلقيلية.",
    url: `${SITE.url}/menu`,
  },
};

export const revalidate = 300;

export default async function MenuPage() {
  const { categories, products, orderingEnabled } = await getCatalog();

  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `قائمة ${SITE.name}`,
    inLanguage: "ar",
    url: `${SITE.url}/menu`,
    hasMenuSection: categories.map((category) => ({
      "@type": "MenuSection",
      name: category.nameAr,
      description: category.blurbAr,
      hasMenuItem: products
        .filter((p) => p.categorySlug === category.slug)
        .map((p) => ({
          "@type": "MenuItem",
          name: p.nameAr,
          description: p.descAr,
          offers: {
            "@type": "Offer",
            price: formatPrice(p.basePriceMinor),
            priceCurrency: "ILS",
          },
        })),
    })),
  };

  return (
    <>
      <Header />
      <main id="main" className="min-h-dvh">
        <div className="container-page pt-10 sm:pt-14">
          <header className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-paper px-4 py-1.5 text-xs font-bold text-text-secondary">
              <OpenStatus />
              <span className="h-3 w-px bg-border-strong" aria-hidden />
              توصيل داخل قلقيلية
            </p>
            <h1 className="mt-5 font-display-ar type-section text-balance text-ink">
              القائمة
            </h1>
            <p className="mx-auto mt-3 max-w-lg type-body text-pretty text-text-secondary">
              كل الأطباق تبدأ باستا طازة مصنوعة اليوم — اضغط على أي طبق لتخصيصه.
            </p>
          </header>

          {!orderingEnabled && (
            <p
              role="status"
              className="mx-auto mt-6 max-w-xl rounded-2xl border border-warning/25 bg-warning/10 px-5 py-4 text-center text-sm font-bold text-ink"
            >
              القائمة للعرض فقط الآن — الطلب المباشر غير متاح مؤقتاً. راسلنا على
              واتساب وسنساعدك فوراً.
            </p>
          )}
        </div>

        <MenuShell
          categories={categories}
          products={products}
          orderingEnabled={orderingEnabled}
        />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        // Menu schema is derived from the same server catalog the page renders.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
    </>
  );
}
