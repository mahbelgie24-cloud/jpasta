"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker in production only. Registration is
 * non-blocking and failures are silent — the app works without it.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Offline support is an enhancement, never a hard dependency.
      });
  }, []);

  return null;
}
