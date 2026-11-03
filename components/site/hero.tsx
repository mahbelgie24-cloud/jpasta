import Link from "next/link";
import { ArrowLeft, ChefHat, Clock, MapPin, MessageCircle } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { DishArt } from "@/components/brand/dish-art";
import { getShopSettings } from "@/lib/server/settings";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

/**
 * Hero — a dark editorial plate.
 *
 * The page opens like a menu cover: deep basil, a hand-drawn dish, and
 * Arabic display type (Amiri) against Alexandria body copy. The twirl ring
 * is the only ambient motion and stops under prefers-reduced-motion.
 */
export async function Hero() {
  const shop = await getShopSettings();
  return (
    <section
      className="relative overflow-hidden bg-brand-deep text-cream-50"
      aria-labelledby="hero-title"
    >
      {/* Warm pool of light + a cool edge. The decorative grain layer was
          removed from the hero: at 3.5% opacity it was invisible, but it was
          the largest paint candidate on mobile and pushed LCP past 4s. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_72%_16%,oklch(0.45_0.08_90_/_0.28)_0%,transparent_62%),radial-gradient(50%_50%_at_8%_88%,oklch(0.35_0.06_160_/_0.35)_0%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-wheat-300/30 to-transparent"
      />

      <div className="relative container-page grid items-center gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:pt-24 lg:pb-28">
        <div className="animate-fade-up text-center lg:text-start">
          <p className="inline-flex items-center gap-2 rounded-full border border-cream-50/15 bg-cream-50/5 px-4 py-1.5 text-sm font-bold text-cream-100 backdrop-blur">
            صلصة بيتية · تُحضّر طازجة يومياً
          </p>

          <h1
            id="hero-title"
            className="mt-6 type-display text-balance text-cream-50"
          >
            باستا طازة،
            <br />
            <span className="text-wheat-300">بصلصة كتير</span>
            <br />
            ومحبة.
          </h1>

          <p
            className="mt-5 font-display text-lg font-semibold text-wheat-300/90 italic sm:text-xl"
            dir="ltr"
          >
            {SITE.tagline}
          </p>

          <p className="mx-auto mt-5 max-w-md type-body text-pretty text-cream-100/75 lg:mx-0">
            باستا طازة تُطبخ عند الطلب، وصلصات بيتية تُحضّر طازجة كل يوم، ودجاج
            طازج متبّل. اطلب من القائمة واستلم بسرعة — أو خلّينا نوصلها لعندك
            داخل قلقيلية.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/menu"
              prefetch={false}
              className={buttonStyles(
                "primary",
                "lg",
                "w-full bg-wheat-300 text-basil-950 shadow-lift hover:bg-wheat-400 sm:w-auto",
              )}
            >
              تصفّح القائمة
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
            <a
              href={whatsappUrl(
                shop.whatsapp,
                "مرحباً JPasta — بدي أستفسر عن القائمة",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles(
                "secondary",
                "lg",
                "w-full border-cream-50/20 bg-cream-50/5 text-cream-50 hover:border-wheat-300/50 hover:bg-cream-50/10 sm:w-auto",
              )}
            >
              <MessageCircle className="size-5" aria-hidden />
              اطلب عبر واتساب
            </a>
          </div>

          <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm lg:justify-start">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-wheat-300" aria-hidden />
              <dt className="sr-only">ساعات العمل</dt>
              <dd className="text-cream-100/80">{shop.hoursLabel}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-wheat-300" aria-hidden />
              <dt className="sr-only">التوصيل</dt>
              <dd className="text-cream-100/80">توصيل داخل قلقيلية</dd>
            </div>
            <div className="flex items-center gap-2">
              <ChefHat className="size-4 text-wheat-300" aria-hidden />
              <dt className="sr-only">التحضير</dt>
              <dd className="text-cream-100/80">تُطبخ عند الطلب</dd>
            </div>
          </dl>
        </div>

        {/* the plate */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden
            className="absolute inset-6 rounded-full border border-cream-50/10"
          />
          <div
            aria-hidden
            className="absolute inset-0 rounded-full border border-wheat-300/15 motion-safe:animate-[twirl_28s_linear_infinite]"
          />
          <div
            aria-hidden
            className="absolute inset-10 rounded-full bg-[radial-gradient(circle_at_42%_32%,oklch(0.97_0.02_88)_0%,oklch(0.92_0.03_86)_55%,oklch(0.84_0.04_86)_100%)] shadow-[0_30px_80px_-30px_oklch(0_0_0_/_0.8)]"
          />
          <div className="relative animate-fade-up px-3 pt-8 pb-6 [animation-delay:120ms]">
            <DishArt
              seed="fettuccine-mushroom-hero"
              sauce="alfredo"
              toppings={["mushroom", "cheese", "basil"]}
              variant="hero"
              decorative
              className="mx-auto w-full max-w-sm drop-shadow-[0_18px_30px_rgba(12,36,25,0.28)]"
            />
          </div>

          {/* floating ingredient labels */}
          <span className="absolute start-0 top-10 inline-flex -rotate-3 items-center gap-2 rounded-full border border-cream-50/15 bg-brand-deep/80 px-3.5 py-2 text-xs font-bold text-cream-100 shadow-lift backdrop-blur">
            <span
              className="size-1.5 rounded-full bg-pistachio-400"
              aria-hidden
            />
            ريحان طازج
          </span>
          <span className="absolute end-0 top-1/3 inline-flex rotate-2 items-center gap-2 rounded-full border border-cream-50/15 bg-brand-deep/80 px-3.5 py-2 text-xs font-bold text-cream-100 shadow-lift backdrop-blur">
            <span className="size-1.5 rounded-full bg-wheat-300" aria-hidden />
            صلصة ألفريدو
          </span>
          <span className="absolute end-8 bottom-8 inline-flex -rotate-2 items-center gap-2 rounded-full border border-cream-50/15 bg-brand-deep/80 px-3.5 py-2 text-xs font-bold text-cream-100 shadow-lift backdrop-blur">
            <span className="size-1.5 rounded-full bg-tomato-500" aria-hidden />
            فطر طازج
          </span>

          <p
            className="mt-6 text-center font-display text-sm font-semibold tracking-wide text-cream-100/60"
            dir="ltr"
          >
            Fettuccine Mushroom — the one everyone orders
          </p>
        </div>
      </div>
    </section>
  );
}
