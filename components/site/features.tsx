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

/** Why JPasta — value props with icons. */
export function Features() {
  return (
    <section
      className="border-y border-cream-200 bg-cream-100/60 py-16 lg:py-24"
      aria-labelledby="why-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          index="2"
          eyebrow="ليش JPasta؟"
          title="طازة مش شعار — نظام يومي كامل"
          sub="من العجين للصوص للتتبيلة: كل شي بصير اليوم، محلياً، وبكميات صغيرة متكررة."
        />
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-card border border-cream-200 bg-cream-50 p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-basil-100 text-basil-700">
                <f.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 type-title text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {f.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
