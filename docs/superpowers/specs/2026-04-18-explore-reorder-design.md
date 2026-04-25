# Spec: Explore Tab + Settings Reorder

**Date:** 2026-04-18
**Branch:** ui-cleanup → new feature branch

---

## Overview

Two features shipped together:

1. **Explore Tab** — replaces the "Coming Soon" stub. Shows user-selected Spotify playlists as horizontal carousels, identical pattern to Insights. Each album is tappable; library albums get the full AlbumModal, non-library albums get a simplified variant.

2. **Settings Reorder** — Insights Carousels and Explore Playlists can be reordered via drag handles in the Settings modal.

---

## 1. Data Layer

### 1.1 `usePlaylists` hook (`src/hooks/usePlaylists.js`)

**Responsibilities:**
- Fetch user's own Spotify playlists via `GET /me/playlists` (paginated, `limit=50`)
- Fetch album list per playlist via `GET /playlists/{id}/items` (extract `track.album`, deduplicate by album ID)
- Cache both in IndexedDB (stores: `playlists_meta`, `playlist_albums`)
- No TTL — manual refresh only (`refreshPlaylists()`)
- Expose: `{ playlists, playlistAlbums, loading, error, refreshPlaylists }`

**`playlists`** — array of `{ id, name, trackCount }` for all own playlists (for the Settings picker)

**`playlistAlbums`** — map `{ [playlistId]: Album[] }` — only populated for selected playlists (lazy: fetch on selection)

**Selection state** managed separately in `App.jsx` via localStorage key `sonar_selected_playlists` (array of IDs, max 5).

**Filtering own playlists:** `playlist.owner.id === currentUserId` (userId available from existing Spotify auth).

### 1.2 Album shape for non-library items

Playlist albums not in the Spotify library will lack `_genres`, `_addedAt`, and Last.fm data. Mark them with `_inLibrary: false`. Library albums already have `_inLibrary` implicitly true; set `_inLibrary: true` explicitly when merging.

Matching against library: compare album ID. If `libraryAlbums` map (keyed by ID) contains the playlist album → `_inLibrary: true`, merge full library data. Otherwise `_inLibrary: false`, keep only Spotify fields (id, name, artists, images, release_date).

### 1.3 Burn tracking for Explore

Reuse existing `useBurnTracking` hook. Key namespace: `explore_burn_{playlistId}` (separate from Insights burn keys). Burn count and reset work identically.

### 1.4 Reorder persistence

| What | Key | Shape |
|---|---|---|
| Insights carousel order | `sonar_carousel_settings` | existing; add `order` array of carousel IDs |
| Selected Explore playlists | `sonar_selected_playlists` | `string[]` of playlist IDs (ordered = display order) |
| Explore playlist order | (same as above) | order of array = carousel order |

For Insights, `sonar_carousel_settings` already stores per-carousel `{ visible, sort }`. Add top-level `order: string[]` to the object (array of carousel IDs in display order). Default = existing order `['mostPlayed', 'discoveries', 'goldenOldies', 'climbers', 'fallers', 'onThisDay']`.

---

## 2. ExploreTab (`src/components/explore/ExploreTab.jsx`)

Replaces the current stub entirely.

**Props:** `{ token, libraryAlbums, selectedPlaylists, playlistAlbums, playlistsLoading }` — same pattern as StatsTab, all passed down from App.jsx.

**Layout per selected playlist:**

```
[Playlist Name]                    [N burns] Reset
[2px progress bar — burn %]
[← scrollable carousel of album cards →]
```

- Playlist name as section header (no emoji prefix — playlist names come from Spotify as-is)
- CarouselItem reused from StatsTab — same 120×120px cover + title + artist
- Below album name: `★ Library` (green, `#1ed760`) or `+ New` (soft blue, `#a0a0ff`)
- Burn tracking identical to Insights: burned albums filtered from carousel, progress bar shows X/total burned, Reset restores

**Empty states:**
- No playlists selected → "Select playlists in Settings to start exploring."
- Playlists selected but still loading → skeleton/spinner
- Selected playlist returns 0 albums → hide that carousel silently (or show "No albums found")

**AlbumModal behavior:**
- `_inLibrary: true` → existing AlbumModal unchanged (Last.fm stats, full track list, queue + save)
- `_inLibrary: false` → AlbumModal with: cover, title, artist, release year; Queue button (adds album to Spotify queue); Save to Library button; **no Last.fm section**, **no track list** (tracks not pre-fetched)

The `_inLibrary` flag drives a conditional render inside `AlbumModal`. No separate component — one modal, conditional sections.

---

## 3. Settings Modal (`src/components/layout/Header.jsx`)

### 3.1 Drag-to-reorder — Insights Carousels

Current: each carousel row has toggle (visible/hidden). Add drag handle `⠿` on the left of each row. Drag reorders the array in `sonar_carousel_settings.order`. StatsTab reads carousels in that order.

Use the HTML5 Drag and Drop API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — no external library. Pattern: track `dragIndex` and `hoverIndex` in local state, swap on drop, persist to localStorage.

### 3.2 New section: Explore Playlists

Appears below Insights Carousels section, separated by a divider.

**Playlist picker** (scrollable list, max-height ~240px):
- All own playlists from `usePlaylists`
- Each row: checkbox + playlist name + track count
- Checking adds ID to `sonar_selected_playlists` (max 5; at 5 unchecked rows are disabled)
- Unchecking removes from array and from the reorder list below
- "Refresh ↻" button top-right → calls `refreshPlaylists()`, shows loading state inline

**Reorder list** (drag handles, only selected playlists):
- Shows only currently selected playlists
- Drag handle `⠿` reorders within `sonar_selected_playlists`
- Deselecting a playlist via the picker above removes it from here automatically

**Loading state:** if `usePlaylists` is loading, show a small spinner in the section header area instead of the list.

**Error state:** if fetch failed, show "Could not load playlists. Tap Refresh to retry." with the Refresh button.

---

## 4. App.jsx changes

- Add `usePlaylists` hook call (token passed in)
- Add `selectedPlaylists` state (loaded from `sonar_selected_playlists` localStorage, default `[]`)
- Pass `playlists`, `playlistAlbums`, `selectedPlaylists`, `setSelectedPlaylists`, `refreshPlaylists` to `SettingsModal` and `ExploreTab`
- Add `carouselOrder` to `carouselSettings` state with default order array; pass to `StatsTab` for render ordering

---

## 5. StatsTab changes

Read `carouselOrder` from settings and render carousels in that order (currently hardcoded array). Minor refactor: map over order array instead of hardcoded JSX sequence.

---

## 6. Out of scope

- Collaborative playlists (only own playlists fetched)
- Podcast episodes in playlists (skip non-track items; `item.track.type !== 'track'`)
- Offline mode / fallback when Spotify is unreachable beyond existing error handling
- Auto-refresh / TTL for playlist data
