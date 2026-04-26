# Genre Cluster Filter with Drill-Down

**Date:** 2026-04-26  
**Status:** Approved

## Problem

`_genres` on album objects is currently overwritten in `App.jsx` with raw Last.fm album tags, which are inconsistent user-generated strings that don't map cleanly to the existing `GENRE_CLUSTERS`. As a result genre filtering is broken / unreliable in both LibraryTab and DiscoverTab.

## Goal

- Use Spotify artist genres as the primary source for `_genres`
- Fall back to Last.fm tags only when Spotify returns nothing
- Show genre cluster chips (Electronic, Rock, etc.) with drill-down to individual genre strings in both LibraryTab and DiscoverTab

---

## 1. Genre Assignment (App.jsx)

`enrichedAlbums` useMemo changes priority:

1. Album already has Spotify `_genres` (non-empty) → keep as-is
2. Spotify empty → use Last.fm tags from `albumTagsMap` as fallback
3. Both empty → `_genres: []` (→ "No Genre" in filter)

```js
const enrichedAlbums = useMemo(() => {
  return albums.map(a => {
    if ((a._genres || []).length > 0) return a
    const key = `${a.artists?.[0]?.name || ''}||${a.name}`.toLowerCase()
    const lfmTags = albumTagsMap.get(key) || []
    return { ...a, _genres: lfmTags }
  })
}, [albums, albumTagsMap])
```

No other changes to App.jsx. Last.fm data continues to be used for stats (listen counts, scrobble history) as before.

---

## 2. Filter State & Logic

Both tabs use the same two-level state pattern:

| State var | Type | Meaning |
|---|---|---|
| `activeCluster` | `string \| null` | e.g. `'rock'` — cluster level |
| `activeGenre` | `string \| null` | e.g. `'shoegaze'` — only when cluster is set |

Filter logic applied to album list:

- `activeGenre` set → `a._genres.includes(activeGenre)`
- only `activeCluster` set → `a._genres.some(g => clusterOf(g) === activeCluster)`
- both null → no genre filter
- `'no-genre'` → `a._genres.length === 0`

DiscoverTab uses draft variants (`draftCluster`, `draftGenre`) that are committed to `activeCluster`/`activeGenre` on "Apply".

---

## 3. LibraryTab UI

The existing genre chips row (currently raw genre strings) is replaced.

**Level 1 — Cluster chips:**
```
[⚡ Electronic (42)] [🎸 Rock (31)] [📻 Punk (18)] ... [No Genre (12)]
```
- Only clusters with ≥1 album are shown
- Sorted by album count descending
- "No Genre" chip always last if count > 0

**Level 2 — after clicking e.g. "Rock":**
```
[← Rock] [shoegaze (11)] [post-rock (9)] [grunge (7)] ...
```
- `← Rock` is the back button — clears both `activeCluster` and `activeGenre`
- Genre chips are the individual Spotify strings within the selected cluster
- Sorted by album count descending
- Clicking a genre chip sets `activeGenre` (toggle: clicking again deselects)

**State changes in LibraryTab:**
- Remove: `activeGenre: string | null` (single raw string)
- Add: `activeCluster: string | null` + `activeGenre: string | null`
- `visibleGenres`/`genreCounts` useMemo is split into two: one for cluster counts, one for intra-cluster genre counts

---

## 4. DiscoverTab UI

The genre section inside the filter panel follows the same drill-down pattern with draft state.

**In the filter panel, genre section:**

- `draftCluster === null` → cluster chips displayed (Level 1)
- Click cluster → `draftCluster = 'rock'` → genre chips for that cluster (Level 2)
- `← Rock` chip → clears `draftCluster` and `draftGenre`, back to Level 1
- Click genre chip → toggles `draftGenre`
- "Apply" button commits `draftCluster` → `activeCluster`, `draftGenre` → `activeGenre`
- "Reset" clears both draft and active cluster/genre state

The existing `genreList`/`genreCounts` computation (currently lines ~400–412) is replaced by cluster-aware computation:
- When `draftCluster === null`: compute cluster counts across pool
- When `draftCluster` is set: compute individual genre counts within that cluster across pool

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/App.jsx` | `enrichedAlbums` — priority flip, no override when Spotify genres present |
| `src/components/library/LibraryTab.jsx` | Replace `activeGenre` with `activeCluster + activeGenre`; new cluster chip UI |
| `src/components/discover/DiscoverTab.jsx` | Add `draftCluster + draftGenre`; replace genre section in filter panel |
| `src/data/genre-clusters.js` | No changes needed — `GENRE_CLUSTERS` and `clusterOf()` already correct |
| `src/lib/badge-utils.js` | No changes needed — already uses `_genres` generically |

---

## 6. Out of Scope

- No changes to `fetchArtistGenres` in `spotify-api.js` — it already works correctly
- No changes to `artist_cache` in IndexedDB — existing cached genres are valid
- No changes to Last.fm stats display in AlbumModal
- No new genre cluster definitions
