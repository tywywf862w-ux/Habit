// Offline app-shell cache for the Habits PWA.
//
// IMPORTANT: HTML is served network-first (always try to fetch the latest
// version; only fall back to the cached copy if there's no connection).
// A cache-first strategy here would mean every time the app is updated and
// redeployed, installed devices would keep showing the OLD cached page
// until an unrelated cache-bust happened -- exactly the "my fix isn't
// showing up" problem. Static assets (icons, manifest) rarely change, so
// those stay cache-first for speed.

const CACHE_NAME = 'habits-cache-v2';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isHTML(req) {
  return req.mode === 'navigate' || req.destination === 'document' || req.url.endsWith('.html') || req.url.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return; // cross-origin (fonts, etc.) -- straight to network
  }

  if (isHTML(req)) {
    // Network-first: always get the freshest page when online.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest).
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
