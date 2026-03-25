// ── Album Discovery PWA — Service Worker ──────────────────────────────────────
// Cache strategy:
//   index.html  → ALWAYS network-first (no cache). New app versions are
//                 served immediately without users clearing browser cache.
//   Fonts/Icons → Cache-first (never change).
//   Spotify API → Never cached here — IndexedDB handles all app data.
//   Album art   → Cache-first with LRU eviction (max 500 images).
//
// Cache name is STATIC (albumdisc-v1) and never needs to be incremented,
// because index.html is never cached. Only bump it if sw.js itself changes.

const CACHE_NAME   = 'albumdisc-v1';
const API_HOSTS    = ['api.spotify.com', 'accounts.spotify.com'];
const ART_HOST     = 'i.scdn.co'; // Spotify album art CDN
const MAX_ART      = 500;

// ── Install: skip waiting + pre-cache only fonts/icons (NOT index.html) ───────
self.addEventListener('install', event => {
  self.skipWaiting(); // activate immediately, no waiting for old tabs to close
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap',
    ]).catch(() => {})) // non-fatal if offline at install
  );
});

// ── Activate: delete old caches + claim all clients immediately ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control without requiring a reload
  );
});

// ── Fetch: route by resource type ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Spotify API — never intercept, always network
  if (API_HOSTS.includes(url.hostname)) return;

  // 2. index.html / navigation requests — always network-first, no cache fallback
  if (event.request.mode === 'navigate' ||
      url.pathname === '/SpotifyRandom/' ||
      url.pathname === '/SpotifyRandom/index.html') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          '<h2 style="font-family:sans-serif;padding:2rem;color:#888">Offline — please reconnect to load the app.</h2>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      )
    );
    return;
  }

  // 3. Album art (Spotify CDN) — cache-first with LRU eviction (max 500)
  if (url.hostname === ART_HOST) {
    event.respondWith(artCacheFirst(event.request));
    return;
  }

  // 4. Fonts, icons, manifest — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        return response;
      });
    })
  );
});

// ── Album art: cache-first + LRU eviction at 500 images ──────────────────────
async function artCacheFirst(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (!response || response.status !== 200) return response;

    // LRU eviction: keep max 500 art images
    const keys = await cache.keys();
    const artKeys = keys.filter(k => new URL(k.url).hostname === ART_HOST);
    if (artKeys.length >= MAX_ART) {
      await cache.delete(artKeys[0]); // delete oldest
    }

    await cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}
