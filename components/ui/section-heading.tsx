import { cn } from "@/lib/utils";

/**
 * Section heading — the numbered eyebrow (Arabic-Indic indices ٠١, ٠٢ …)
 * + hairline rule, one consistent rhythm across the landing (spec §12.1).
 */

interface Props {
  id?: string;
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
  "01": "٠١",
  "02": "٠٢",
  "03": "٠٣",
  "04": "٠٤",
  "05": "٠٥",
  "06": "٠٦",
};

export function SectionHeading({
  id,
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
        id={id}
        className={cn(
          "mt-3 font-display-ar type-section text-balance",
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
