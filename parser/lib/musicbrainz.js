/**
 * lib/musicbrainz.js
 * Fetches album track counts from MusicBrainz as a fallback.
 *
 * Uses the AlbumId (MusicBrainz Release ID) already present in the fadgad export.
 * No API key required. Rate limit: 1 request/second.
 *
 * Only called when Last.fm album.getInfo returns nothing.
 */

const MB_BASE = 'https://musicbrainz.org/ws/2/';
const RATE_LIMIT_MS = 1100;   // 1 req/sec with a small buffer
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const USER_AGENT = 'AlbumDiscoveryParser/1.0 (github.com/martn1a/SpotifyRandom)';

let _lastRequestTime = 0;

/**
 * Rate-limited fetch for MusicBrainz (strict 1/sec).
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  _lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });
}

/**
 * Fetch track count for an album using its MusicBrainz Release ID.
 *
 * @param {string} mbReleaseId - MusicBrainz UUID from fadgad AlbumId field
 * @returns {{ trackCount: number, tracks: string[] } | null}
 */
export async function fetchByMbId(mbReleaseId) {
  if (!mbReleaseId || mbReleaseId.trim() === '') return null;

  // MusicBrainz release endpoint — inc=recordings gets the track list
  const url = `${MB_BASE}release/${encodeURIComponent(mbReleaseId)}?inc=recordings&fmt=json`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await rateLimitedFetch(url);

      if (res.status === 404) return null;  // Release not found — not an error

      if (res.status === 503 || res.status === 429) {
        // MusicBrainz overloaded or rate limited
        const wait = RETRY_DELAY_MS * attempt;
        console.warn(`    ⚠ MusicBrainz rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) return null;

      const data = await res.json();

      // MusicBrainz releases have "media" (discs), each with "tracks"
      const media = data?.media || [];
      if (!media.length) return null;

      const allTracks = [];
      for (const disc of media) {
        const discTracks = disc.tracks || [];
        for (const t of discTracks) {
          if (t.title) allTracks.push(t.title);
        }
      }

      if (!allTracks.length) return null;

      return {
        trackCount: allTracks.length,
        tracks: allTracks,
      };

    } catch (e) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        return null;
      }
    }
  }

  return null;
}

/**
 * Build a lookup map of albumId → MusicBrainz ID from the fadgad data.
 * Used by the main parser to know which albums can use the MB fallback.
 *
 * @param {Array} fadgad - parsed fadgad rows
 * @returns {Map<"artist||album", string>} - maps album key to MusicBrainz ID
 */
export function buildMbIdMap(fadgad) {
  const map = new Map();
  for (const row of fadgad) {
    if (!row.albumId) continue;
    const key = `${row.artist.toLowerCase().trim()}||${row.album.toLowerCase().trim()}`;
    if (!map.has(key)) {
      map.set(key, row.albumId);
    }
  }
  return map;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
