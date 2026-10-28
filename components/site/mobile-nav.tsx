"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Menu, MessageCircle, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { OpenStatus } from "@/components/site/open-status";
import { SITE } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

const LINKS = [
  { href: "/menu", label: "القائمة والطلب" },
  { href: "/#featured", label: "أطباق التوقيع" },
  { href: "/#visit", label: "موقعنا وأوقاتنا" },
  { href: "/privacy", label: "سياسة الخصوصية" },
];

/** Mobile navigation — native <dialog> gives focus trap, Esc and inert. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح القائمة"
        aria-expanded={open}
        className="flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-200 hover:text-ink"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <dialog
        ref={ref}
        aria-label="التنقل الرئيسي"
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-brand-deep p-0 text-cream-50 backdrop:bg-brand-deep/70"
      >
        <div className="flex h-full flex-col px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <Logo tone="light" size="sm" />
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="إغلاق القائمة"
              className="flex size-11 items-center justify-center rounded-full text-cream-100 transition-colors hover:bg-cream-50/10"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="mt-3">
            <OpenStatus tone="dark" />
          </div>

          <nav aria-label="روابط" className="mt-8 flex-1">
            <ul className="space-y-1">
              {LINKS.map((link, i) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => ref.current?.close()}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-3 font-display-ar text-2xl font-bold text-cream-50 transition-colors hover:bg-cream-50/5"
                  >
                    <span>{link.label}</span>
                    <span
                      className="font-sans text-xs font-bold text-wheat-300/60 tabular-nums"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-3 border-t border-cream-50/10 pt-5">
            <a
              href={`tel:${SITE.phoneIntl}`}
              dir="ltr"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-cream-50/20 text-sm font-bold text-cream-100"
            >
              {SITE.phoneDisplay}
            </a>
            <a
              href={whatsappUrl(SITE.whatsapp, "مرحباً JPasta — بدي أطلب")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-wheat-300 text-sm font-bold text-basil-950"
            >
              <MessageCircle className="size-4" aria-hidden />
              اطلب عبر واتساب
              <ArrowLeft className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </dialog>
    </div>
  );
}
