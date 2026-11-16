import Link from "next/link";
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
    body: "الصوص، نوع الباستا، والإضافات — كل شي بضغطة.",
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
            className="relative rounded-card border border-border-soft bg-surface-raised p-6 pt-8 shadow-card"
          >
            <span
              aria-hidden
              className="absolute start-6 -top-5 flex size-10 items-center justify-center rounded-full bg-action font-display text-lg font-bold text-action-text shadow-card"
            >
              {s.title.charAt(0)}
            </span>
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface text-brand shadow-card">
              <s.icon className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 type-title text-text-primary">
              {s.title.slice(3)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-10 text-center">
        <Link
          href="/menu"
          prefetch={false}
          className={buttonStyles("primary", "lg")}
        >
          ابدأ الطلب الآن
        </Link>
      </div>
    </section>
  );
}
