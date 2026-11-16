import { cn } from "@/lib/utils";

/**
 * Loading skeleton — pulse block on the sunken surface, aria-hidden
 * (the surrounding route announces its loading state).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none",
        className,
      )}
    />
  );
}
