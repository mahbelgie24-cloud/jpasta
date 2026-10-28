"use client";

import { useEffect, useState } from "react";
import { shopOpenState } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

/**
 * Live open/closed indicator for the shop (13:00 → 01:00, Asia/Hebron).
 * Recomputes every minute; the initial render is hydration-safe because the
 * label is suppressed from mismatch warnings at the day boundary.
 */
export function OpenStatus({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const [state, setState] = useState(() => shopOpenState());

  useEffect(() => {
    const timer = window.setInterval(() => setState(shopOpenState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "dark" ? "text-cream-100/80" : "text-inherit",
        className,
      )}
      suppressHydrationWarning
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          state.open ? "bg-pistachio-400" : "bg-bronze",
        )}
      />
      <span className="font-bold">{state.label}</span>
    </span>
  );
}
