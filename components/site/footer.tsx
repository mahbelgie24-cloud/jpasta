import Link from "next/link";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

/** Footer — dark basil, brand lockup, contact, hours, legal links. */
export function Footer() {
  return (
    <footer className="bg-basil-950 text-cream-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Logo tone="light" size="md" />
          <p
            className="mt-4 max-w-xs font-display text-base font-semibold text-wheat-300 italic"
            dir="ltr"
          >
            “{SITE.tagline}”
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream-100/70">
            باستا طازة تُصنع يومياً في قلقيلية — صلصات بيتية ودجاج طازج، بصلصة
            كتير ومحبة.
          </p>
        </div>

        <nav aria-label="روابط سريعة">
          <h2 className="text-sm font-bold text-wheat-300">روابط سريعة</h2>
          <ul className="mt-4 space-y-1 text-sm">
            <li>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center text-cream-100/85 transition-colors hover:text-cream-50"
              >
                الرئيسية
              </Link>
            </li>
            <li>
              <Link
                href="/menu"
                className="inline-flex min-h-11 items-center text-cream-100/85 transition-colors hover:text-cream-50"
              >
                القائمة والطلب
              </Link>
            </li>
            <li>
              <Link
                href="/#featured"
                className="inline-flex min-h-11 items-center text-cream-100/85 transition-colors hover:text-cream-50"
              >
                الأطباق المفضلة
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center text-cream-100/85 transition-colors hover:text-cream-50"
              >
                سياسة الخصوصية
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-bold text-wheat-300">تواصل معنا</h2>
          <ul className="mt-4 space-y-3 text-sm text-cream-100/85">
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
              <MessageCircle
                className="mt-0.5 size-4 shrink-0 text-wheat-400"
                aria-hidden
              />
              <a
                href={whatsappUrl(SITE.whatsapp, "مرحباً JPasta 🍝")}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="font-bold tabular-nums transition-colors hover:text-cream-50"
              >
                {SITE.phoneDisplay}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cream-50/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-cream-100/60 sm:px-6">
          <p>© 2026 JPasta — جميع الحقوق محفوظة</p>
          <p dir="ltr" className="font-display italic">
            Fresh Pasta &amp; Chicken — Qalqilya
          </p>
        </div>
      </div>
    </footer>
  );
}
