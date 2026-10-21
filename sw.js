// Gentle Gut service worker: makes the app work offline and shows check-in notifications.
// Bump VERSION whenever app files change so installed copies pick up the update.
const VERSION = "gentle-gut-v8";
const APP_FILES = [
  "./",
  "index.html",
  "styles.css",
  "config.js",
  "app.js",
  "sync.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's HTTP cache, so the offline copy is always the new version.
  const requests = APP_FILES.map((u) => new Request(u, { cache: "reload" }));
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: network first (so updates show up), falling back to cache when offline.
// Fonts: cache first, since they never change.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Fonts and the pinned Supabase library never change, so they are cached on first use.
  const isFont = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"].includes(url.hostname);
  if (url.origin !== location.origin && !isFont) return;

  if (isFont) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // "no-cache" makes the browser check the server for a newer copy instead of reusing its HTTP cache,
  // so a fresh index.html is never paired with an old app.js after an update.
  // (Page navigations can't take extra fetch options, so they're re-requested by URL.)
  const fresh = req.mode === "navigate" ? fetch(req.url, { cache: "no-cache" }) : fetch(req, { cache: "no-cache" });
  event.respondWith(
    fresh
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
  );
});

// Tapping a check-in notification opens (or focuses) the app on that meal.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const mealId = event.notification.data?.mealId;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins[0];
      if (win) {
        win.postMessage({ type: "open-checkin", mealId });
        return win.focus();
      }
      return self.clients.openWindow("./#meal");
    })
  );
});
