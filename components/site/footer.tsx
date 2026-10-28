import Link from "next/link";
import { ArrowLeft, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

/** Footer — CTA band, brand lockup, contact, legal, oversized wordmark. */
export function Footer() {
  return (
    <footer className="texture-grain relative overflow-hidden bg-brand-deep text-cream-100">
      <span className="texture-grain-layer" aria-hidden />

      {/* CTA band */}
      <div className="relative border-b border-cream-50/10">
        <div className="container-page flex flex-col items-center justify-between gap-6 py-14 text-center sm:flex-row sm:text-start">
          <div>
            <p className="font-display-ar text-3xl font-bold text-cream-50 sm:text-4xl">
              جاهز تجرّب؟
            </p>
            <p className="mt-2 text-sm text-cream-100/65">
              اطلب الآن — الطلب بيوصل المطبخ مباشرة، وتابع حالته لحظة بلحظة.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/menu"
              className={buttonStyles(
                "primary",
                "lg",
                "bg-wheat-300 text-basil-950 hover:bg-wheat-400",
              )}
            >
              اطلب الآن
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
            <a
              href={whatsappUrl(SITE.whatsapp, "مرحباً JPasta — بدي أطلب")}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles("outline-light", "lg")}
            >
              <MessageCircle className="size-5" aria-hidden />
              واتساب
            </a>
          </div>
        </div>
      </div>

      <div className="relative container-page grid gap-10 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Logo tone="light" size="md" />
          <p
            className="mt-4 max-w-xs font-display text-base font-semibold text-wheat-300/90 italic"
            dir="ltr"
          >
            “{SITE.tagline}”
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream-100/65">
            باستا طازة تُصنع يومياً في قلقيلية — صلصات بيتية ودجاج طازج، بصلصة
            كتير ومحبة.
          </p>
        </div>

        <nav aria-label="روابط سريعة">
          <h2 className="text-sm font-bold text-wheat-300">روابط سريعة</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {[
              { href: "/", label: "الرئيسية" },
              { href: "/menu", label: "القائمة والطلب" },
              { href: "/#featured", label: "أطباق التوقيع" },
              { href: "/#visit", label: "موقعنا وأوقاتنا" },
              { href: "/privacy", label: "سياسة الخصوصية" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-11 items-center text-cream-100/75 transition-colors hover:text-cream-50"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-bold text-wheat-300">تواصل معنا</h2>
          <ul className="mt-4 space-y-3 text-sm text-cream-100/80">
            <li className="flex items-start gap-2.5">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-wheat-400"
                aria-hidden
              />
              <span>{SITE.addressAr}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock
                className="mt-0.5 size-4 shrink-0 text-wheat-400"
                aria-hidden
              />
              <span>{SITE.hoursLabel}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone
                className="mt-0.5 size-4 shrink-0 text-wheat-400"
                aria-hidden
              />
              <a
                href={`tel:${SITE.phoneIntl}`}
                dir="ltr"
                className="font-bold tabular-nums transition-colors hover:text-cream-50"
              >
                {SITE.phoneDisplay}
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* oversized wordmark */}
      <div className="relative overflow-hidden border-t border-cream-50/10 select-none">
        <p
          aria-hidden
          className="container-page -mb-4 truncate pt-8 font-display text-[clamp(4rem,16vw,13rem)] leading-none font-bold tracking-tight text-cream-50/[0.06] sm:-mb-8"
          dir="ltr"
        >
          JPasta
        </p>
      </div>

      <div className="relative border-t border-cream-50/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-cream-100/50">
          <p>© 2026 JPasta — جميع الحقوق محفوظة</p>
          <p dir="ltr" className="font-display italic">
            Fresh Pasta &amp; Chicken — Qalqilya
          </p>
        </div>
      </div>
    </footer>
  );
}
