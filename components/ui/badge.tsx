import type { Badge } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

const badgeStyles: Record<Badge, { label: string; className: string }> = {
  bestseller: {
    label: "الأكثر طلباً",
    className: "bg-wheat-300 text-basil-950",
  },
  new: { label: "جديد", className: "bg-basil-100 text-basil-800" },
  spicy: { label: "حار", className: "bg-terracotta/12 text-terracotta" },
  fresh: { label: "طازج", className: "bg-basil-700 text-cream-50" },
};

export function ProductBadge({
  badge,
  className,
}: {
  badge: Badge;
  className?: string;
}) {
  const s = badgeStyles[badge];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none font-bold",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
