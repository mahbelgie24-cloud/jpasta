"use client";

import { useEffect, useState } from "react";
import { shopOpenState, type ShopHoursSpec } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

/**
 * Live open/closed indicator for the shop (13:00 → 01:00, Asia/Hebron by
 * default). Server components pass the owner-configured hours from the
 * settings table via `hours`. Recomputes every minute; the initial render
 * is hydration-safe because the label is suppressed from mismatch warnings
 * at the day boundary.
 */
export function OpenStatus({
  className,
  tone = "light",
  hours,
}: {
  className?: string;
  tone?: "light" | "dark";
  hours?: ShopHoursSpec;
}) {
  const [state, setState] = useState(() => shopOpenState(new Date(), hours));

  useEffect(() => {
    const timer = window.setInterval(
      () => setState(shopOpenState(new Date(), hours)),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, [hours]);

  return (
    <span
      data-testid="open-status"
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
