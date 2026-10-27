import type { Metadata } from "next";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { MenuShell } from "@/components/menu/menu-shell";
import { getCatalog } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "القائمة — اطلب أونلاين",
  description:
    "قائمة JPasta الكاملة: باستا طازة يومياً بصلصات بيتية ودجاج طازج. خصّص طبقك — الحجم، الإضافات، الحرارة — واطلب استلام أو توصيل داخل قلقيلية.",
  alternates: { canonical: "/menu" },
};

// The catalog is DB-backed (with a placeholder fallback) — dynamic rendering
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { categories, products } = await getCatalog();
  return (
    <>
      <Header />
      <main id="main" className="min-h-dvh">
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          <header className="text-center">
            <h1 className="type-section text-ink">القائمة</h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
              كل الأطباق تبدأ باستا طازة مصنوعة اليوم — اضغط على أي طبق لتخصيصه.
            </p>
          </header>
        </div>
        <MenuShell categories={categories} products={products} />
      </main>
      <Footer />
    </>
  );
}
