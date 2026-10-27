import { cn } from "@/lib/utils";

/**
 * Section heading — the numbered eyebrow (Arabic-Indic indices ٠١, ٠٢ …)
 * + hairline rule, one consistent rhythm across the landing (spec §12.1).
 */

interface Props {
  index: string;
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "start" | "center";
  tone?: "light" | "dark";
  className?: string;
}

const arabicIndex: Record<string, string> = {
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
};

export function SectionHeading({
  index,
  eyebrow,
  title,
  sub,
  align = "center",
  tone = "dark",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-start",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-3 text-sm font-bold tracking-wide",
          align === "center" && "justify-center",
          tone === "light" ? "text-wheat-300" : "text-basil-600",
        )}
      >
        <span
          className={cn(
            "h-px w-8",
            tone === "light" ? "bg-cream-50/30" : "bg-basil-300",
          )}
          aria-hidden
        />
        <span aria-hidden className="font-display">
          {arabicIndex[index] ?? index}
        </span>
        <span>{eyebrow}</span>
        <span
          className={cn(
            "h-px w-8",
            tone === "light" ? "bg-cream-50/30" : "bg-basil-300",
          )}
          aria-hidden
        />
      </p>
      <h2
        className={cn(
          "mt-3 type-section text-balance",
          tone === "light" ? "text-cream-50" : "text-ink",
        )}
      >
        {title}
      </h2>
      {sub && (
        <p
          className={cn(
            "mt-3 type-body text-pretty",
            tone === "light" ? "text-cream-100/80" : "text-ink-soft",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
