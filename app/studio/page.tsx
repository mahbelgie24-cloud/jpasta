import type { Metadata } from "next";
import Link from "next/link";
import { DishArt } from "@/components/brand/dish-art";
import { HeaderLogo, Logo, LogoMark } from "@/components/brand/logo";
import { ProductBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import type { SauceKind, ToppingKind } from "@/lib/menu-data";

export const metadata: Metadata = {
  title: "Studio — نظام التصميم",
  robots: { index: false, follow: false },
};

const SWATCHES = [
  ["basil-25", "bg-basil-25"],
  ["basil-100", "bg-basil-100"],
  ["basil-400", "bg-basil-400"],
  ["basil-600", "bg-basil-600"],
  ["basil-700", "bg-basil-700"],
  ["basil-900", "bg-basil-900"],
  ["basil-975", "bg-basil-975"],
  ["cream-50", "bg-cream-50"],
  ["cream-200", "bg-cream-200"],
  ["cream-400", "bg-cream-400"],
  ["wheat-300", "bg-wheat-300"],
  ["copper-500", "bg-copper-500"],
  ["pistachio-600", "bg-pistachio-600"],
  ["tomato-500", "bg-tomato-500"],
];

const SAUCES: SauceKind[] = [
  "alfredo",
  "marinara",
  "pesto",
  "pink",
  "baked",
  "golden",
];

const TOPPINGS: ToppingKind[][] = [
  ["chicken", "basil", "cheese"],
  ["tomato", "basil"],
  ["mushroom", "cheese", "chicken"],
  ["chili", "tomato", "basil"],
  ["cheese", "basil"],
  ["chicken", "mushroom", "tomato"],
];

export default function StudioPage() {
  return (
    <main id="main" className="min-h-dvh bg-canvas">
      <div className="container-page py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <Logo size="md" />
            <h1 className="mt-4 font-display-ar type-section text-ink">
              Basil Atelier — نظام التصميم
            </h1>
            <p className="mt-2 max-w-xl text-sm text-text-secondary">
              معرض مرجعي للتوكنات، الطباعة، المكوّنات، ورسوم الأطباق. صفحة
              داخلية non-indexed.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-sm font-bold text-ink"
          >
            العودة للموقع
          </Link>
        </header>

        <section className="mt-10" aria-labelledby="logo">
          <h2 id="logo" className="type-title text-ink">
            0 · الشعار
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6 shadow-card">
              <Logo size="lg" decorative />
              <p className="text-xs font-bold text-text-secondary">
                الكامل — خلفية فاتحة
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 rounded-card bg-brand-deep p-6 shadow-card">
              <Logo size="lg" decorative />
              <p className="text-xs font-bold text-cream-100/70">
                الكامل — خلفية داكنة
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6 shadow-card">
              <LogoMark className="size-16" decorative />
              <p className="text-xs font-bold text-text-secondary">
                العلامة — للمساحات الضيقة
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-white p-6 shadow-card">
              <LogoMark mono decorative className="size-16" />
              <p className="text-xs font-bold text-text-secondary">
                أحادي اللون — للطباعة
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center gap-5 rounded-card border border-line bg-surface p-6 shadow-card sm:flex-row sm:gap-7">
            <HeaderLogo decorative />
            <div>
              <p className="type-title text-ink">الأفقي — البار العلوي فقط</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-secondary">
                لوحة مستطيلة بحدود كريمية مزدوجة. تُستخدم في الهيدر فقط؛ الدائري
                يبقى في الفوتر والكونسول وحالة الطلب والإيصالات وأيقونات
                التطبيق.
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary">
            لا يُعاد رسم الشعار أو كتابة اسمه بخط آخر. مساحة الحماية حول الدائرة
            تعادل ارتفاع حرف الـ J، والحد الأدنى للعلامة الرقمية 32px، وللدائري
            الكامل 96px، وللأفقي 40px ارتفاعاً. ألوان كل نسخة مقفلة: أخضر الشعار
            ورمله.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="palette">
          <h2 id="palette" className="type-title text-ink">
            1 · اللوحة
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {SWATCHES.map(([name, className]) => (
              <li key={name}>
                <div
                  className={`h-20 rounded-xl border border-line ${className}`}
                />
                <p className="mt-2 text-xs font-bold text-text-secondary">
                  {name}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="type">
          <h2 id="type" className="type-title text-ink">
            2 · الطباعة
          </h2>
          <div className="mt-4 space-y-5 border-y border-line py-6">
            <p className="type-display text-ink">باستا طازة، بصلصة كتير</p>
            <p className="font-display-ar type-section text-ink">
              باستا طازة، بصلصة كتير
            </p>
            <p className="type-hero text-ink">باستا طازة، بصلصة كتير</p>
            <p className="type-title text-ink">باستا طازة، بصلصة كتير</p>
            <p className="max-w-xl type-body text-text-secondary">
              باستا طازة تُطبخ عند الطلب، وصلصات بيتية تُحضّر طازجة كل يوم،
              ودجاج طازج متبّل.
            </p>
            <p className="type-caption text-text-secondary">
              caption — 14px / 1.6
            </p>
            <p className="type-micro text-text-secondary">
              micro — 13px / 1.55
            </p>
            <p
              className="font-display text-2xl font-semibold text-brand-deep italic"
              dir="ltr"
            >
              Fresh pasta, cooked to order.
            </p>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="components">
          <h2 id="components" className="type-title text-ink">
            3 · المكوّنات
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button>اطلب الآن</Button>
            <Button variant="secondary">ثانوي</Button>
            <Button variant="dark">داكن</Button>
            <Button variant="ghost">شفاف</Button>
            <Button variant="primary" size="lg">
              كبير
            </Button>
            <Button disabled>معطّل</Button>
            <span className="inline-flex min-h-11 items-center rounded-full border border-basil-700 bg-basil-50 px-4 text-sm font-bold text-basil-800">
              chip نشط
            </span>
            <ProductBadge badge="bestseller" />
            <ProductBadge badge="new" />
            <Price
              minor={2450}
              className="text-lg font-bold text-brand-strong"
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <p className="type-title text-ink">بطاقة ورقية</p>
              <p className="mt-1 text-sm text-text-secondary">
                خط hairline وظل دافئ خفيف.
              </p>
            </div>
            <div className="rounded-card border border-line bg-paper-deep p-5 shadow-lift">
              <p className="type-title text-ink">سطح مرتفع</p>
              <p className="mt-1 text-sm text-text-secondary">
                للحوارات والحالات النشطة.
              </p>
            </div>
            <div className="rounded-card bg-brand-deep p-5 text-cream-50 shadow-overlay">
              <p className="type-title">سطح داكن</p>
              <p className="mt-1 text-sm text-cream-100/70">
                للـhero والكونسول والمطبخ.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="art">
          <h2 id="art" className="type-title text-ink">
            4 · رسوم الأطباق
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            ستة أطباق مختلفة من نفس النظام — اللون والصلصة والإضافات تتغير،
            والرسم يبقى متسقًا.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAUCES.map((sauce, i) => (
              <li
                key={sauce}
                className="overflow-hidden rounded-card border border-line bg-paper p-3 shadow-card"
              >
                <div className="rounded-xl bg-paper-deep">
                  <DishArt
                    seed={`studio-${sauce}`}
                    sauce={sauce}
                    toppings={TOPPINGS[i] ?? ["basil"]}
                    decorative
                    className="w-full"
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-text-secondary">
                  {sauce}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 mb-8" aria-labelledby="a11y">
          <h2 id="a11y" className="type-title text-ink">
            5 · إمكانية الوصول
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>• كل هدف لمس ≥ 44×44px.</li>
            <li>• لا يُعتمد اللون وحده لنقل المعنى.</li>
            <li>
              • الحقول لها labels مرئية، والأخطاء مرتبطة aria-describedby.
            </li>
            <li>• focus-visible واضح ولا يعيد تقويس العناصر.</li>
            <li>• prefers-reduced-motion يوقف كل الحركة.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
