import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { HeaderLogo } from "@/components/brand/logo";
import { MobileNav } from "@/components/site/mobile-nav";
import { getShopSettings } from "@/lib/server/settings";

/** Sticky glass header — logo, nav, mobile menu, and the order CTA. */
export async function Header() {
  const shop = await getShopSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-line glass-bar">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-4">
        {/* The horizontal plaque is the header lockup; the roundel stays on
            the footer, status pages, console and app icons. */}
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xs">
          <HeaderLogo priority />
        </Link>
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden items-center gap-1 sm:flex"
        >
          <Link
            href="/menu"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            القائمة
          </Link>
          <Link
            href="/#featured"
            className="inline-flex min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            أطباقنا
          </Link>
          <Link
            href="/#visit"
            className="inline-flex min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            موقعنا وأوقاتنا
          </Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <MobileNav
            hours={shop}
            phone={shop.shopPhone}
            whatsapp={shop.whatsapp}
          />
          <Link
            href="/menu"
            prefetch={false}
            className={buttonStyles("primary", "sm")}
          >
            اطلب الآن
          </Link>
        </div>
      </div>
    </header>
  );
}
