"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast system — transient feedback that must not steal focus: an
 * aria-live="polite" stack pinned above the safe area, auto-dismissed.
 * The pill is always brand-deep with light text (correct contrast in all
 * three themes); status color rides the icon only — never color alone.
 * Inline form errors stay inline (role="alert"); toasts are for
 * app-level events (offline replay, background syncs).
 */

type ToastVariant = "info" | "success" | "danger";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ToastFn = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ToastFn | null>(null);

const DISMISS_MS = 4000;

const variantIcon: Record<
  ToastVariant,
  React.ComponentType<{ className?: string }>
> = {
  info: Info,
  success: CheckCircle2,
  danger: TriangleAlert,
};

const variantIconClass: Record<ToastVariant, string> = {
  info: "text-accent",
  success: "text-success",
  danger: "text-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback<ToastFn>((message, variant = "info") => {
    const id = nextId.current;
    nextId.current += 1;
    setItems((current) => [...current, { id, message, variant }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((t) => t.id !== id));
    }, DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50",
          "flex flex-col items-center gap-2",
        )}
      >
        {items.map((item) => {
          const Icon = variantIcon[item.variant];
          return (
            <p
              key={item.id}
              className={cn(
                "pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-brand-deep px-4 py-2.5",
                "animate-fade-up text-sm font-bold text-cream-50 shadow-overlay motion-reduce:animate-none",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  variantIconClass[item.variant],
                )}
                aria-hidden
              />
              {item.message}
            </p>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return toast;
}
