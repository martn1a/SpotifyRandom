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
 *   node index.js                  — normal run
 *   node index.js --dry-run        — parse + session compute, skip API fetches
 *   node index.js --force-refetch  — ignore cache, re-fetch all track counts
 *
 * Environment:
 *   LASTFM_API_KEY — required unless --dry-run (set in .env file)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadAll, albumKey } from './lib/csv-reader.js';
import {
  loadCache, saveCache, getCached, setCached, isCached,
  getCacheStats, mergeSpotifyExport, SOURCE,
} from './lib/cache.js';
import { setApiKey, fetchAlbumInfo } from './lib/lastfm-api.js';
import { fetchByMbId, buildMbIdMap } from './lib/musicbrainz.js';
import {
  computeAllSessions, computePeakMonth,
  computeMonthlyTimeline, computeDecadeBreakdown,
} from './lib/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR  = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'lastfm-data.json');
const SPOTIFY_EXPORT_PATH = path.join(__dirname, 'data', 'track_counts_cache_spotify.json');

const PARSER_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const FORCE_FETCH  = args.includes('--force-refetch');
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
      setCached(artist, album, lfResult.trackCount, SOURCE.LASTFM);
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
        setCached(artist, album, mbResult.trackCount, SOURCE.MUSICBRAINZ);
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

    output[key] = {
      artist:              stats.artist,
      name:                stats.album,
      albumId:             mbId,
      // Track count
      trackCount:          stats.trackCount,
      trackCountSource:    stats.trackCountIsEstimate ? SOURCE.ESTIMATE : (getCached(stats.artist, stats.album)?.source || SOURCE.ESTIMATE),
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
      // Trend
      trend,
      recentPlays:         recent,
    };
  }

  return output;
}

function buildArtistOutput(artistsSummary) {
  const output = {};
  for (const a of artistsSummary) {
    output[a.name.toLowerCase().trim()] = {
      name:      a.name,
      scrobbles: a.scrobbles,
      tracks:    a.tracks,
      rank:      a.rank,
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
  const artistOutput = buildArtistOutput(artists);
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
