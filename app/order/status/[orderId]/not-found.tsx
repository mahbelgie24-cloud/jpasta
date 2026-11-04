import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site";

/**
 * Missing order / stale status link. Rendered by notFound() with a real
 * HTTP 404 so monitoring and crawlers see the truth instead of a soft 404.
 */
export default function OrderStatusNotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center px-4 text-center"
    >
      <LogoMark className="size-20" />
      <h1 className="mt-6 type-section text-ink">الطلب غير موجود</h1>
      <p className="mt-3 max-w-sm text-ink-soft">
        تأكد أنك فتحت الرابط الصحيح — روابط متابعة الطلب خاصة بكل طلب.
      </p>
      <p className="mt-6 text-sm text-ink-soft">
        للاستفسار:{" "}
        <span dir="ltr" className="font-bold tabular-nums">
          {SITE.phoneDisplay}
        </span>
      </p>
      <Link
        href="/menu"
        className="mt-6 inline-flex min-h-12 items-center rounded-full bg-basil-700 px-6 font-bold text-cream-50"
      >
        تصفّح القائمة
      </Link>
    </main>
  );
}
