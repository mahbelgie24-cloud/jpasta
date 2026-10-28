import { Bike, ChefHat, Drumstick, Wheat } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";

const FEATURES = [
  {
    icon: Wheat,
    title: "باستا تُصنع يومياً",
    body: "عجينة طازة كل صباح — لا مجمدات، لا جاهزات. الفرق بتحسه من أول عضة.",
  },
  {
    icon: ChefHat,
    title: "صلصات بيتية",
    body: "وصفات مطبوخة على نار هادئة بنفس الطريقة اللي بتنزل عليها بالبيت — بس أحلى.",
  },
  {
    icon: Drumstick,
    title: "دجاج طازج متبّل",
    body: "نستقبل الدجاج طازج ونتبّله بنفس اليوم بتتبيلتنا السرية.",
  },
  {
    icon: Bike,
    title: "توصيل سريع",
    body: "داخل قلقيلية — الطلب بيوصلك وهو سخن وترتابه زي ما هو.",
  },
];

/** Why JPasta — a dark craft band with editorial numbering. */
export function Features() {
  return (
    <section
      className="texture-grain relative overflow-hidden bg-brand-deep py-20 text-cream-50 lg:py-28"
      aria-labelledby="why-title"
    >
      <span className="texture-grain-layer" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,oklch(0.45_0.08_90_/_0.18)_0%,transparent_60%)]"
      />

      <div className="relative container-page grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="why-title"
            index="02"
            eyebrow="ليش JPasta؟"
            title="طازة مش شعار — نظام يومي كامل"
            sub="من العجين للصوص للتتبيلة: كل شي بصير اليوم، محلياً، وبكميات صغيرة متكررة."
            align="start"
            tone="light"
          />
          <p
            className="mt-8 font-display text-2xl leading-snug text-wheat-300/90 italic"
            dir="ltr"
          >
            “No freezers. No shortcuts. Just today.”
          </p>
        </div>

        <ul className="divide-y divide-cream-50/10 border-y border-cream-50/10">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="group flex items-start gap-5 py-6 transition-colors hover:bg-cream-50/[0.03]"
            >
              <span
                className="mt-1 font-display text-sm font-bold text-wheat-300/60 tabular-nums"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-cream-50/10 bg-cream-50/5 text-wheat-300 transition-colors group-hover:border-wheat-300/30">
                <f.icon className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="type-title text-cream-50">{f.title}</h3>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-cream-100/65">
                  {f.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative container-page mt-16 grid grid-cols-3 gap-4 border-t border-cream-50/10 pt-8 text-center">
        <div>
          <p className="font-display text-4xl font-bold text-wheat-300">18</p>
          <p className="mt-1 text-xs text-cream-100/60">طبقاً على القائمة</p>
        </div>
        <div>
          <p className="font-display text-4xl font-bold text-wheat-300">4</p>
          <p className="mt-1 text-xs text-cream-100/60">صلصات بيتية</p>
        </div>
        <div>
          <p className="font-display text-4xl font-bold text-wheat-300">1:00</p>
          <p className="mt-1 text-xs text-cream-100/60">ظهراً — نفتح كل يوم</p>
        </div>
      </div>
    </section>
  );
}
