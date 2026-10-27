"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on native <dialog> — showModal gives focus trapping, Esc
 * handling, and inert background for free. Always bottom-anchored: the
 * project is one-hand-reach-first (spec §12.2).
 */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Footer pinned to the sheet bottom (CTA area). */
  footer?: React.ReactNode;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-auto w-full max-w-xl rounded-t-[28px] bg-cream-50 p-0",
        "max-h-[88dvh] overflow-y-auto overscroll-contain shadow-overlay backdrop:bg-transparent",
        "animate-fade-up motion-reduce:animate-none",
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cream-200 bg-cream-50/95 px-5 py-4 backdrop-blur">
        <h2 className="type-title">{title}</h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="إغلاق"
          className="flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-200"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-5 pt-4 pb-5">{children}</div>
      {footer && (
        <div className="sticky bottom-0 border-t border-cream-200 bg-cream-50/95 px-5 py-4 backdrop-blur">
          {footer}
        </div>
      )}
    </dialog>
  );
}
