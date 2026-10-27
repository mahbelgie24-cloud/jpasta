import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description:
    "كيف نتعامل مع بياناتك في JPasta — ن جمعها ببساطة، ونستخدمها لخدمتك فقط.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  {
    title: "ما نجمعه",
    body: "عند إرسال طلب، نستخدم الاسم ورقم الهاتف والعنوان (لطلبات التوصيل) فقط لتجهيز طلبك والتواصل معك بشأنه. لا نجمع أي بيانات أخرى، ولا نستخدم ملفات تتبع إعلانية.",
  },
  {
    title: "أين تذهب بياناتك",
    body: "بيانات الطلب تُرسل عبر واتساب إلى رقم المحل لمعالجة الطلب، وتُخزّن في نظام المحل لأغراض التشغيل فقط (الفواتير، التقارير). لا نبيع أو نشارك بياناتك مع أي طرف ثالث لأغراض تسويقية.",
  },
  {
    title: "حقوقك",
    body: "بإمكانك طلب حذف بياناتك أو تصحيحها في أي وقت — راسلنا على الرقم المعروض في الصفحة وسنستجيب فوراً.",
  },
  {
    title: "التحديثات",
    body: "إن تغيّرت هذه السياسة، سنحدّث هذه الصفحة بتاريخ آخر تعديل. آخر تحديث: أكتوبر 2026.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-basil-700 hover:text-basil-600"
        >
          <ArrowRight className="size-4" aria-hidden />
          رجوع للرئيسية
        </Link>
        <h1 className="mt-6 type-section text-ink">سياسة الخصوصية</h1>
        <p className="mt-3 text-ink-soft">
          الخصوصية عندنا بسيطة: نجمع أقل شي ممكن، ونستخدمه لخدمتك فقط.
        </p>
        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded-card border border-cream-200 bg-cream-100 p-6 shadow-card"
            >
              <h2 className="type-title text-ink">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-ink-soft">{s.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/menu" className={buttonStyles("primary", "lg")}>
            تصفّح القائمة
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
