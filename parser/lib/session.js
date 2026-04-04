/**
 * lib/session.js
 * Album session detection algorithm.
 *
 * Converts raw Last.fm scrobbles into meaningful album listen sessions.
 *
 * The Problem:
 *   Last.fm counts every track play. One track played 100 times = 100 scrobbles
 *   on one album. That is NOT 100 album listens.
 *
 * The Solution:
 *   Group scrobbles into sessions using time gaps.
 *   A session counts as a listen only if enough of the album was covered.
 *
 * Algorithm constants (all evidence-based from real listening data):
 *   SESSION_GAP_MS     = 20 minutes — gap that splits sessions
 *   LISTEN_THRESHOLD   = 0.50       — 50% unique tracks = 1 listen
 *   PASSIVE_GAP_AVG_MS = 15 minutes — avg gap flagging background listening
 *   MIN_SESSION_TRACKS = 2          — single-track plays never count as listens
 */

const SESSION_GAP_MS       = 20 * 60 * 1000;   // 20 minutes
const LISTEN_THRESHOLD     = 0.50;              // 50% unique track coverage
const PASSIVE_AVG_GAP_MS   = 15 * 60 * 1000;   // 15 min avg gap = background
const MIN_SESSION_TRACKS   = 2;                 // need at least 2 track plays

/**
 * Compute full session stats for all albums from fadgad scrobbles.
 *
 * @param {Array} fadgad - sorted scrobble rows { artist, album, track, timestamp }
 * @param {Function} getTrackCount - (artist, album) => number | null
 * @returns {Map<"artist||album", AlbumSessionStats>}
 */
export function computeAllSessions(fadgad, getTrackCount) {
  // Group all scrobbles by album key
  const byAlbum = new Map();

  for (const row of fadgad) {
    const key = `${row.artist.toLowerCase().trim()}||${row.album.toLowerCase().trim()}`;
    if (!byAlbum.has(key)) {
      byAlbum.set(key, {
        artist: row.artist,
        album:  row.album,
        scrobbles: [],
      });
    }
    byAlbum.get(key).scrobbles.push({
      track:     row.track,
      timestamp: row.timestamp,
    });
  }

  // Process each album
  const results = new Map();

  for (const [key, { artist, album, scrobbles }] of byAlbum) {
    const trackCount = getTrackCount(artist, album);
    const stats = computeAlbumSessions(artist, album, scrobbles, trackCount);
    results.set(key, stats);
  }

  return results;
}

/**
 * Compute session stats for a single album.
 *
 * @param {string} artist
 * @param {string} album
 * @param {Array<{track, timestamp}>} scrobbles - sorted ascending by timestamp
 * @param {number|null} knownTrackCount - from cache, null if unknown
 * @returns {AlbumSessionStats}
 */
export function computeAlbumSessions(artist, album, scrobbles, knownTrackCount) {
  if (!scrobbles.length) {
    return emptyStats(artist, album, knownTrackCount);
  }

  // Sort ascending just in case
  scrobbles.sort((a, b) => a.timestamp - b.timestamp);

  // Split scrobbles into sessions by time gap
  const sessions = splitIntoSessions(scrobbles);

  // Determine track count to use
  // If we have a known count, use it. Otherwise use max unique tracks
  // seen in any single session as a floor estimate.
  const maxSeenInSession = Math.max(
    ...sessions.map(s => new Set(s.map(x => x.track)).size)
  );
  const uniqueTracksEver = new Set(scrobbles.map(x => x.track)).size;
  const effectiveTrackCount = knownTrackCount || Math.max(uniqueTracksEver, maxSeenInSession);
  const trackCountIsEstimate = !knownTrackCount;

  // Score each session
  let listenCount = 0;
  let backgroundCount = 0;
  const sessionDetails = [];

  for (const session of sessions) {
    const scored = scoreSession(session, effectiveTrackCount);
    sessionDetails.push(scored);

    if (scored.isPassive) {
      backgroundCount++;
    } else if (scored.countsAsListen) {
      listenCount++;
    }
  }

  const timestamps = scrobbles.map(s => s.timestamp);

  return {
    artist,
    album,
    // Raw data
    rawScrobbles:       scrobbles.length,
    uniqueTracksEver,
    // Track count info
    trackCount:         effectiveTrackCount,
    trackCountIsEstimate,
    // Session-based listen counts
    listenCount,
    backgroundCount,
    sessionCount:       sessions.length,
    // Temporal data
    firstHeard:         timestamps[0],
    lastHeard:          timestamps[timestamps.length - 1],
    // For peak month calculation
    allTimestamps:      timestamps,
  };
}

/**
 * Split a sorted array of scrobbles into sessions.
 * A new session starts whenever the gap between two consecutive scrobbles
 * exceeds SESSION_GAP_MS (20 minutes).
 */
function splitIntoSessions(scrobbles) {
  if (!scrobbles.length) return [];

  const sessions = [];
  let current = [scrobbles[0]];

  for (let i = 1; i < scrobbles.length; i++) {
    const gap = scrobbles[i].timestamp - scrobbles[i - 1].timestamp;
    if (gap > SESSION_GAP_MS) {
      sessions.push(current);
      current = [];
    }
    current.push(scrobbles[i]);
  }
  sessions.push(current);

  return sessions;
}

/**
 * Score a single session to determine if it counts as a listen.
 *
 * @param {Array<{track, timestamp}>} session
 * @param {number} totalTrackCount - known or estimated total tracks on album
 * @returns {SessionScore}
 */
function scoreSession(session, totalTrackCount) {
  const uniqueTracksInSession = new Set(session.map(s => s.track));
  const coverage = uniqueTracksInSession.size / totalTrackCount;
  const totalPlays = session.length;

  // Calculate average gap between consecutive scrobbles
  let avgGapMs = 0;
  if (session.length > 1) {
    const gaps = [];
    for (let i = 1; i < session.length; i++) {
      gaps.push(session[i].timestamp - session[i - 1].timestamp);
    }
    avgGapMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  // Passive/background detection:
  // If tracks arrive very slowly (avg gap > 15min), it's likely ambient/background
  const isPassive = avgGapMs > PASSIVE_AVG_GAP_MS && session.length > 2;

  // Loop detection:
  // If scrobbles >> unique tracks, the album is being looped.
  // We count each "pass" through the album as its own potential listen.
  const loopRatio = totalPlays / Math.max(uniqueTracksInSession.size, 1);
  const isLooping = loopRatio >= 2.0 && uniqueTracksInSession.size >= 3;

  let countsAsListen = false;

  if (isPassive) {
    // Background sessions never count as primary listens
    countsAsListen = false;
  } else if (isLooping) {
    // For looping sessions: count each complete pass (>= threshold coverage)
    // The session itself counts as 1 if coverage in first pass >= threshold.
    // Additional loops are already represented by the same session counter.
    countsAsListen = coverage >= LISTEN_THRESHOLD;
  } else {
    // Normal session: counts if enough of the album was covered
    countsAsListen = coverage >= LISTEN_THRESHOLD && totalPlays >= MIN_SESSION_TRACKS;
  }

  return {
    trackCount:            session.length,
    uniqueTracks:          uniqueTracksInSession.size,
    coverage:              Math.round(coverage * 100) / 100,
    avgGapMs:              Math.round(avgGapMs),
    isPassive,
    isLooping,
    countsAsListen,
    startTs:               session[0].timestamp,
    endTs:                 session[session.length - 1].timestamp,
  };
}

/**
 * Compute peak listening month for an album from its timestamps.
 * Returns ISO string like "2022-01".
 */
export function computePeakMonth(timestamps) {
  if (!timestamps.length) return null;

  const monthCounts = new Map();
  for (const ts of timestamps) {
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  }

  let peak = null;
  let peakCount = 0;
  for (const [month, count] of monthCounts) {
    if (count > peakCount) {
      peakCount = count;
      peak = month;
    }
  }
  return peak;
}

/**
 * Compute monthly listening density across all scrobbles.
 * Used for the Stats tab timeline chart.
 */
export function computeMonthlyTimeline(fadgad) {
  const monthly = new Map();

  for (const row of fadgad) {
    const d = new Date(row.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly.has(key)) {
      monthly.set(key, { scrobbles: 0, uniqueAlbums: new Set() });
    }
    const entry = monthly.get(key);
    entry.scrobbles++;
    entry.uniqueAlbums.add(`${row.artist}||${row.album}`);
  }

  // Convert to sorted array
  const result = [];
  for (const [month, data] of monthly) {
    result.push({
      month,
      scrobbles:    data.scrobbles,
      uniqueAlbums: data.uniqueAlbums.size,
    });
  }

  return result.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Compute decade distribution from a list of album stats + release years.
 */
export function computeDecadeBreakdown(albumStats) {
  const decades = new Map();

  for (const stats of albumStats.values()) {
    const year = stats.releaseYear;
    if (!year || year < 1900) continue;

    const decade = Math.floor(year / 10) * 10;
    const key = `${decade}s`;
    const prev = decades.get(key) || { decade: key, albums: 0, listens: 0 };
    prev.albums++;
    prev.listens += stats.listenCount;
    decades.set(key, prev);
  }

  return [...decades.values()].sort((a, b) => a.decade.localeCompare(b.decade));
}

function emptyStats(artist, album, trackCount) {
  return {
    artist,
    album,
    rawScrobbles: 0,
    uniqueTracksEver: 0,
    trackCount: trackCount || 0,
    trackCountIsEstimate: !trackCount,
    listenCount: 0,
    backgroundCount: 0,
    sessionCount: 0,
    firstHeard: null,
    lastHeard: null,
    allTimestamps: [],
  };
}
