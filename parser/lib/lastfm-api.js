/**
 * lib/lastfm-api.js
 * Fetches album track counts from the Last.fm API.
 *
 * Endpoint: album.getInfo
 * Rate limit: 5 requests/second (free tier)
 * No auth required beyond an API key.
 *
 * Get a free API key at: https://www.last.fm/api/account/create
 */

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const RATE_LIMIT_MS = 200;      // 5 req/sec = 1 req per 200ms
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

let _apiKey = null;
let _lastRequestTime = 0;

/**
 * Set the API key. Call this once at startup.
 */
export function setApiKey(key) {
  _apiKey = key;
}

/**
 * Rate-limited fetch — ensures we never exceed 5 req/sec.
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  _lastRequestTime = Date.now();
  return fetch(url);
}

/**
 * Fetch track count for a single album from Last.fm.
 * Returns: { trackCount: number, tracks: string[] } or null on failure.
 */
export async function fetchAlbumInfo(artist, album) {
  if (!_apiKey) {
    throw new Error('Last.fm API key not set. Call setApiKey() first.');
  }

  const url = new URL(LASTFM_BASE);
  url.searchParams.set('method', 'album.getinfo');
  url.searchParams.set('api_key', _apiKey);
  url.searchParams.set('artist', artist);
  url.searchParams.set('album', album);
  url.searchParams.set('format', 'json');
  url.searchParams.set('autocorrect', '1');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await rateLimitedFetch(url.toString());

      // Rate limited
      if (res.status === 429) {
        console.warn(`    ⚠ Rate limited by Last.fm, waiting 10s...`);
        await sleep(10000);
        continue;
      }

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      // Last.fm returns error codes inside the JSON body for "not found"
      if (data.error) {
        // Error 6 = "Album not found" — not a real error, just missing data
        if (data.error === 6) return null;
        console.warn(`    ⚠ Last.fm API error ${data.error}: ${data.message}`);
        return null;
      }

      const trackList = data?.album?.tracks?.track;
      if (!trackList) return null;

      // Last.fm returns a single object (not array) when there's only 1 track
      const tracks = Array.isArray(trackList) ? trackList : [trackList];
      const trackNames = tracks.map(t => t.name).filter(Boolean);

      return {
        trackCount: trackNames.length,
        tracks: trackNames,
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
 * Batch fetch track counts for multiple albums.
 * Reports progress via onProgress callback.
 *
 * @param {Array<{artist, album, albumId}>} albums
 * @param {Function} onProgress (done, total, lastAlbum) => void
 * @returns {Map<"artist||album", {trackCount, tracks}>}
 */
export async function batchFetchTrackCounts(albums, onProgress) {
  const results = new Map();
  let done = 0;

  for (const { artist, album } of albums) {
    const result = await fetchAlbumInfo(artist, album);
    if (result) {
      results.set(`${artist.toLowerCase().trim()}||${album.toLowerCase().trim()}`, result);
    }
    done++;
    if (onProgress) onProgress(done, albums.length, `${artist} — ${album}`);
  }

  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
