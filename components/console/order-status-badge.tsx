import {
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/order-labels";
import { cn } from "@/lib/utils";

/**
 * Status chip: icon + Arabic label + a semantic tone. Colour never carries
 * the meaning alone (WCAG 1.4.1); the console and kitchen use the same
 * status vocabulary as the board.
 */
const CONFIG: Record<
  OrderStatusKey,
  { icon: typeof Clock; className: string }
> = {
  received: { icon: Clock, className: "bg-surface-sunken text-text-primary" },
  preparing: { icon: ChefHat, className: "bg-brand/15 text-brand-strong" },
  ready: { icon: PackageCheck, className: "bg-warning/15 text-warning" },
  completed: {
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  cancelled: { icon: XCircle, className: "bg-danger/10 text-danger" },
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatusKey;
  className?: string;
}) {
  const config = CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        config.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
