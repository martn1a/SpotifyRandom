# Album Discovery — React Rebuild
## Architecture Decision Record & Build Plan

> Created: April 2026  
> Status: Pre-build — decisions confirmed, implementation pending  
> Repo: github.com/martn1a/SpotifyRandom

---

## 1. Project Overview

A personal music discovery app. Spotify is used for the album library and playback. Last.fm provides 8 years of listening history (2018–2026) for statistical enrichment, carousels, and session-based play counts. The app is built for personal use only — one user, no multi-tenancy, no backend server.

**Core idea:** Spotify tells you *what* is in your library. Last.fm tells you *how* you actually listen to it.

---

## 2. Confirmed Technology Decisions

| Concern | Decision | Reason |
|---|---|---|
| Frontend framework | React (Vite) | Clean rebuild, component architecture |
| Backend | None | Personal app, GitHub Pages compatible, no server to maintain |
| Database | IndexedDB (via idb) | Same as original app, works offline, browser-native |
| Hosting | GitHub Pages or local | Personal use only |
| Styling | Tailwind CSS | Replaces inline CSS from original monolith |
| State management | React Context + hooks | No Redux needed at this scale |
| Auth | Spotify PKCE OAuth | No client secret exposed, works without backend |

---

## 3. Data Sources & Their Roles

### 3.1 Spotify (runtime, in-app)
- **Primary library source** — saved albums are the canonical collection
- **Track counts** — `GET /albums/{id}/tracks` returns `tracks.total`, used to populate track count cache on first sync
- **Playback** — queue albums to active Spotify player
- **NOT used for** — listening history, play counts, stats, recommendations

### 3.2 Last.fm (via exported CSVs + parser)
- **Listening history** — 76,540 scrobbles, Feb 2018 → Mar 2026
- **Statistical enrichment** — play counts, session counts, trends, carousels
- **NOT the library source** — Last.fm albums do not replace Spotify saved albums

### 3.3 Last.fm API (parser only, not in-app)
- Fetch track counts for albums not in Spotify library
- Rate limit: 5 requests/second
- Only called for albums with ≥ 3 scrobbles (skips ~6,500 one-scrobble albums)

### 3.4 MusicBrainz API (parser only, fallback)
- Fallback when Last.fm API cannot find an album
- Uses MusicBrainz AlbumIds already present in fadgad export (35% of albums)
- Rate limit: 1 request/second

---

## 4. Raw Last.fm Data

### 4.1 Export Files (semicolon-separated CSVs, UTF-8 BOM)

| File | Rows | Columns | Purpose |
|---|---|---|---|
| `lastfmstats-fadgad.csv` | 76,540 | Artist, Album, AlbumId, Track, Date#fadgad | Full timestamped scrobble log — primary data source |
| `lastfmstats-albums-export.csv` | 14,589 | Artist, Name, Scrobbles, Rank | Album-level totals |
| `lastfmstats-artists-export.csv` | 8,711 | Name, Tracks, Scrobbles, Rank | Artist-level totals |
| `lastfmstats-tracks-export.csv` | 26,520 | Artist, Name, Scrobbles, Rank | Track-level totals |

### 4.2 Key Data Facts
- **Date range:** 2018-02-23 to 2026-03-31
- **Top artist:** Quantic (606 scrobbles)
- **Top album:** Bonobo — Fragments (387 scrobbles)
- **Albums with MusicBrainz ID in fadgad:** ~5,105 (35%)
- **Albums without MB ID:** ~9,484 (65%)
- **Albums with only 1 scrobble:** 6,504 (45% of all albums) — mostly single plays, not saved
- **Albums with ≥ 10 scrobbles:** 1,692 — core listening library, almost certainly in Spotify

### 4.3 Important Export Behaviour
Every Last.fm export is always the **complete history from day one** — there is no "export since date X". The parser handles this: it always reads the full CSVs but only performs API calls for albums not already in the track count cache.

---

## 5. Album Session Logic

### 5.1 The Problem
Last.fm counts every track play. If you play one track from an album 100 times, Last.fm shows 100 album scrobbles. This is not the same as 100 album listens. The app needs **session-based** album listen counts.

### 5.2 Why Track Counts Are Required
To calculate what percentage of an album was heard in a session, you need to know the total number of tracks on the album. This data does not exist in the Last.fm export files — it must be fetched externally.

### 5.3 Track Count Sources (priority order)

1. **Spotify library sync** (free, exact) — when app fetches saved albums, `tracks.total` is in the response. Written to `track_counts_cache.json` automatically on first sync.
2. **Last.fm API `album.getInfo`** — for albums not in Spotify library with ≥ 3 scrobbles (~3,550 albums, ~12 min first run)
3. **MusicBrainz API** — fallback for albums Last.fm doesn't know, using AlbumId already in fadgad
4. **Unique tracks seen** — floor estimate only, for single-scrobble albums where precision doesn't matter

### 5.4 Session Detection Algorithm

```
SESSION WINDOW: 20 minutes
  If gap between consecutive scrobbles from the same album exceeds 20 minutes
  → start a new session

LISTEN THRESHOLD: 50% unique track coverage
  If a session covers ≥ 50% of the album's unique tracks
  → count as 1 album listen

LOOP DETECTION:
  If (unique tracks in session / total scrobbles in session) < 0.5
  → album is being looped; count each full loop as a separate session
  → a loop counts as a listen if it covers ≥ 50% of tracks

PASSIVE LISTENING FLAG:
  If average gap between scrobbles in a session > 15 minutes
  → flag session as "background" (e.g. Max Richter - Sleep playing overnight)
  → stored separately, not counted in primary listen count
  → can be displayed as "background plays" in stats

STORED VALUES PER ALBUM:
  - raw_scrobbles: total track plays from Last.fm
  - listen_count: sessions meeting the 50% threshold
  - background_count: passive/background sessions
  - first_heard: timestamp of first scrobble
  - last_heard: timestamp of most recent scrobble
  - peak_month: calendar month with highest play density
```

### 5.5 Real Data Examples

**Bonobo — Fragments (12 tracks):**
Jan 15 2022: 44 scrobbles, 08:55–11:59. Album looped ~3.5 times.
→ Session algorithm detects ~3 full loops, each ≥ 50% coverage = **3 listens**
→ Raw Last.fm shows 44 scrobbles for that day alone

**Max Richter — Sleep (102 tracks, 8-hour album):**
Mar 4 2021: 100 scrobbles, avg gap 202 minutes.
→ Flagged as background session (avg gap > 15 min)
→ Counted as **background plays**, not primary listens

---

## 6. Parser Architecture

### 6.1 Overview

A Node.js script that runs locally. Never runs in the browser. Ships in the same repo as the React app under `/parser`.

```
/parser
  index.js          — main entry point
  lib/
    csv-reader.js   — parse the 4 Last.fm CSV files
    session.js      — session detection algorithm
    lastfm-api.js   — Last.fm album.getInfo fetcher
    musicbrainz.js  — MusicBrainz fallback fetcher
    cache.js        — read/write track_counts_cache.json
  data/
    (input CSVs go here)
    track_counts_cache.json   — persistent, never deleted, only appended
  output/
    lastfm-data.json          — consumed by React app
```

### 6.2 Parser Run Flow

```
1. Read track_counts_cache.json (existing knowledge)
2. Read 4 Last.fm CSV files
3. Identify albums with ≥ 3 scrobbles not already in cache
4. Fetch track counts:
   a. Last.fm API (5/sec) — primary
   b. MusicBrainz API (1/sec) — fallback using AlbumId from fadgad
   c. Unique-tracks-seen — final fallback
5. Update track_counts_cache.json with new entries
6. Run session detection algorithm on fadgad data
7. Output lastfm-data.json
```

### 6.3 First Run vs. Incremental

| | First run | Subsequent runs |
|---|---|---|
| Albums to process | ~3,550 (≥3 scrobbles, no Spotify overlap) | ~154 new albums/month |
| API calls needed | ~3,550 | ~154 |
| Estimated time | ~12 minutes | ~30 seconds |
| Cache state | Empty → populated | Already populated |

### 6.4 Output: `lastfm-data.json` Schema

```json
{
  "meta": {
    "generatedAt": 1234567890000,
    "scrobbleCount": 76540,
    "dateRange": { "from": "2018-02-23", "to": "2026-03-31" },
    "parserVersion": "1.0.0"
  },
  "albums": {
    "Artist||Album Name": {
      "artist": "Bonobo",
      "name": "Fragments",
      "albumId": "musicbrainz-uuid-or-null",
      "trackCount": 12,
      "trackCountSource": "spotify|lastfm|musicbrainz|estimate",
      "rawScrobbles": 387,
      "listenCount": 31,
      "backgroundCount": 2,
      "firstHeard": 1642089600000,
      "lastHeard": 1721908800000,
      "peakMonth": "2022-01"
    }
  },
  "artists": {
    "Quantic": {
      "totalScrobbles": 606,
      "uniqueTracks": 77,
      "rank": 1
    }
  },
  "timeline": [
    { "ts": 1519409337000, "artist": "Quantic", "album": "Magnetica", "track": "Painting Silhouettes" }
  ],
  "stats": {
    "topAlbums": [],
    "topArtists": [],
    "listeningByMonth": {},
    "listeningByDecade": {},
    "genreBreakdown": {}
  }
}
```

---

## 7. React App Architecture

### 7.1 Data Flow

```
App starts
  ↓
Load lastfm-data.json (static file, instant)
  ↓
Spotify PKCE login (if not authenticated)
  ↓
Fetch saved albums → GET /me/albums
  Write track counts to track_counts_cache.json (export button or auto)
  ↓
Merge: Spotify library + lastfm-data enrichment
  ↓
Render tabs
```

### 7.2 Spotify API Endpoints Used (post-Feb 2026 changelog)

All confirmed still available:

| Endpoint | Purpose |
|---|---|
| `GET /me` | User profile |
| `GET /me/albums` | Saved album library |
| `GET /albums/{id}/tracks` | Track count on first sync |
| `GET /me/playlists` | User playlists (for carousel enrichment) |
| `GET /playlists/{id}/items` | Playlist contents (renamed from /tracks) |
| `POST /me/player/queue` | Queue album to active player |
| `GET /me/player` | Current playback state |

**Removed endpoints to avoid** (Feb 2026):
- `GET /albums` (batch) — removed, use single `GET /albums/{id}`
- `GET /artists` (batch) — removed
- `GET /me/top/{type}` — still available, but not needed (Last.fm provides better history data)

### 7.3 V1 Feature Set (Lean Start)

**Tab 1 — Discover**
- Random album picker from Spotify library
- Filters: genre cluster, decade, never heard, not recently played
- Queue selected album to Spotify
- "Album of the Day" card (seeded random, consistent per day)

**Tab 2 — Library**
- Browse all Spotify saved albums
- Search by title, artist, genre
- Filter sheet (genre, decade, type)
- Sort (recently added, release year, most played)
- Last.fm play count badge on each album

**Tab 3 — Stats**
- Last.fm carousels (home screen style):
  - 👑 Most Played (session-based)
  - 🔭 Latest Discoveries
  - 🕰️ Golden Oldies (heard first 2+ years ago, still playing)
  - 📈 Biggest Climbers
  - 📉 Biggest Fallers
  - 🎵 Because You Played (similar artist)
  - 📅 On This Day (scrobbles from this date in past years)
- Decade breakdown bar chart
- Genre breakdown

**Tab 4 — Listen Later**
- Save albums to a local queue
- Sort by added date, artist, release year

**Explicitly deferred to v2+:**
- Burn Mode
- Lens (album grid browser)
- Artist Deep Dive modal
- Playlist import carousels
- Seasonal favorites
- MusicBrainz genre enrichment
- Auto Last.fm API sync (manual import only for v1)

---

## 8. File Structure

```
/
├── README.md
├── ARCHITECTURE.md              ← this file
├── package.json
│
├── /parser                      ← runs locally, never in browser
│   ├── index.js
│   ├── package.json
│   ├── lib/
│   │   ├── csv-reader.js
│   │   ├── session.js
│   │   ├── lastfm-api.js
│   │   ├── musicbrainz.js
│   │   └── cache.js
│   └── data/
│       ├── .gitignore           ← ignore raw CSVs and cache
│       ├── track_counts_cache.json
│       └── (Last.fm CSV exports go here)
│
├── /public
│   └── lastfm-data.json        ← parser output, committed to repo
│
└── /src
    ├── main.jsx
    ├── App.jsx
    ├── /components
    │   ├── /discover
    │   ├── /library
    │   ├── /stats
    │   └── /listen-later
    ├── /hooks
    │   ├── useSpotify.js
    │   ├── useLastfm.js
    │   └── useLibrary.js
    ├── /lib
    │   ├── spotify-api.js       ← all Spotify API calls
    │   ├── auth.js              ← PKCE OAuth flow
    │   ├── db.js                ← IndexedDB via idb
    │   ├── filters.js           ← album filtering logic
    │   └── session.js           ← session count helpers (read-only, parser does computation)
    └── /data
        └── genre-clusters.js   ← the 8 genre cluster definitions
```

---

## 9. Build Sequence

The order in which things will be built:

1. **Parser script** — foundation, produces the data the app needs
   - CSV reader
   - Track count fetcher (Last.fm API + MusicBrainz fallback)
   - Session algorithm
   - JSON output
   
2. **React app scaffold** — Vite + React + Tailwind, tab shell, routing

3. **Spotify auth + library sync** — PKCE login, album fetch, track count cache export

4. **Library tab** — browse, search, filter (works without Last.fm data)

5. **lastfm-data.json integration** — load and merge with Spotify library

6. **Discover tab** — random picker, filters, queue to Spotify

7. **Stats tab** — carousels driven by Last.fm session data

8. **Listen Later tab** — local save queue

9. **Polish** — animations, empty states, error handling, PWA manifest

---

## 10. Open Questions (to resolve during build)

- [ ] **Session threshold confirmation:** Is 50% unique track coverage the right threshold, or do you prefer 70%? (discussed but not finalised)
- [ ] **Loop counting:** One album looped 3 times = 1 listen or 3? (your intuition pending)
- [ ] **Background listening:** Should Max Richter – Sleep type sessions count at 0.5 weight, or 0?
- [ ] **Scrobble minimum for API fetch:** Confirmed ≥ 3 scrobbles triggers track count fetch. Still correct?
- [ ] **Playlist carousels (v2):** Which playlists specifically? Auto-detect all owned playlists or manual selection?
- [ ] **Last.fm API key:** Needed for parser. Where to store? `.env` file in `/parser`
- [ ] **Genre source for Last.fm-only albums:** Spotify provides genres via artist endpoint — but `GET /artists` (batch) was removed Feb 2026. Must use `GET /artists/{id}` one at a time. Worth it for v1 or defer?

---

*This document reflects all architectural decisions made in the design session of April 2026. Update as decisions are finalised during build.*
