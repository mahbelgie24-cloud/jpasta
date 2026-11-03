"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

/** Route-level error boundary — Arabic, branded, recoverable. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error:", error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <LogoMark className="size-20" />
      <h1 className="mt-6 font-display-ar type-section text-ink">
        صار في مشكلة
      </h1>
      <p className="mt-3 max-w-sm type-body text-text-secondary">
        ما قدرنا نكمّل هالصفحة. جرّب تحديثها — وإذا استمرت المشكلة، راسلنا على
        واتساب.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 font-bold text-action-text"
      >
        <RotateCcw className="size-4" aria-hidden />
        إعادة المحاولة
      </button>
    </main>
  );
}
