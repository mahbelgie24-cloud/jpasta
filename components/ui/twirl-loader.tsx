import { cn } from "@/lib/utils";

/**
 * TwirlLoader — the brand's motion signature: the pasta nest twirling on
 * the fork. The single loading indicator across storefront and console.
 */
export function TwirlLoader({
  className,
  label = "جارٍ التحميل…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block", className)}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
        className="size-full animate-twirl motion-reduce:animate-none"
      >
        {/* pasta nest — three offset strands forming the spiral */}
        <path
          d="M24 10c-8 0-13 5-13 11s5.5 11 13 11 12-4.6 12-10c0-4.8-4-8-9-8s-8.6 3-8.6 6.8c0 3.2 2.6 5.2 5.9 5.2 2.7 0 4.7-1.6 4.7-3.8"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M24 10c8 0 13 5 13 11"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* fork tines */}
        <path
          d="M24 3.5v4M20 4v3.5M28 4v3.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* basil leaf accent */}
        <path
          d="M34.5 6.5c1.8-1.8 4.5-2 4.5-2s-.2 2.7-2 4.5c-1.4 1.4-3.2 1.7-4.1 1.6.1-.9.4-2.7 1.6-4.1Z"
          fill="currentColor"
          opacity="0.8"
        />
      </svg>
    </span>
  );
}
