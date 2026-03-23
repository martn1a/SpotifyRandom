// ── Album Discovery PWA — Service Worker ──────────────────────────────────────
// Cache strategy: cache-first for shell assets, network-only for Spotify API.
// IndexedDB (not Cache API) is used for all app data.

const CACHE_NAME = 'album-discovery-v1';
const SHELL_ASSETS = ['/SpotifyRandom/', '/SpotifyRandom/index.html', '/SpotifyRandom/manifest.json'];
const API_HOSTS    = ['api.spotify.com', 'accounts.spotify.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS).catch(() => {}); // non-fatal if offline at install
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Spotify API calls — they need fresh network responses
  if (API_HOSTS.includes(url.hostname)) return;
  // Don't cache cross-origin requests (fonts handled by browser cache)
  if (url.origin !== self.location.origin && url.hostname !== 'fonts.googleapis.com') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        return response;
      }).catch(() => caches.match('/index.html')); // offline fallback → shell
    })
  );
});
