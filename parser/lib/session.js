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
 * Algorithm constants:
 *   SESSION_GAP_MS     = 8 hours  — gap that splits sessions (covers pauses within a day)
 *   LISTEN_THRESHOLD   = 0.50     — 50% unique tracks = 1 listen
 *   MIN_SESSION_TRACKS = 2        — single-track plays never count as listens
 *
 * Background detection removed: passive/ambient sessions count the same as active ones.
 * Loop counting fixed: each full pass through the album counts as a separate listen.
 */

const SESSION_GAP_MS       = 8 * 60 * 60 * 1000;  // 8 hours
const LISTEN_THRESHOLD     = 0.50;                  // 50% unique track coverage
const MIN_SESSION_TRACKS   = 2;                     // need at least 2 track plays

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
  const sessionDates = [];

  for (const session of sessions) {
    const scored = scoreSession(session, effectiveTrackCount);
    sessionDetails.push(scored);

    if (scored.listenCount > 0) {
      listenCount += scored.listenCount;
      sessionDates.push(scored.startTs);
    }
  }

  const timestamps = scrobbles.map(s => s.timestamp);
  const uniqueListeningDays = new Set(timestamps.map(t => new Date(t).toDateString())).size;

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
    sessionCount:       sessions.length,
    // Temporal data
    firstHeard:         timestamps[0],
    lastHeard:          timestamps[timestamps.length - 1],
    // For peak month calculation
    allTimestamps:      timestamps,
    // New v2 fields
    sessionDates,
    uniqueListeningDays,
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
 * Score a single session to determine how many listens it counts as.
 *
 * @param {Array<{track, timestamp}>} session
 * @param {number} totalTrackCount - known or estimated total tracks on album
 * @returns {SessionScore}
 */
function scoreSession(session, totalTrackCount) {
  const uniqueTracksInSession = new Set(session.map(s => s.track));
  const coverage = uniqueTracksInSession.size / totalTrackCount;
  const totalPlays = session.length;

  // Loop detection: scrobbles >> unique tracks → album is being looped.
  // Each full pass through the album counts as a separate listen.
  const loopRatio = totalPlays / Math.max(uniqueTracksInSession.size, 1);
  const isLooping = loopRatio >= 2.0 && uniqueTracksInSession.size >= 3;

  let listenCount = 0;

  if (isLooping) {
    // Count each complete pass as its own listen
    const passes = Math.floor(totalPlays / totalTrackCount);
    if (coverage >= LISTEN_THRESHOLD && passes >= 1) listenCount = passes;
  } else {
    if (coverage >= LISTEN_THRESHOLD && totalPlays >= MIN_SESSION_TRACKS) listenCount = 1;
  }

  return {
    trackCount:   session.length,
    uniqueTracks: uniqueTracksInSession.size,
    coverage:     Math.round(coverage * 100) / 100,
    isLooping,
    listenCount,
    startTs:      session[0].timestamp,
    endTs:        session[session.length - 1].timestamp,
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
    sessionCount: 0,
    firstHeard: null,
    lastHeard: null,
    allTimestamps: [],
    sessionDates: [],
    uniqueListeningDays: 0,
  };
}
