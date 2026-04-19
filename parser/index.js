/**
 * index.js — Album Discovery Parser
 *
 * Entry point. Orchestrates the full pipeline:
 *   1. Load Last.fm CSV exports
 *   2. Merge Spotify track count export (if available)
 *   3. Identify albums needing track count fetch
 *   4. Fetch via Last.fm API → MusicBrainz fallback → estimate
 *   5. Run session detection algorithm
 *   6. Build and write lastfm-data.json
 *
 * Usage:
 *   node index.js                       — normal run
 *   node index.js --dry-run             — parse + session compute, skip API fetches
 *   node index.js --force-refetch       — ignore cache, re-fetch all track counts
 *   node index.js --fill-release-years  — one-time: fill releaseYear for cached entries
 *   node index.js --force-refetch-tags  — ignore tags cache, re-fetch all album tags
 *
 * Environment:
 *   LASTFM_API_KEY — required unless --dry-run (set in .env file)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadAll, albumKey } from './lib/csv-reader.js';
import {
  loadCache, saveCache, getCached, setCached, setReleaseYear, isCached,
  getCacheStats, mergeSpotifyExport, SOURCE,
} from './lib/cache.js';
import { setApiKey, fetchAlbumInfo, fetchAlbumTags } from './lib/lastfm-api.js';
import {
  loadTagsCache, saveTagsCache, getCachedTags, setCachedTags, isTagsCached,
} from './lib/album-tags-cache.js';
import { fetchByMbId, buildMbIdMap } from './lib/musicbrainz.js';
import {
  computeAllSessions, computePeakMonth,
  computeMonthlyTimeline, computeDecadeBreakdown,
} from './lib/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR  = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'lastfm-data.json');
const SPOTIFY_EXPORT_PATH = path.join(__dirname, 'data', 'track_counts_cache_spotify.json');
const SPOTIFY_LIBRARY_PATH = path.join(__dirname, 'data', 'spotify-library.json');

const PARSER_VERSION = '2.0.0';

// ─────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN            = args.includes('--dry-run');
const FORCE_FETCH        = args.includes('--force-refetch');
const FILL_RELEASE_YEARS = args.includes('--fill-release-years');
const FORCE_REFETCH_TAGS = args.includes('--force-refetch-tags');
const MIN_SCROBBLES = 3;  // Albums below this threshold skip API fetch

// ─────────────────────────────────────────────────────────────────
// Env / API key
// ─────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
}

// ─────────────────────────────────────────────────────────────────
// Progress reporter
// ─────────────────────────────────────────────────────────────────
function progress(done, total, label = '') {
  const pct = Math.round((done / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  const truncated = label.length > 45 ? label.slice(0, 42) + '...' : label.padEnd(45);
  process.stdout.write(`\r  [${bar}] ${pct}%  ${truncated}`);
  if (done === total) process.stdout.write('\n');
}

// ─────────────────────────────────────────────────────────────────
// STEP 3 — Fetch missing track counts
// ─────────────────────────────────────────────────────────────────
async function fetchMissingTrackCounts(albumsToFetch, mbIdMap) {
  const total = albumsToFetch.length;
  if (total === 0) {
    console.log('  ✓ All track counts already cached — no API calls needed');
    return;
  }

  console.log(`\n🌐 Fetching track counts for ${total.toLocaleString()} albums...`);
  if (DRY_RUN) {
    console.log('  ℹ DRY RUN — skipping API calls, using estimates');
    return;
  }

  let lastfmHits = 0, mbHits = 0, estimates = 0;
  let done = 0;

  for (const { artist, album, albumId, uniqueTracksSeen } of albumsToFetch) {
    const label = `${artist} — ${album}`;

    // 1. Try Last.fm API
    const lfResult = await fetchAlbumInfo(artist, album);
    if (lfResult && lfResult.trackCount > 0) {
      setCached(artist, album, lfResult.trackCount, SOURCE.LASTFM, lfResult.releaseYear);
      lastfmHits++;
      done++;
      progress(done, total, label);
      continue;
    }

    // 2. Try MusicBrainz (if we have an AlbumId)
    const mbId = albumId || mbIdMap.get(albumKey(artist, album));
    if (mbId) {
      const mbResult = await fetchByMbId(mbId);
      if (mbResult && mbResult.trackCount > 0) {
        setCached(artist, album, mbResult.trackCount, SOURCE.MUSICBRAINZ, mbResult.releaseYear);
        mbHits++;
        done++;
        progress(done, total, label);
        continue;
      }
    }

    // 3. Fallback: use unique tracks ever seen as floor estimate
    if (uniqueTracksSeen > 0) {
      setCached(artist, album, uniqueTracksSeen, SOURCE.ESTIMATE);
    }
    estimates++;
    done++;
    progress(done, total, label);
  }

  console.log(`\n  Results: ${lastfmHits} Last.fm ✓  ${mbHits} MusicBrainz ✓  ${estimates} estimated`);
}

// ─────────────────────────────────────────────────────────────────
// STEP 3.5 — Fetch missing album genre tags
// ─────────────────────────────────────────────────────────────────
async function fetchMissingAlbumTags(uniqueTracksSeenMap) {
  loadTagsCache();

  // Build combined album list: Last.fm scrobbles + Spotify library export
  const albumMap = new Map(); // key → { artist, album }
  for (const [key, data] of uniqueTracksSeenMap) {
    albumMap.set(key, { artist: data.artist, album: data.album });
  }
  if (existsSync(SPOTIFY_LIBRARY_PATH)) {
    try {
      const spotifyList = JSON.parse(readFileSync(SPOTIFY_LIBRARY_PATH, 'utf8'));
      for (const { artist, album } of spotifyList) {
        const key = `${artist.toLowerCase().trim()}||${album.toLowerCase().trim()}`;
        if (!albumMap.has(key)) albumMap.set(key, { artist, album });
      }
      console.log(`  ✓ Spotify library: ${spotifyList.length} albums merged`);
    } catch (e) {
      console.warn(`  ⚠ Could not load spotify-library.json: ${e.message}`);
    }
  }

  const toFetch = [...albumMap.values()].filter(({ artist, album }) =>
    FORCE_REFETCH_TAGS ? true : !isTagsCached(artist, album)
  );

  if (toFetch.length === 0) {
    console.log('  ✓ All album tags already cached — no API calls needed');
    return;
  }

  console.log(`\n🏷  Fetching genre tags for ${toFetch.length.toLocaleString()} albums...`);
  if (DRY_RUN) {
    console.log('  ℹ DRY RUN — skipping tag fetch');
    return;
  }

  const estimatedSec = Math.ceil(toFetch.length / 5);
  console.log(`  Estimated time: ~${estimatedSec < 60 ? estimatedSec + 's' : Math.ceil(estimatedSec / 60) + ' min'}`);

  let done = 0;
  for (const { artist, album } of toFetch) {
    const tags = await fetchAlbumTags(artist, album);
    setCachedTags(artist, album, tags);
    done++;
    progress(done, toFetch.length, `${artist} — ${album}`);
  }
  console.log('');

  if (!DRY_RUN) saveTagsCache();
}

// ─────────────────────────────────────────────────────────────────
// Helper: gap-based metrics
// ─────────────────────────────────────────────────────────────────
function computeAvgGapDays(dates) {
  const sorted = [...dates].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < sorted.length; i++) sum += sorted[i] - sorted[i - 1];
  return Math.round(sum / (sorted.length - 1) / 86400000 * 10) / 10;
}

function computeGapVariance(dates) {
  const sorted = [...dates].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / 86400000);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.round(gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gaps.length);
}

// ─────────────────────────────────────────────────────────────────
// STEP 5 — Build stats objects from session data
// ─────────────────────────────────────────────────────────────────
function buildAlbumOutput(
  sessionMap,    // Map<key, AlbumSessionStats>
  albumsSummary, // from albums CSV
  mbIdMap,       // Map<key, mbId>
) {
  // Index albums CSV by key for quick lookup
  const albumIndex = new Map();
  for (const a of albumsSummary) {
    albumIndex.set(albumKey(a.artist, a.name), a);
  }

  const output = {};

  for (const [key, stats] of sessionMap) {
    const csvEntry = albumIndex.get(key);
    const peakMonth = computePeakMonth(stats.allTimestamps);
    const mbId = mbIdMap.get(key) || null;

    // Compute listening trend: compare last 90 days to prior 90 days
    const now = Date.now();
    const d90 = 90 * 24 * 60 * 60 * 1000;
    const recent   = stats.allTimestamps.filter(t => t > now - d90).length;
    const previous = stats.allTimestamps.filter(t => t > now - d90 * 2 && t <= now - d90).length;
    const trend = previous === 0
      ? (recent > 0 ? 'rising' : 'flat')
      : recent > previous * 1.5 ? 'rising'
      : recent < previous * 0.5 ? 'falling'
      : 'flat';

    // New v2: release year + derived album age
    const cachedEntry = getCached(stats.artist, stats.album);
    const releaseYear = cachedEntry?.releaseYear || null;
    const firstYear = stats.firstHeard ? new Date(stats.firstHeard).getFullYear() : null;

    // New v2: gap-based metrics from sessionDates
    const sessionDates = stats.sessionDates || [];
    const avgGapDays = sessionDates.length >= 2 ? computeAvgGapDays(sessionDates) : null;

    output[key] = {
      artist:              stats.artist,
      name:                stats.album,
      albumId:             mbId,
      // Track count
      trackCount:          stats.trackCount,
      trackCountSource:    stats.trackCountIsEstimate ? SOURCE.ESTIMATE : (cachedEntry?.source || SOURCE.ESTIMATE),
      // Scrobble data
      rawScrobbles:        stats.rawScrobbles,
      rank:                csvEntry?.rank ?? 9999,
      // Session-based listen counts
      listenCount:         stats.listenCount,
      backgroundCount:     stats.backgroundCount,
      sessionCount:        stats.sessionCount,
      // Temporal
      firstHeard:          stats.firstHeard,
      lastHeard:           stats.lastHeard,
      peakMonth,
      peakYear:            peakMonth ? parseInt(peakMonth.slice(0, 4)) : null,
      // Trend
      trend,
      recentPlays:         recent,
      // New v2: richer temporal metrics
      uniqueListeningDays: stats.uniqueListeningDays,
      listeningSpanDays:   (stats.firstHeard && stats.lastHeard)
                             ? Math.round((stats.lastHeard - stats.firstHeard) / 86400000)
                             : 0,
      sessionDates,
      avgGapDays,
      releaseYear,
      albumAgeAtFirstListen: (releaseYear && firstYear) ? firstYear - releaseYear : null,
    };
  }

  return output;
}

function buildArtistOutput(artistsSummary, albumOutput) {
  // Group albums by artist key for aggregations
  const albumsByArtist = new Map();
  for (const album of Object.values(albumOutput)) {
    const artistKey = album.artist.toLowerCase().trim();
    if (!albumsByArtist.has(artistKey)) albumsByArtist.set(artistKey, []);
    albumsByArtist.get(artistKey).push(album);
  }

  const output = {};
  for (const a of artistsSummary) {
    const artistKey = a.name.toLowerCase().trim();
    const albums = albumsByArtist.get(artistKey) || [];
    const heardAlbums = albums.filter(al => al.listenCount >= 1);
    const albumCount = albums.length;
    const heardAlbumCount = heardAlbums.length;

    // Top 5 albums by listenCount
    const topAlbums = [...heardAlbums]
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 5)
      .map(al => ({
        key:         `${al.artist.toLowerCase().trim()}||${al.name.toLowerCase().trim()}`,
        name:        al.name,
        listenCount: al.listenCount,
        firstHeard:  al.firstHeard,
        lastHeard:   al.lastHeard,
      }));

    // Most recently heard album
    let mostRecentAlbum = null;
    for (const al of albums) {
      if (al.lastHeard && (!mostRecentAlbum || al.lastHeard > mostRecentAlbum.lastHeard)) {
        mostRecentAlbum = {
          key:      `${al.artist.toLowerCase().trim()}||${al.name.toLowerCase().trim()}`,
          name:     al.name,
          lastHeard: al.lastHeard,
        };
      }
    }

    // Most rediscovered: album with highest gap variance (min 3 sessions)
    let mostRediscoveredAlbum = null;
    let maxVariance = -1;
    for (const al of heardAlbums) {
      if (!al.sessionDates || al.sessionDates.length < 3) continue;
      const variance = computeGapVariance(al.sessionDates);
      if (variance > maxVariance) {
        maxVariance = variance;
        mostRediscoveredAlbum = {
          key:             `${al.artist.toLowerCase().trim()}||${al.name.toLowerCase().trim()}`,
          name:            al.name,
          gapVarianceDays: variance,
          sessionCount:    al.sessionDates.length,
        };
      }
    }

    output[artistKey] = {
      name:      a.name,
      scrobbles: a.scrobbles,
      tracks:    a.tracks,
      rank:      a.rank,
      // New v2: per-artist aggregations
      albumCount,
      heardAlbumCount,
      coveragePercent:      albumCount > 0 ? Math.round((heardAlbumCount / albumCount) * 100) : 0,
      topAlbums,
      mostRecentAlbum,
      mostRediscoveredAlbum,
    };
  }
  return output;
}

// ─────────────────────────────────────────────────────────────────
// STEP 6 — Compute derived stats (carousels, charts)
// ─────────────────────────────────────────────────────────────────
function buildDerivedStats(albumOutput, fadgad, artistsSummary) {
  const albums = Object.values(albumOutput);
  const now = Date.now();

  // Most Played — by session listen count
  const topAlbums = [...albums]
    .filter(a => a.listenCount > 0)
    .sort((a, b) => b.listenCount - a.listenCount)
    .slice(0, 50)
    .map(a => ({ key: albumKey(a.artist, a.name), listenCount: a.listenCount }));

  // Latest Discoveries — first heard in last 6 months, ≥ 2 listens
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;
  const latestDiscoveries = [...albums]
    .filter(a => a.firstHeard > sixMonthsAgo && a.listenCount >= 2)
    .sort((a, b) => b.firstHeard - a.firstHeard)
    .slice(0, 30)
    .map(a => ({ key: albumKey(a.artist, a.name), firstHeard: a.firstHeard }));

  // Golden Oldies — first heard 2+ years ago, still played in last 6 months
  const twoYearsAgo = now - 730 * 24 * 60 * 60 * 1000;
  const goldenOldies = [...albums]
    .filter(a => a.firstHeard < twoYearsAgo && a.lastHeard > sixMonthsAgo && a.listenCount >= 3)
    .sort((a, b) => b.listenCount - a.listenCount)
    .slice(0, 30)
    .map(a => ({ key: albumKey(a.artist, a.name), firstHeard: a.firstHeard, lastHeard: a.lastHeard }));

  // Biggest Climbers — rising trend with meaningful play count
  const climbers = [...albums]
    .filter(a => a.trend === 'rising' && a.recentPlays >= 3)
    .sort((a, b) => b.recentPlays - a.recentPlays)
    .slice(0, 20)
    .map(a => ({ key: albumKey(a.artist, a.name), recentPlays: a.recentPlays }));

  // Biggest Fallers — falling trend, was previously heavily played
  const fallers = [...albums]
    .filter(a => a.trend === 'falling' && a.listenCount >= 5)
    .sort((a, b) => b.listenCount - a.listenCount)
    .slice(0, 20)
    .map(a => ({ key: albumKey(a.artist, a.name), listenCount: a.listenCount }));

  // On This Day — albums scrobbled on today's month/day in past years
  const todayMD = `${new Date().getMonth() + 1}-${new Date().getDate()}`;
  const onThisDay = [...albums].filter(a => {
    return a.firstHeard && (() => {
      const d = new Date(a.firstHeard);
      return `${d.getMonth() + 1}-${d.getDate()}` === todayMD;
    })();
  }).slice(0, 20).map(a => ({ key: albumKey(a.artist, a.name), firstHeard: a.firstHeard }));

  // Monthly timeline
  const monthlyTimeline = computeMonthlyTimeline(fadgad);

  // Top artists
  const topArtists = [...artistsSummary]
    .sort((a, b) => b.scrobbles - a.scrobbles)
    .slice(0, 50);

  // Listening by hour of day (from fadgad timestamps)
  const byHour = new Array(24).fill(0);
  for (const row of fadgad) {
    const hour = new Date(row.timestamp).getHours();
    byHour[hour]++;
  }

  return {
    topAlbums,
    latestDiscoveries,
    goldenOldies,
    climbers,
    fallers,
    onThisDay,
    monthlyTimeline,
    topArtists,
    listeningByHour: byHour,
  };
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║      Album Discovery — Last.fm Parser        ║');
  console.log(`║      v${PARSER_VERSION}${DRY_RUN ? '  [DRY RUN]' : '            '}                   ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  // ── Load .env ──────────────────────────────────────────────────
  loadEnv();
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey && !DRY_RUN) {
    console.error('❌ LASTFM_API_KEY not set.');
    console.error('   Copy .env.example to .env and add your key.');
    console.error('   Get a free key at: https://www.last.fm/api/account/create');
    console.error('   Or run with --dry-run to skip API calls.');
    process.exit(1);
  }
  if (apiKey) setApiKey(apiKey);

  // ── Ensure output dir ──────────────────────────────────────────
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── FILL RELEASE YEARS MODE ────────────────────────────────────
  if (FILL_RELEASE_YEARS) {
    console.log('\n📅 --fill-release-years: fetching release years for cached albums without one\n');
    loadCache();
    const cacheMap = loadCache();
    const missing = [...cacheMap.entries()].filter(([, v]) => !v.releaseYear);
    console.log(`  ${missing.length.toLocaleString()} entries without release year`);
    if (missing.length === 0 || DRY_RUN) {
      console.log('  Nothing to do.');
      process.exit(0);
    }

    // Build a reverse lookup: key → { artist, album }
    // The cache key IS "artist||album" (lowercased) but we need original case for API calls.
    // We'll parse artist/album from the key directly.
    let done = 0;
    let filled = 0;
    for (const [key] of missing) {
      const sepIdx = key.indexOf('||');
      if (sepIdx === -1) { done++; continue; }
      const artist = key.slice(0, sepIdx);
      const album  = key.slice(sepIdx + 2);

      const lfResult = await fetchAlbumInfo(artist, album);
      if (lfResult?.releaseYear) {
        setReleaseYear(artist, album, lfResult.releaseYear);
        filled++;
      }

      done++;
      progress(done, missing.length, `${artist} — ${album}`);
    }

    saveCache();
    console.log(`\n  Filled ${filled} / ${missing.length} release years`);
    process.exit(0);
  }

  // ── STEP 1: Load CSVs ─────────────────────────────────────────
  console.log('STEP 1 — Loading Last.fm CSV exports');
  const { fadgad, albums, artists, tracks } = await loadAll();

  // ── STEP 2: Load + merge track count cache ────────────────────
  console.log('\nSTEP 2 — Loading track count cache');
  loadCache();

  // Merge Spotify export if present (Spotify track counts always win)
  const spotifyMerged = mergeSpotifyExport(SPOTIFY_EXPORT_PATH);

  if (FORCE_FETCH) {
    console.log('  ℹ --force-refetch: ignoring cache for Last.fm/MusicBrainz entries');
  }

  const cacheStatsBefore = getCacheStats();
  console.log(`  Cache state: ${cacheStatsBefore.total.toLocaleString()} total entries`);
  if (cacheStatsBefore.bySource) {
    for (const [src, count] of Object.entries(cacheStatsBefore.bySource)) {
      console.log(`    ${src}: ${count.toLocaleString()}`);
    }
  }

  // ── STEP 3: Identify albums needing track count fetch ─────────
  console.log('\nSTEP 3 — Identifying albums needing track count fetch');

  // Build MusicBrainz ID map from fadgad
  const mbIdMap = buildMbIdMap(fadgad);
  console.log(`  MusicBrainz IDs available: ${mbIdMap.size.toLocaleString()} albums`);

  // Count unique tracks seen per album (floor estimate if API fails)
  const uniqueTracksSeenMap = new Map();
  for (const row of fadgad) {
    const key = albumKey(row.artist, row.album);
    if (!uniqueTracksSeenMap.has(key)) {
      uniqueTracksSeenMap.set(key, { artist: row.artist, album: row.album, albumId: row.albumId, tracks: new Set() });
    }
    if (row.track) uniqueTracksSeenMap.get(key).tracks.add(row.track);
  }

  // Build scrobble count per album from albums CSV
  const scrobbleMap = new Map();
  for (const a of albums) {
    scrobbleMap.set(albumKey(a.artist, a.name), a.scrobbles);
  }

  // Determine which albums need fetching
  const albumsToFetch = [];
  for (const [key, data] of uniqueTracksSeenMap) {
    const scrobbles = scrobbleMap.get(key) || data.tracks.size;
    if (scrobbles < MIN_SCROBBLES) continue;  // Skip low-scrobble albums

    // Skip if already cached (unless force-refetch, but keep Spotify entries)
    if (!FORCE_FETCH && isCached(data.artist, data.album)) continue;
    if (FORCE_FETCH) {
      const existing = getCached(data.artist, data.album);
      if (existing?.source === SOURCE.SPOTIFY) continue;  // Never re-fetch Spotify data
    }

    albumsToFetch.push({
      artist:           data.artist,
      album:            data.album,
      albumId:          data.albumId,
      uniqueTracksSeen: data.tracks.size,
    });
  }

  console.log(`  Albums with ≥${MIN_SCROBBLES} scrobbles: ${[...uniqueTracksSeenMap].filter(([k]) => (scrobbleMap.get(k) || 0) >= MIN_SCROBBLES).length.toLocaleString()}`);
  console.log(`  Already cached: ${([...uniqueTracksSeenMap].filter(([k, d]) => (scrobbleMap.get(k) || 0) >= MIN_SCROBBLES && isCached(d.artist, d.album)).length).toLocaleString()}`);
  console.log(`  Need fetching:  ${albumsToFetch.length.toLocaleString()}`);

  // Estimate time
  if (albumsToFetch.length > 0 && !DRY_RUN) {
    const estimatedSec = Math.ceil(albumsToFetch.length / 5);  // 5 req/sec Last.fm
    console.log(`  Estimated time: ~${estimatedSec < 60 ? estimatedSec + 's' : Math.ceil(estimatedSec / 60) + ' min'}`);
  }

  // ── STEP 4: Fetch missing track counts ────────────────────────
  await fetchMissingTrackCounts(albumsToFetch, mbIdMap);

  // Save updated cache to disk
  if (!DRY_RUN) saveCache();

  // ── STEP 3.5: Fetch missing album genre tags ──────────────────
  console.log('\nSTEP 3.5 — Fetching album genre tags');
  await fetchMissingAlbumTags(uniqueTracksSeenMap);

  const cacheStatsAfter = getCacheStats();
  console.log(`\n  Cache now: ${cacheStatsAfter.total.toLocaleString()} entries (+${cacheStatsAfter.total - cacheStatsBefore.total})`);

  // ── STEP 5: Session detection ──────────────────────────────────
  console.log('\nSTEP 4 — Running session detection algorithm');
  console.log(`  Processing ${fadgad.length.toLocaleString()} scrobbles...`);

  // Build track count getter from cache
  function getTrackCount(artist, album) {
    const cached = getCached(artist, album);
    if (cached?.trackCount) return cached.trackCount;
    // Fallback: unique tracks ever seen
    const key = albumKey(artist, album);
    return uniqueTracksSeenMap.get(key)?.tracks.size || null;
  }

  const sessionMap = computeAllSessions(fadgad, getTrackCount);

  // Summarise session results
  let totalListens = 0, totalBackground = 0, withSessions = 0;
  for (const stats of sessionMap.values()) {
    totalListens += stats.listenCount;
    totalBackground += stats.backgroundCount;
    if (stats.listenCount > 0) withSessions++;
  }
  console.log(`  Albums processed: ${sessionMap.size.toLocaleString()}`);
  console.log(`  Albums with ≥1 listen: ${withSessions.toLocaleString()}`);
  console.log(`  Total album listens (session-based): ${totalListens.toLocaleString()}`);
  console.log(`  Background/passive sessions: ${totalBackground.toLocaleString()}`);

  // ── STEP 6: Build output JSON ──────────────────────────────────
  console.log('\nSTEP 5 — Building output JSON');

  const albumOutput  = buildAlbumOutput(sessionMap, albums, mbIdMap);
  const artistOutput = buildArtistOutput(artists, albumOutput);
  const derivedStats = buildDerivedStats(albumOutput, fadgad, artists);

  // Compact timeline for app (timestamps only need month resolution)
  const timelineCompact = fadgad.map(row => ({
    ts: row.timestamp,
    a:  row.artist,
    al: row.album,
    t:  row.track,
  }));

  const dateRange = fadgad.length > 0 ? {
    from: new Date(fadgad[0].timestamp).toISOString().slice(0, 10),
    to:   new Date(fadgad[fadgad.length - 1].timestamp).toISOString().slice(0, 10),
  } : { from: null, to: null };

  const output = {
    meta: {
      generatedAt:    Date.now(),
      parserVersion:  PARSER_VERSION,
      dateRange,
      counts: {
        scrobbles:      fadgad.length,
        albums:         Object.keys(albumOutput).length,
        artists:        Object.keys(artistOutput).length,
        tracks:         tracks.length,
        totalListens,
      },
      cacheStats: getCacheStats(),
    },
    albums:    albumOutput,
    artists:   artistOutput,
    stats:     derivedStats,
    // Full timeline — used for On This Day, seasonal features, time-based carousels
    // Compact format: ts=timestamp, a=artist, al=album, t=track
    timeline:  timelineCompact,
    albumTags: Object.fromEntries(loadTagsCache()),
  };

  // ── Write output ───────────────────────────────────────────────
  const outputJson = JSON.stringify(output, null, 2);
  writeFileSync(OUTPUT_FILE, outputJson, 'utf8');

  const fileSizeKB = Math.round(Buffer.byteLength(outputJson, 'utf8') / 1024);
  const fileSizeMB = (fileSizeKB / 1024).toFixed(1);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║                  Complete ✓                  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Output:   ${OUTPUT_FILE}`);
  console.log(`  Size:     ${fileSizeMB} MB (${fileSizeKB.toLocaleString()} KB)`);
  console.log(`  Albums:   ${Object.keys(albumOutput).length.toLocaleString()}`);
  console.log(`  Listens:  ${totalListens.toLocaleString()} sessions`);
  console.log(`  Runtime:  ${elapsed}s`);
  console.log('');
  console.log('  Next step: copy output/lastfm-data.json to your React app\'s /public folder');
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Parser failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
