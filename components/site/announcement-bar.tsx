import { Clock, MapPin } from "lucide-react";
import { SITE } from "@/lib/site";

/** Announcement bar — hours + delivery promise, above the header. */
export function AnnouncementBar() {
  return (
    <div className="bg-basil-900 text-cream-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2 text-center type-micro">
        <span className="inline-flex items-center gap-1.5 font-bold">
          <Clock className="size-3.5 text-wheat-300" aria-hidden />
          {SITE.hoursLabel}
        </span>
        <span className="hidden h-3 w-px bg-cream-50/20 sm:block" aria-hidden />
        <span className="inline-flex items-center gap-1.5 text-cream-100/85">
          <MapPin className="size-3.5 text-wheat-300" aria-hidden />
          توصيل داخل قلقيلية — {SITE.addressAr}
        </span>
      </div>
    </div>
  );
}
