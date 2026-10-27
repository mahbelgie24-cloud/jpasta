import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

/** Visit — hours, address, contact. The "come find us" moment. */
export function Visit() {
  return (
    <section
      id="visit"
      className="border-t border-cream-200 bg-cream-100/60 py-16 lg:py-24"
      aria-labelledby="visit-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          index="4"
          eyebrow="موقعنا وأوقاتنا"
          title="تعال جرّب، أو خليها توصلك"
          sub="بنوصل لعندك داخل قلقيلية — أو استلم من المحل مباشرة."
        />

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-card border border-cream-200 bg-cream-50 p-6 text-center shadow-card">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-basil-100 text-basil-700">
              <Clock className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 type-title text-ink">أوقات الدوام</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {SITE.hoursLabel}
            </p>
          </div>

          <div className="rounded-card border border-cream-200 bg-cream-50 p-6 text-center shadow-card">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-basil-100 text-basil-700">
              <MapPin className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 type-title text-ink">العنوان</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {SITE.addressAr}
            </p>
            <a
              href={SITE.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-basil-700 underline decoration-basil-300 underline-offset-4 hover:text-basil-600"
            >
              افتح في الخرائط
            </a>
          </div>

          <div className="rounded-card border border-cream-200 bg-cream-50 p-6 text-center shadow-card">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-basil-100 text-basil-700">
              <Phone className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 type-title text-ink">اتصل أو راسلنا</h3>
            <a
              href={`tel:${SITE.phoneIntl}`}
              dir="ltr"
              className="mt-2 inline-flex min-h-11 items-center text-lg font-bold text-basil-800 tabular-nums"
            >
              {SITE.phoneDisplay}
            </a>
            <div className="mt-3">
              <a
                href={whatsappUrl(SITE.whatsapp, "مرحباً JPasta 🍝")}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles("primary", "sm")}
              >
                <MessageCircle className="size-4" aria-hidden />
                واتساب
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
