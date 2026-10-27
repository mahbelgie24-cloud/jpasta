import { ArrowLeft, MessageCircle } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { DishIllustration } from "@/components/brand/dish-illustration";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

/** Hero — editorial Arabic display + the tagline as a Fraunces accent. */
export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      {/* warm backdrop wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_78%_18%,var(--color-basil-100)_0%,transparent_65%),radial-gradient(45%_40%_at_12%_85%,var(--color-cream-200)_0%,transparent_60%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pt-20 lg:pb-24">
        <div className="animate-fade-up text-center lg:text-start">
          <p className="inline-flex items-center gap-2 rounded-full border border-basil-200 bg-cream-50 px-4 py-1.5 text-sm font-bold text-basil-700 shadow-card">
            <LogoMark className="size-5" />
            بصلصة كتير ومحبة — كل يوم
          </p>

          <h1 id="hero-title" className="mt-5 type-hero text-balance text-ink">
            باستا طازة
            <br />
            <span className="text-basil-700">تُصنع كل يوم</span>
          </h1>

          <p
            className="mt-4 font-display text-xl font-semibold text-wheat-600 italic sm:text-2xl"
            dir="ltr"
          >
            Fresh pasta made everyday.
          </p>

          <p className="mx-auto mt-4 max-w-md type-body text-pretty text-ink-soft lg:mx-0">
            عجينة تُعدّ كل صباح، صلصات بيتية على أصولها، ودجاج طازج متبّل. اطلب
            من القائمة واستلم بسرعة — أو خلّينا نوصلها لعندك بقلقيلية.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a
              href="/menu"
              className={buttonStyles("primary", "lg", "w-full sm:w-auto")}
            >
              تصفّح القائمة
              <ArrowLeft className="size-5" aria-hidden />
            </a>
            <a
              href={whatsappUrl(
                SITE.whatsapp,
                "مرحباً JPasta 🍝 بدي أستفسر عن القائمة",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles("secondary", "lg", "w-full sm:w-auto")}
            >
              <MessageCircle className="size-5" aria-hidden />
              اطلب عبر واتساب
            </a>
          </div>

          <dl className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm lg:justify-start">
            <div className="flex items-center gap-2">
              <dt className="font-bold text-ink">الاستلام:</dt>
              <dd className="text-ink-soft">من المحل خلال ١٠–١٥ دقيقة</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-bold text-ink">التوصيل:</dt>
              <dd className="text-ink-soft">داخل قلقيلية — طازة لعندك</dd>
            </div>
          </dl>
        </div>

        {/* Hero illustration — brand dish composition */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden
            className="absolute inset-x-6 top-6 -z-10 aspect-square rounded-[var(--radius-2xl)] bg-cream-100 shadow-card"
          />
          <div
            aria-hidden
            className="absolute start-8 -top-3 size-16 rounded-full border-[6px] border-wheat-300/60"
          />
          <div
            aria-hidden
            className="absolute end-4 bottom-8 size-10 rounded-full bg-basil-200/70"
          />
          <div className="animate-fade-up px-4 pt-10 pb-8 [animation-delay:120ms]">
            <DishIllustration
              sauce="alfredo"
              toppings={["chicken", "basil", "cheese", "tomato"]}
              className="mx-auto w-full max-w-sm drop-shadow-[0_18px_28px_rgba(24,38,32,0.14)]"
            />
            <p
              className="mt-4 text-center font-display text-lg font-semibold text-basil-800"
              dir="ltr"
            >
              Chicken Alfredo — the one everyone orders
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
