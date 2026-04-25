import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { albumKey } from './csv-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '..', 'data', 'album-tags-cache.json');

let _cache = null;

export function loadTagsCache() {
  if (_cache) return _cache;
  if (existsSync(CACHE_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
      _cache = new Map(Object.entries(raw));
      console.log(`  ✓ Album tags cache: ${_cache.size.toLocaleString()} entries loaded`);
    } catch (e) {
      console.warn(`  ⚠ Tags cache corrupt, starting fresh: ${e.message}`);
      _cache = new Map();
    }
  } else {
    console.log('  ℹ No album tags cache found — will be created after first run');
    _cache = new Map();
  }
  return _cache;
}

export function saveTagsCache() {
  if (!_cache) return;
  const obj = Object.fromEntries(_cache);
  writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  console.log(`  ✓ Album tags cache saved: ${_cache.size.toLocaleString()} entries`);
}

export function getCachedTags(artist, album) {
  const cache = loadTagsCache();
  return cache.get(albumKey(artist, album)) ?? null;
}

export function setCachedTags(artist, album, tags) {
  const cache = loadTagsCache();
  cache.set(albumKey(artist, album), tags);
}

export function isTagsCached(artist, album) {
  const cache = loadTagsCache();
  return cache.has(albumKey(artist, album));
}
