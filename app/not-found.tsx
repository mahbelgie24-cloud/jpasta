import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center px-4 text-center"
    >
      <LogoMark className="size-20" />
      <h1 className="mt-6 type-section text-ink">ضل الطبق؟</h1>
      <p className="mt-3 max-w-sm text-ink-soft">
        الصفحة اللي تبحث عنها مش موجودة — بس الباستا موجودة دايماً.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={buttonStyles("secondary", "md")}>
          الرئيسية
        </Link>
        <Link href="/menu" className={buttonStyles("primary", "md")}>
          القائمة
        </Link>
      </div>
    </main>
  );
}
