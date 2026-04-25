# Spec: UI Features Batch — 2026-04-18

## Scope

Six features across StatsTab, DiscoverTab, ExploreTab, and minor spacing fix.

---

## 1. DnD → Arrows (already done)

Drag-and-drop reordering in Settings (Insights Carousels + Explore Playlists) replaced with arrow buttons. No further action required.

---

## 2. StatsTab: "Recently Added" Carousel + Revert "Latest Discoveries"

### Revert "Latest Discoveries"

Restore original sort: `sort by firstHeard descending` (last.fm first-heard timestamp). Remove the `_added_at`-based sort introduced in the previous session. No `_added_at` filter — keep the existing `enriched` source (last.fm-matched albums only).

```js
const latestDiscoveries = useMemo(() =>
  [...enriched]
    .sort((a, b) => (b.firstHeard || 0) - (a.firstHeard || 0))
    .slice(0, 20)
    .map(e => ({ ...e, _stat: e.firstHeard ? String(new Date(e.firstHeard).getFullYear()) : null, _carouselId: 'latest-discoveries' }))
, [enriched])
```

### New "Recently Added" Carousel

- **Source**: full `albums` prop (Spotify library) — no last.fm match required
- **Sort**: `_added_at` descending
- **Stat label**: relative date string ("3d ago", "2w ago") using existing `fmtAgo()`
- **Carousel ID**: `'recently-added'`
- **Size**: top 20 albums
- **Burn tracking**: yes, same pattern as other carousels
- **DEFAULT_CAROUSEL_ORDER**: append `'recently-added'` at the end
- **originalLengths**: include `'recently-added'`

Data shape: albums from `albums` array already have `_added_at` as ISO string. The carousel item needs to adapt to the `CarouselItem` entry shape (`name`, `artist`, `spotifyAlbum`, `_stat`, `_carouselId`).

```js
const recentlyAdded = useMemo(() =>
  [...albums]
    .filter(a => a._added_at)
    .sort((a, b) => new Date(b._added_at) - new Date(a._added_at))
    .slice(0, 20)
    .map(a => ({
      name: a.name,
      artist: a.artists?.[0]?.name || '',
      spotifyAlbum: a,
      _stat: fmtAgo(new Date(a._added_at).getTime()),
      _carouselId: 'recently-added',
    }))
, [albums])
```

---

## 3. ExploreTab: "Hide Library Albums" Toggle

**Location**: existing Playlist-Settings bottom sheet in the Explore tab.

**Behavior**: when active, albums whose `id` is in `libraryIdSet` are excluded from every playlist carousel.

**State**: local `useState` in ExploreTab — `hideLibraryAlbums` (boolean, default `false`). No localStorage persistence needed.

**Filter application**: applied in the per-playlist `useMemo` that maps `playlistAlbums` to display items, after the existing burn filter.

```js
const filtered = items.filter(album =>
  !isBurned(album.id, carouselId) &&
  (!hideLibraryAlbums || !libraryIdSet.has(album.id))
)
```

**Toggle UI**: a row in the Settings sheet labeled "Hide library albums" with a checkbox or pill toggle, placed before the playlist list.

---

## 4. Backlog Fixes

### 4a. DiscoverTab Spacing

Add `pt-3` (or equivalent) top padding between the Header and the first content element (Discovery Mode section) in DiscoverTab's scroll container.

### 4b. "No Genre" Filter Chip

Add a chip "No Genre" at the end of the genre cluster chip row in DiscoverTab Filters section.

- Filters pick pool to albums where `getGenreCluster(a) === null`
- Mutually exclusive with other genre chips (selecting "No Genre" deselects any active genre chip, and vice versa)
- Count badge: same as other genre chips (see 4c)

### 4c. Genre Counts on Filter Chips

Show album count next to each genre chip and "No Genre" chip. Pattern from LibraryTab.

- Counts computed from the **current filtered pool** (after decade filter, but before genre filter — so counts reflect available albums per genre)
- Format: chip label + count, e.g. `Jazz · 42` or `Jazz (42)` — match LibraryTab's existing style

### 4d. 7D Empty State in StatsTab

When `mostPlayedRange === '7d'` and `filteredMostPlayed.length === 0`, show an explanatory message instead of nothing:

> "No albums heard in the last 7 days according to last.fm data."

Display inside the Most Played carousel section, in place of the empty carousel scroll area.

---

## 5. DiscoverTab: "Recently Added" Filter Chips

New filter row in the Filters section, below the existing Decade and Genre rows.

**Label**: "Recently Added" (section header, same style as existing filter labels)

**Chips**: `7d · 1m · 3m · 6m · 1y`

| Chip | Cutoff |
|------|--------|
| 7d   | 7 days  |
| 1m   | 30 days |
| 3m   | 90 days |
| 6m   | 180 days |
| 1y   | 365 days |

**State**: `recentlyAddedFilter` — `null | '7d' | '1m' | '3m' | '6m' | '1y'`

**Behavior**:
- Exclusive selection; tapping active chip deselects (sets to null)
- Filters pick pool: `new Date(album._added_at).getTime() > Date.now() - cutoffMs`
- Albums without `_added_at` are excluded when any filter is active
- Applied before weighted pick, after other filters (decade, genre, never heard, etc.)

**Custom Presets**: `recentlyAddedFilter` included in saved preset state alongside existing `filters` and `toggles`.

---

## 6. DiscoverTab: "Boost Recently Added" Preference Toggle

**Label**: `🆕 Boost Recently Added`

**Location**: Preferences section in DiscoverTab (alongside existing ⚖ Weighted, 🚫 No Remixes, 🕐 Not Recently Queued).

**State**: `boostRecentlyAdded` boolean toggle (localStorage key: `discover_boost_recently_added`), default `false`.

**Weight logic**: when `boostRecentlyAdded` is active AND `weighted` is active, albums added in the last 30 days receive an additional ×5 multiplier on top of their existing weight:

```js
const addedAt = new Date(a._added_at).getTime()
const isRecentlyAdded = a._added_at && (now - addedAt) < THIRTY_DAYS_MS
const recentBoost = (boostRecentlyAdded && isRecentlyAdded) ? 5 : 1
const w = baseWeight * recentBoost
```

The boost stacks: an unheard album added 3 days ago gets `10 × 5 = 50` weight when both toggles are active.

**Custom Presets**: `boostRecentlyAdded` saved as part of preset `toggles`.

---

## Files Affected

| File | Changes |
|------|---------|
| `src/components/stats/StatsTab.jsx` | Revert latestDiscoveries sort; add recentlyAdded carousel |
| `src/components/explore/ExploreTab.jsx` | hideLibraryAlbums toggle + filter |
| `src/components/discover/DiscoverTab.jsx` | Spacing, No Genre chip, genre counts, recentlyAddedFilter, boostRecentlyAdded |
| `src/components/layout/Header.jsx` | hideLibraryAlbums toggle UI in Settings sheet |

No new hooks, no new files required.
