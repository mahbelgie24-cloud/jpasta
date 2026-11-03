import { Clock, MapPin } from "lucide-react";
import { OpenStatus } from "@/components/site/open-status";
import { getShopSettings } from "@/lib/server/settings";

/** Announcement bar — live open state, owner-configured hours, delivery promise. */
export async function AnnouncementBar() {
  const shop = await getShopSettings();
  return (
    <div className="bg-brand-deep text-cream-100">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2 text-center type-micro">
        <OpenStatus tone="dark" hours={shop} />
        <span className="hidden h-3 w-px bg-cream-50/20 sm:block" aria-hidden />
        <span className="inline-flex items-center gap-1.5 font-bold">
          <Clock className="size-3.5 text-wheat-300" aria-hidden />
          {shop.hoursLabel}
        </span>
        <span className="hidden h-3 w-px bg-cream-50/20 sm:block" aria-hidden />
        <span className="hidden items-center gap-1.5 text-cream-100/75 sm:inline-flex">
          <MapPin className="size-3.5 text-wheat-300" aria-hidden />
          توصيل داخل قلقيلية
        </span>
      </div>
    </div>
  );
}
