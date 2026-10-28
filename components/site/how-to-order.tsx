import { ClipboardList, MousePointerClick, ShoppingBag } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";

const STEPS = [
  {
    icon: MousePointerClick,
    title: "١. تصفّح واختر",
    body: "افتح القائمة، شوف الأطباق بالصور والأسعار — وكل طبق بتخصصه متل ما بدك.",
  },
  {
    icon: ClipboardList,
    title: "٢. خصّص طبقك",
    body: "الحجم، الإضافات، مستوى الحرارة، ودرجة الاستواء — كل شي بضغطة.",
  },
  {
    icon: ShoppingBag,
    title: "٣. اطلب واستلم",
    body: "أرسل طلبك، وبيوصلك سخن — استلام من المحل أو توصيل داخل قلقيلية.",
  },
];

/** How to order — three steps. */
export function HowToOrder() {
  return (
    <section
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24"
      aria-labelledby="how-title"
    >
      <SectionHeading
        id="how-title"
        index="3"
        eyebrow="كيف تطلب؟"
        title="ثلاث خطوات ووجبتك عندك"
      />
      <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.title}
            className="relative rounded-card border border-cream-200 bg-cream-100 p-6 pt-8 shadow-card"
          >
            <span
              aria-hidden
              className="absolute start-6 -top-5 flex size-10 items-center justify-center rounded-full bg-basil-700 font-display text-lg font-bold text-cream-50 shadow-card"
            >
              {s.title.charAt(0)}
            </span>
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-cream-50 text-basil-700 shadow-card">
              <s.icon className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 type-title text-ink">{s.title.slice(3)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-10 text-center">
        <a href="/menu" className={buttonStyles("primary", "lg")}>
          ابدأ الطلب الآن
        </a>
      </div>
    </section>
  );
}
