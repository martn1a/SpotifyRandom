/**
 * AlbumPick — Service Worker (sw.js)
 *
 * This is a minimal "pass-through" service worker. It does NOT cache
 * anything, because AlbumPick always needs a live Spotify API connection.
 *
 * Its purpose is solely to satisfy Chrome's PWA installability requirement:
 * Chrome will only show the "Add to Home Screen" install prompt — and open
 * the app in standalone mode (no browser bar) — when a service worker is
 * registered. Without this file the manifest alone is not enough for the
 * automatic install banner to appear.
 *
 * How to deploy:
 *   Place this file in the SAME directory as index.html on GitHub Pages.
 *   e.g. your repo root should contain both:
 *     index.html   ← the AlbumPick app
 *     sw.js        ← this file
 */

const SW_VERSION = 'albumpick-sw-v1';

// Install: activate immediately without waiting for old tabs to close.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: take control of all open tabs immediately.
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Fetch: pass every request straight to the network.
// No caching — AlbumPick requires live Spotify API data.
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
