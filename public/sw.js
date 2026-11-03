/* JPasta service worker — app shell, offline ordering, push-ready. */
const VERSION = "jpasta-v3";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

const PRECACHE = [
  "/",
  "/menu",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-monochrome-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache authenticated console/API traffic.
  if (
    url.pathname.startsWith("/console") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/order/")
  ) {
    return;
  }

  // Navigations: network-first, fall back to the cached shell/offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        }),
    );
    return;
  }

  // Product media: immutable cache-first.
  if (url.pathname.startsWith("/api/media/")) {
    event.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* Web Push — empty pushes are a "tickle": fetch the count, then notify.
   A non-empty payload ({ title, body, url }) is still supported. */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      if (event.data) {
        try {
          payload = event.data.json();
        } catch {
          payload = { body: event.data.text() };
        }
      }
      if (!payload.title && !payload.body) {
        let count = null;
        try {
          const response = await fetch("/api/console/pending-count", {
            credentials: "include",
            cache: "no-store",
          });
          if (response.ok) count = (await response.json()).count;
        } catch {
          // Offline or expired session — the generic message still works.
        }
        payload = {
          title: "JPasta — طلب جديد",
          body:
            typeof count === "number" && count > 0
              ? `طلبات في الطابور الآن: ${count}`
              : "وصل طلب جديد — افتح لوحة الطلبات",
          url: "/console",
        };
      }
      await self.registration.showNotification(payload.title || "JPasta", {
        body: payload.body || "طلب جديد وصل",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-monochrome-512.png",
        dir: "rtl",
        lang: "ar",
        vibrate: [120, 60, 120],
        tag: payload.tag || "jpasta-order",
        renotify: true,
        data: { url: payload.url || "/console" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/console";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(target) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
