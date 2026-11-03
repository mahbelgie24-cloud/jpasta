import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description:
    "كيف نتعامل مع بياناتك في JPasta — نجمعها ببساطة، ونستخدمها لخدمتك فقط.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  {
    title: "ما نجمعه",
    body: "عند إرسال طلب نجمع الاسم ورقم الهاتف والعنوان (لطلبات التوصيل) والملاحظات التي تكتبها فقط. لا نطلب بريداً إلكترونياً، ولا نستخدم ملفات تتبع إعلانية أو أدوات تحليل تسويقية.",
  },
  {
    title: "كيف يُخزَّن طلبك",
    body: "طلبك يُرسل مباشرة إلى نظام المحل (وليس عبر واتساب). تُخزَّن بيانات الطلب في قاعدة بيانات المحل لتجهيز الطلب والفوترة والتقارير، وتُشفَّر حقول الاسم والهاتف والعنوان والملاحظات أثناء التخزين في بيئة الإنتاج. الوصول إليها مقصور على المالك والموظفين المخوّلين عبر جلسة محمية.",
  },
  {
    title: "الطلب أثناء انقطاع الشبكة",
    body: "إذا انقطعت الشبكة لحظة الإرسال، يُحفظ الطلب مؤقتاً على جهازك (في متصفحك) ويُرسل تلقائياً عند عودة الاتصال، ثم يُحذف من جهازك بعد نجاح الإرسال. لا يُرسل الطلب أكثر من مرة بفضل معرّف فريد لكل طلب.",
  },
  {
    title: "المشاركة والاحتفاظ",
    body: "لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض تسويقية. تُحفظ سجلات الطلبات للمحاسبة والتقارير، ثم تُحذف أو تُجهَّل عند انتهاء الحاجة إليها. واتساب اختياري تماماً؛ إن اخترت مشاركة الطلب عبره فتنطبق سياسة واتساب الخاصة به.",
  },
  {
    title: "حقوقك",
    body: "يمكنك طلب حذف بياناتك أو تصحيحها في أي وقت — راسلنا على الرقم المعروض في الصفحة وسنستجيب. آخر تحديث لهذه السياسة: نوفمبر 2026.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-12 sm:px-6"
      >
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
