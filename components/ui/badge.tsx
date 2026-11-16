import type { Badge } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

const badgeStyles: Record<Badge, { label: string; className: string }> = {
  bestseller: {
    label: "الأكثر طلباً",
    className: "bg-wheat-300 text-text-primary",
  },
  new: { label: "جديد", className: "bg-brand-subtle text-brand-strong" },
  spicy: { label: "حار", className: "bg-danger/12 text-danger" },
  fresh: { label: "طازج", className: "bg-action text-action-text" },
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
