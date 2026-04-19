# Genre Overhaul — Design Spec
Date: 2026-04-19

## Problem

The current genre system has three independent bugs:

1. **33% No Genre** — `_genres` comes from Spotify artist-level tags, which are missing for niche/European/underground artists. 389 of ~1,189 albums have no genre assignment.
2. **Counting inconsistency** — LibraryTab counts albums per cluster using multi-membership (one album can appear in multiple clusters); DiscoverTab FilterModal uses first-match-wins. Electronic shows 488 in Library vs 414 in Discover for this reason.
3. **Metal = 0 bug** — The keyword "alternative" appears in Rock's cluster before Metal's. Artists tagged "alternative metal" match Rock first and never reach Metal.

## Goal

- Dramatically reduce No Genre albums by using Last.fm album-level tags (community-curated, better coverage for European/underground artists)
- Make Library and Discover genre counts consistent
- Fix the Metal keyword ordering bug

## Architecture

### Data Flow

```
[Spotify Export Button] → spotify-library.json (parser input)
[Last.fm CSV exports]   → parser input (always present)
         ↓
    Parser deduplicates album list from both sources
         ↓
    album.getTopTags (Last.fm API) per album → cached in parser
         ↓
    lastfm-data.json: albumTags map added
         ↓
    useLastfm.js exposes albumTags Map
         ↓
    useLibrary.js: _genres = lastfm album tags ?? spotify artist tags
```

### Genre Priority (per album)

1. Last.fm `album.getTopTags` — top 3-5 tags, filtered to known cluster keywords
2. Spotify artist tags — existing fallback (already fetched in Phase 2)
3. Empty — album shows in "No Genre"

## Existing Infrastructure (relevant)

The parser already provides:
- `LASTFM_API_KEY` env var loaded from `parser/.env` — no new setup needed
- `parser/lib/lastfm-api.js` — rate-limited (5 req/sec), retry logic, `setApiKey()` already wired
- `parser/lib/cache.js` — persistent cache pattern with `mergeSpotifyExport()` reading from `parser/data/track_counts_cache_spotify.json`
- `parser/index.js` already reads `SPOTIFY_EXPORT_PATH = parser/data/track_counts_cache_spotify.json`

## Components

### 1. Parser — `fetchAlbumTags` in `lastfm-api.js`

**File:** `parser/lib/lastfm-api.js`

Add a new `fetchAlbumTags(artist, album)` function alongside the existing `fetchAlbumInfo`:
- Calls `album.getTopTags` endpoint (same base URL, same API key)
- Returns top 5 tags by count, lowercased, filtered to non-empty strings
- Returns `[]` on error or not-found (graceful degradation)
- Reuses existing rate limiting and retry logic

### 2. Parser — Album tags cache + fetch pass

**File:** `parser/lib/album-tags-cache.js` (new, modeled after `cache.js`)

- Persistent cache: `parser/data/album-tags-cache.json`, keyed by `artist||album` (same normalization as existing cache)
- API: `loadTagsCache()`, `getCachedTags(artist, album)`, `setCachedTags(artist, album, tags[])`, `saveTagsCache()`

**File:** `parser/index.js`

Add new pipeline step after existing track count fetch:
1. Build album list from two sources (deduplicated):
   - `parser/data/spotify-library.json` — list of `{artist, album}` objects (if file exists)
   - All albums known from Last.fm CSV scrobble data
2. For each album not in tags cache: call `fetchAlbumTags()`
3. Save tags cache to disk
4. Include `albumTags` map in `lastfm-data.json` output

New CLI flag: `--force-refetch-tags` — ignores tags cache, re-fetches all.

### 3. App — Export Button

**File:** `src/components/layout/Header.jsx` (Settings modal)

- New "Export Library for Parser" button
- Extracts `{ artist: album.artists[0].name, album: album.name }` from loaded albums
- Triggers browser download of `spotify-library.json`
- User places this file in `parser/data/` — same pattern as existing `track_counts_cache_spotify.json`
- Only shown when albums are loaded (not during albumsLoading)

### 3. App — `useLastfm.js`

- Parse `albumTags` from `lastfm-data.json`
- Expose as `albumTagsMap: Map<normalizedKey, string[]>`
- Use same `normalizeAlbumKey()` function already used for listen count matching

### 4. App — `useLibrary.js`

- Accept `albumTagsMap` as parameter (passed from App.jsx)
- In Phase 2 (after Spotify artist tags load), supplement each album:
  ```
  const lfmTags = albumTagsMap.get(normalizeKey(album))
  album._genres = lfmTags?.length ? lfmTags : (spotifyArtistTags ?? [])
  ```
- `genresLoading` state stays — still needed for the Spotify fallback fetch

### 5. App — Genre counting unification

**Files:** `src/components/discover/DiscoverTab.jsx`, `src/components/library/LibraryTab.jsx`

Both tabs use the same counting logic: multi-membership with dedup per album (LibraryTab's current approach — already correct). DiscoverTab FilterModal's `genreCounts` gets updated to match.

Filtering logic (already correct in both tabs): album passes filter if it has ANY genre matching the selected cluster.

### 6. `genre-clusters.js` — Fix Metal ordering

Move `'metal'` keywords earlier in the keyword list, or reorder `GENRE_CLUSTERS` so Metal appears before Rock. Specifically: ensure "alternative metal", "post-metal", "prog metal" don't accidentally match Rock's "alternative" or "progressive" keywords first.

Fix: in the `clusterOf()` function, check Metal cluster before Rock cluster by reordering the array.

## Data Schema Addition to `lastfm-data.json`

```json
{
  "listens": { ... },
  "albumTags": {
    "kraftwerk||autobahn": ["krautrock", "electronic", "kosmische musik"],
    "radiohead||kid a": ["electronic", "experimental", "art rock"],
    ...
  }
}
```

Key format: `artist.toLowerCase() + "||" + album.toLowerCase()`, same normalization as existing listen count keys.

## Caching Strategy

- **Parser**: `parser/album-tags-cache.json` — persists between runs, keyed by normalized album key. Albums already in cache are skipped. Cleared manually if stale data suspected.
- **App**: No change — `lastfm-data.json` is a static file, loaded once at startup.

## What This Does NOT Change

- The 9 genre clusters and their labels stay the same
- `clusterOf()` keyword matching logic stays the same (only order fix)
- Spotify Phase 2 artist genre fetch stays as fallback
- No new runtime API calls in the app — all tag data is pre-baked into `lastfm-data.json`

## Success Criteria

- No Genre count drops from 389 to under 100 (ideally under 50)
- Metal no longer shows 0
- Library and Discover show identical genre counts
- Parser runs complete in under 2 minutes on subsequent runs (cache hit)
- Export button produces valid `spotify-library.json` the parser can consume
