/**
 * Random Album Selector — Service Worker
 *
 * Strategy: Cache-first for the app shell (HTML file).
 * Spotify API calls and font requests always go to the network —
 * caching them would cause stale tokens and outdated library data.
 *
 * Bump CACHE_NAME whenever the HTML file changes to force an update.
 */

const CACHE_NAME = 'random-album-selector-v1';

// Files that make up the app shell (everything needed to render the UI)
const SHELL = [
  '/SpotifyRandom/random-album-picker.html',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())  // activate immediately, don't wait for old SW to die
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())  // take control of all open tabs immediately
  );
});

// ── Fetch: cache-first for shell, network-only for everything else ────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Spotify API or Accounts calls — always needs fresh tokens
  if (url.hostname === 'api.spotify.com' || url.hostname === 'accounts.spotify.com') {
    return;  // let the browser handle it normally
  }

  // Never intercept Google Fonts — network or nothing
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return;
  }

  // For same-origin requests (the app shell): cache-first, fall back to network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
  }
});
