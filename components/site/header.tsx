import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/site/mobile-nav";

/** Sticky glass header — logo, nav, mobile menu, and the order CTA. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line glass-bar">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="JPasta — الرئيسية" className="rounded-xs">
          <Logo size="sm" />
        </Link>
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden items-center gap-1 sm:flex"
        >
          <Link
            href="/menu"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            القائمة
          </Link>
          <Link
            href="/#featured"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            أطباقنا
          </Link>
          <Link
            href="/#visit"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            موقعنا وأوقاتنا
          </Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <MobileNav />
          <Link href="/menu" className={buttonStyles("primary", "sm")}>
            اطلب الآن
          </Link>
        </div>
      </div>
    </header>
  );
}
