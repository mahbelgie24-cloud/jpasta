"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { TwirlLoader } from "@/components/ui/twirl-loader";
import { consoleLogin } from "@/app/actions/console";

const KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "clear",
  "0",
  "back",
] as const;

export function PinLogin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittedFor = useRef<string | null>(null);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      try {
        const res = await consoleLogin(value);
        if (res.ok) {
          router.push("/console");
          router.refresh();
        } else {
          setError(res.error ?? "الرمز غير صحيح — حاول مجدداً.");
          setPin("");
          submittedFor.current = null;
          window.setTimeout(() => setError(null), 2600);
        }
      } catch {
        setError("تعذر الاتصال — تحقق من الشبكة وحاول مجدداً.");
        setPin("");
        submittedFor.current = null;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // A physical keyboard must work on desktop: digits, backspace, escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (busy) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        setPin((prev) => (prev + event.key).slice(0, 6));
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setPin((prev) => prev.slice(0, -1));
      } else if (event.key === "Escape") {
        setPin("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  // Auto-submit at 6 digits — via an effect so any typing speed (even
  // batched rapid input) triggers exactly one submit.
  useEffect(() => {
    if (pin.length === 6 && !busy && submittedFor.current !== pin) {
      submittedFor.current = pin;
      void submit(pin);
    }
  }, [pin, busy, submit]);

  const press = (key: (typeof KEYS)[number]) => {
    if (busy) return;
    if (key === "clear") return setPin("");
    if (key === "back") return setPin((p) => p.slice(0, -1));
    // functional update — rapid/batched clicks can never drop a digit
    setPin((prev) => (prev + key).slice(0, 6));
  };

  return (
    <div className="mt-8 w-full max-w-72">
      {/* pin dots */}
      <div
        className={`flex items-center justify-center gap-3 ${error ? "animate-pulse" : ""}`}
        aria-live="polite"
        aria-label={pin ? `${pin.length} من 6 أرقام` : "أدخل الرمز"}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={
              error
                ? "size-3.5 rounded-full bg-terracotta"
                : i < pin.length
                  ? "size-3.5 animate-pop rounded-full bg-basil-700 motion-reduce:animate-none"
                  : "size-3.5 rounded-full border-2 border-cream-400"
            }
          />
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 text-center text-sm font-bold text-terracotta"
        >
          {error}
        </p>
      )}

      {/* keypad */}
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={busy}
            aria-label={
              key === "clear" ? "مسح الكل" : key === "back" ? "حذف رقم" : key
            }
            className="flex min-h-16 items-center justify-center rounded-lg border border-cream-300 bg-cream-50 text-2xl font-bold text-ink shadow-card transition-transform active:scale-95 disabled:opacity-50"
          >
            {key === "clear" ? (
              <span className="text-sm">مسح</span>
            ) : key === "back" ? (
              <Delete className="size-6" aria-hidden />
            ) : (
              key
            )}
          </button>
        ))}
      </div>
      {busy && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
          <TwirlLoader className="size-5" label="جارٍ التحقق…" />
          جارٍ التحقق…
        </p>
      )}
    </div>
  );
}
