"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

type PushState = "loading" | "unsupported" | "off" | "on" | "denied";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Per-device Web Push subscription. The server sends an empty "tickle"
 * after each committed order; the service worker fetches the pending count
 * and renders the notification. No customer data crosses the push service.
 */
export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (alive) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (alive) setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (alive) setState(subscription ? "on" : "off");
    }
    void check().catch(() => {
      if (alive) setState("off");
    });
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setMessage("لم يُسمح بالإشعارات من إعدادات المتصفح.");
        return;
      }

      const keyResponse = await fetch("/api/push/public-key", {
        cache: "no-store",
      });
      if (!keyResponse.ok) {
        setMessage("الإشعارات غير مهيأة على الخادم بعد — تواصل مع المطوّر.");
        return;
      }
      const { key } = (await keyResponse.json()) as { key?: string };
      if (!key) {
        setMessage("مفتاح الإشعارات غير متاح.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(key),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        setMessage("تعذر حفظ الاشتراك — حاول مرة أخرى.");
        return;
      }
      setState("on");
      setMessage("الإشعارات مفعّلة على هذا الجهاز.");
    } catch {
      setMessage("تعذر تفعيل الإشعارات على هذا المتصفح.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("تم إيقاف الإشعارات على هذا الجهاز.");
    } catch {
      setMessage("تعذر إيقاف الإشعارات.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 text-xs text-text-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        جارٍ فحص الإشعارات…
      </span>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-text-secondary">
        هذا المتصفح لا يدعم إشعارات Web Push. استخدم Chrome أو Safari على الهاتف
        بعد تثبيت الموقع.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs font-bold text-warning">
        الإشعارات محظورة من إعدادات المتصفح — اسمح بها لهذا الموقع ثم أعد
        المحاولة.
      </p>
    );
  }

  const isOn = state === "on";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={isOn ? disable : enable}
        disabled={busy}
        className={
          isOn
            ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-5 text-sm font-bold text-text-primary disabled:opacity-50"
            : "inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-action-text disabled:opacity-50"
        }
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : isOn ? (
          <BellOff className="size-4" aria-hidden />
        ) : (
          <Bell className="size-4" aria-hidden />
        )}
        {isOn ? "إيقاف إشعارات الطلبات" : "تفعيل إشعارات الطلبات"}
      </button>
      {message && (
        <p role="status" className="text-xs text-text-secondary">
          {message}
        </p>
      )}
    </div>
  );
}
