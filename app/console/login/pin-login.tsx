"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2 } from "lucide-react";
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
  const [error, setError] = useState(false);
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
          setError(true);
          setPin("");
          submittedFor.current = null;
          setTimeout(() => setError(false), 1200);
        }
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

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
                  ? "size-3.5 rounded-full bg-basil-700"
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
          الرمز غير صحيح — حاول مجدداً
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
          <Loader2 className="size-4 animate-spin" aria-hidden />
          جارٍ التحقق…
        </p>
      )}
    </div>
  );
}
