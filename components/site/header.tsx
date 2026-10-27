import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/** Sticky glass header — logo, single nav anchor, and the order CTA. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 glass-bar">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="JPasta — الرئيسية" className="rounded-xs">
          <Logo size="sm" />
        </Link>
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden items-center gap-1 sm:flex"
        >
          <Link
            href="/#featured"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-cream-200 hover:text-ink"
          >
            أطباقنا
          </Link>
          <Link
            href="/#visit"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:bg-cream-200 hover:text-ink"
          >
            موقعنا وأوقاتنا
          </Link>
        </nav>
        <Link href="/menu" className={buttonStyles("primary", "sm")}>
          اطلب الآن
        </Link>
      </div>
    </header>
  );
}
