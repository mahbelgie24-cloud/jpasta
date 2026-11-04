import { Clock, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { OpenStatus } from "@/components/site/open-status";
import { getShopSettings } from "@/lib/server/settings";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

/** Visit — a stylised locality map, live hours, and one-tap contact. */
export async function Visit() {
  const shop = await getShopSettings();
  const phone = shop.shopPhone || SITE.phoneDisplay;
  return (
    <section
      id="visit"
      className="bg-paper py-20 lg:py-28"
      aria-labelledby="visit-title"
    >
      <div className="container-page">
        <SectionHeading
          id="visit-title"
          index="03"
          eyebrow="موقعنا وأوقاتنا"
          title="تعال جرّب، أو خليها توصلك"
          sub="بنوصل لعندك داخل قلقيلية — أو استلم من المحل مباشرة."
        />

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          {/* stylised map */}
          <a
            href={SITE.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex min-h-80 flex-col justify-end overflow-hidden rounded-card border border-border-soft bg-cream-200 p-6 shadow-card transition-shadow hover:shadow-lift"
            aria-label="افتح موقع JPasta في خرائط جوجل"
          >
            <svg
              viewBox="0 0 600 400"
              aria-hidden
              className="absolute inset-0 h-full w-full"
            >
              <rect width="600" height="400" fill="var(--color-cream-200)" />
              <g stroke="var(--color-cream-400)" strokeWidth="14" opacity="0.6">
                <path d="M-20 120 H620" />
                <path d="M-20 290 H620" />
                <path d="M120 -20 V420" />
                <path d="M430 -20 V420" />
              </g>
              <g stroke="var(--color-cream-300)" strokeWidth="6" opacity="0.8">
                <path d="M-20 205 H620" />
                <path d="M270 -20 V420" />
                <path d="M530 -20 V420" />
              </g>
              <g fill="var(--color-basil-200)" opacity="0.55">
                <rect x="140" y="140" width="100" height="45" rx="8" />
                <rect x="300" y="140" width="100" height="45" rx="8" />
                <rect x="450" y="220" width="60" height="50" rx="8" />
                <rect x="150" y="315" width="100" height="45" rx="8" />
              </g>
              <circle
                cx="270"
                cy="205"
                r="54"
                fill="var(--color-basil-700)"
                opacity="0.12"
              />
              <circle cx="270" cy="205" r="26" fill="var(--color-basil-700)" />
              <circle cx="270" cy="205" r="10" fill="var(--color-cream-50)" />
            </svg>

            <div className="relative rounded-2xl border border-border-soft bg-surface/95 p-4 backdrop-blur">
              <p className="flex items-center gap-2 font-bold text-ink">
                <MapPin className="size-4 text-brand" aria-hidden />
                {SITE.addressAr}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                بجانب مدرسة أبو علي اياد — قلقيلية، فلسطين
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                <Navigation className="size-4" aria-hidden />
                افتح في الخرائط
              </span>
            </div>
          </a>

          {/* contact card */}
          <div className="flex flex-col rounded-card border border-border-soft bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="type-title text-ink">كل يوم</h3>
              <OpenStatus hours={shop} />
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
              <Clock className="size-4 text-brand" aria-hidden />
              {shop.hoursLabel}
            </p>

            <div className="mt-6 space-y-3">
              <a
                href={`tel:${phone}`}
                className="flex min-h-13 items-center justify-center gap-2 rounded-full border border-border-strong bg-paper px-5 font-bold text-ink transition-colors hover:border-brand/40"
              >
                <Phone className="size-4 text-brand" aria-hidden />
                <span dir="ltr" className="tabular-nums">
                  {phone}
                </span>
              </a>
              <a
                href={whatsappUrl(shop.whatsapp, "مرحباً JPasta — بدي أطلب")}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles("primary", "lg", "w-full")}
              >
                <MessageCircle className="size-5" aria-hidden />
                اطلب عبر واتساب
              </a>
            </div>

            <div className="mt-auto border-t border-border-soft pt-5">
              <p className="text-xs leading-relaxed text-text-secondary">
                التوصيل متاح داخل قلقيلية. الدفع عند الاستلام — بدون أي رسوم
                خفية. للطلبات الكبيرة، اتصل قبل الموعد بساعة.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
