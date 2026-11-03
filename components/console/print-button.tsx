"use client";

import { Printer } from "lucide-react";

/** The receipt page is a server component; the browser owns the print dialog. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-action-text shadow-card transition-colors hover:bg-action-hover"
    >
      <Printer className="size-4" aria-hidden />
      طباعة الإيصال
    </button>
  );
}
