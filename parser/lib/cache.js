/**
 * lib/cache.js
 * Persistent track count cache — the heart of incremental updates.
 *
 * Stores: "Artist||Album" → { trackCount, source, fetchedAt }
 *
 * This file grows over time and is NEVER deleted — only appended.
 * On each parser run, albums already in the cache skip the API fetch entirely.
 *
 * The cache can also be seeded from the React app's Spotify library sync,
 * which exports a track_counts_cache.json with exact Spotify track counts.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { albumKey } from './csv-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '..', 'data', 'track_counts_cache.json');

// Source priority labels — for transparency in output JSON
export const SOURCE = {
  SPOTIFY:      'spotify',      // from Spotify library sync (most accurate)
  LASTFM:       'lastfm',       // from Last.fm album.getInfo API
  MUSICBRAINZ:  'musicbrainz',  // from MusicBrainz API (using AlbumId)
  ESTIMATE:     'estimate',     // unique tracks seen — fallback only
};

let _cache = null;  // Map<key, { trackCount, source, fetchedAt }>

/**
 * Load cache from disk. Creates empty cache if file doesn't exist.
 */
export function loadCache() {
  if (_cache) return _cache;

  if (existsSync(CACHE_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
      _cache = new Map(Object.entries(raw));
      console.log(`  ✓ Track count cache: ${_cache.size.toLocaleString()} entries loaded`);
    } catch (e) {
      console.warn(`  ⚠ Cache file corrupt, starting fresh: ${e.message}`);
      _cache = new Map();
    }
  } else {
    console.log('  ℹ No cache file found — will be created after first run');
    _cache = new Map();
  }

  return _cache;
}

/**
 * Save cache to disk (pretty-printed for readability and git diffs).
 */
export function saveCache() {
  if (!_cache) return;
  const obj = Object.fromEntries(_cache);
  writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  console.log(`  ✓ Cache saved: ${_cache.size.toLocaleString()} entries`);
}

/**
 * Get track count for an album. Returns null if not cached.
 */
export function getCached(artist, album) {
  const cache = loadCache();
  return cache.get(albumKey(artist, album)) || null;
}

/**
 * Store a track count result in the cache.
 */
export function setCached(artist, album, trackCount, source) {
  const cache = loadCache();
  cache.set(albumKey(artist, album), {
    trackCount,
    source,
    fetchedAt: Date.now(),
  });
}

/**
 * Check if an album is already in the cache.
 */
export function isCached(artist, album) {
  const cache = loadCache();
  return cache.has(albumKey(artist, album));
}

/**
 * Get cache statistics for reporting.
 */
export function getCacheStats() {
  const cache = loadCache();
  const bySource = {};
  for (const entry of cache.values()) {
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  }
  return { total: cache.size, bySource };
}

/**
 * Merge in a Spotify-exported track count cache.
 * The React app exports this after its first library sync.
 * Spotify data always wins — it's the most accurate source.
 *
 * Expected format: { "Artist||Album": trackCount, ... }
 * (simple number values, exported by the React app)
 */
export function mergeSpotifyExport(spotifyExportPath) {
  if (!existsSync(spotifyExportPath)) {
    console.log('  ℹ No Spotify export found at:', spotifyExportPath);
    return 0;
  }

  try {
    const raw = JSON.parse(readFileSync(spotifyExportPath, 'utf8'));
    const cache = loadCache();
    let merged = 0;

    for (const [key, value] of Object.entries(raw)) {
      const trackCount = typeof value === 'number' ? value : value?.trackCount;
      if (!trackCount || trackCount < 1) continue;

      // Spotify always wins — overwrite any existing entry
      cache.set(key, {
        trackCount,
        source: SOURCE.SPOTIFY,
        fetchedAt: Date.now(),
      });
      merged++;
    }

    console.log(`  ✓ Merged ${merged} track counts from Spotify export`);
    return merged;
  } catch (e) {
    console.warn(`  ⚠ Could not merge Spotify export: ${e.message}`);
    return 0;
  }
}
