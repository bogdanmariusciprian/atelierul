// =========================================================
// Service worker — CONSERVATIVE, network-first.
//   • Online users ALWAYS get fresh content (no staleness after a deploy).
//   • Successful same-origin GETs are cached as a copy.
//   • Offline → serve from cache, falling back to the home shell.
//   • Cross-origin (Supabase, Google, esm.sh CDN) is left untouched so
//     auth / data / ES-module loading never go through the cache.
// =========================================================
const CACHE = "atelier-v1";
const SHELL = ["/", "/favicon.svg", "/manifest.webmanifest", "/assets/logo/logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // don't touch Supabase / Google / CDN

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("/")))
  );
});
