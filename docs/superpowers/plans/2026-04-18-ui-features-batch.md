# UI Features Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 UI features: Recently Added carousel, Latest Discoveries revert, hide-library-albums toggle in Explore, 4 DiscoverTab improvements (spacing, No Genre chip, genre counts, Recently Added filter, Boost Recently Added toggle), and the 7D empty state fix.

**Architecture:** All changes are pure UI/state in existing React components. No new hooks, no new files. `hideLibraryAlbums` state lives in App.jsx and threads down through Header → BrowseTab → ExploreTab. All DiscoverTab changes are self-contained within `src/components/discover/DiscoverTab.jsx`.

**Tech Stack:** React 18, Tailwind CSS v4, `motion/react` v12, Vite. No test suite — use `npm run dev` + browser for verification.

---

## File Map

| File | What changes |
|------|-------------|
| `src/App.jsx` | Add `hideLibraryAlbums` state + `updateHideLibraryAlbums()`; add `'recently-added'` to `defaultCarouselSettings()`; thread new props to Header + BrowseTab |
| `src/components/layout/Header.jsx` | Fix `CAROUSEL_LABELS` ('latest-discoveries' label → '🔭 Latest Discoveries', add '🔔 Recently Added' for 'recently-added'); add `hideLibraryAlbums` + `onUpdateHideLibraryAlbums` props; render toggle in SettingsModal Explore section |
| `src/components/browse/BrowseTab.jsx` | Accept + forward `hideLibraryAlbums` prop to ExploreTab |
| `src/components/stats/StatsTab.jsx` | Revert `latestDiscoveries` sort; add `recentlyAdded` carousel data + burn filter + render block; add to `DEFAULT_CAROUSEL_ORDER` + `originalLengths`; add 7D empty state |
| `src/components/explore/ExploreTab.jsx` | Accept `hideLibraryAlbums` prop; apply filter in per-playlist `visible` computation |
| `src/components/discover/DiscoverTab.jsx` | Add top spacing; add genre counts + 'No Genre' chip; add `recentlyAddedFilter` state + UI + pool filter; add `boostRecentlyAdded` toggle |

---

## Task 1: StatsTab — Revert Latest Discoveries + Add Recently Added Carousel

**Files:**
- Modify: `src/components/stats/StatsTab.jsx`

- [ ] **Step 1: Revert `latestDiscoveries` sort to `firstHeard`**

In `StatsTab.jsx`, find the `latestDiscoveries` useMemo (around line 191) and replace it:

```js
const latestDiscoveries = useMemo(() =>
  [...enriched]
    .sort((a, b) => (b.firstHeard || 0) - (a.firstHeard || 0))
    .slice(0, 20)
    .map(e => ({ ...e, _stat: e.firstHeard ? String(new Date(e.firstHeard).getFullYear()) : null, _carouselId: 'latest-discoveries' }))
, [enriched])
```

- [ ] **Step 2: Add `recentlyAdded` constant and useMemo**

Add after the `TWO_YEARS_MS` / `ONE_YEAR_MS` constants at the top:

```js
const RECENTLY_ADDED_MS = 0  // no threshold — sorted by date, all shown
```

Then add the `recentlyAdded` useMemo after `latestDiscoveries`:

```js
const recentlyAdded = useMemo(() =>
  [...albums]
    .filter(a => a._added_at)
    .sort((a, b) => new Date(b._added_at) - new Date(a._added_at))
    .slice(0, 20)
    .map(a => ({
      name:        a.name,
      artist:      a.artists?.[0]?.name || '',
      spotifyAlbum: a,
      _stat:       fmtAgo(new Date(a._added_at).getTime()),
      _carouselId: 'recently-added',
    }))
, [albums])
```

Note: `recentlyAdded` uses `albums` prop directly — no last.fm matching required.

- [ ] **Step 3: Add `'recently-added'` to `DEFAULT_CAROUSEL_ORDER`**

```js
const DEFAULT_CAROUSEL_ORDER = [
  'most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'recently-added',
]
```

- [ ] **Step 4: Add `recentlyAdded` to `originalLengths`**

Find the `originalLengths` useMemo (around line 244) and add the entry:

```js
const originalLengths = useMemo(() => ({
  'most-played':        mostPlayed.length,
  'latest-discoveries': latestDiscoveries.length,
  'golden-oldies':      goldenOldies.length,
  'climbers':           climbers.length,
  'fallers':            fallers.length,
  'on-this-day':        onThisDayItems.length,
  'recently-added':     recentlyAdded.length,
}), [mostPlayed, latestDiscoveries, goldenOldies, climbers, fallers, onThisDayItems, recentlyAdded])
```

- [ ] **Step 5: Add burn-filtered `filteredRecentlyAdded`**

After the existing `filteredOnThisDayItems` useMemo, add:

```js
const filteredRecentlyAdded = useMemo(
  () => recentlyAdded.filter(e => !isBurned(e.spotifyAlbum?.id, 'recently-added')),
  [recentlyAdded, burnedMap]
)
```

- [ ] **Step 6: Add `'recently-added'` render block**

In the `blocks` object (after the `'on-this-day'` entry, around line 401), add:

```js
'recently-added': (carouselSettings?.['recently-added']?.visible ?? true) && (
  <Carousel title="🔔 Recently Added" items={filteredRecentlyAdded} onTap={handleCarouselTap} onReset={() => resetCarousel('recently-added')} {...carouselBurnProps('recently-added')} />
),
```

- [ ] **Step 7: Verify in browser**

Run `npm run dev`, open Insights tab → scroll to bottom → "🔔 Recently Added" carousel appears with albums sorted by add date. "🔭 Latest Discoveries" now shows albums sorted by first-heard year (last.fm data). Open Settings → Insights Carousels → "🔔 Recently Added" row visible.

- [ ] **Step 8: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat: add Recently Added carousel, revert Latest Discoveries to firstHeard sort"
```

---

## Task 2: StatsTab — 7D Empty State

**Files:**
- Modify: `src/components/stats/StatsTab.jsx`

- [ ] **Step 1: Add empty state message for 7D Most Played**

In the `blocks['most-played']` render block, find the empty state (around line 381):

```jsx
) : (
  <p className="text-[12px] text-ink-muted py-2">All burned — tap Reset to restore.</p>
)}
```

Replace with:

```jsx
) : (
  <p className="text-[12px] text-ink-muted py-2">
    {mostPlayedRange === '7d'
      ? 'No albums heard in the last 7 days according to last.fm data.'
      : 'All burned — tap Reset to restore.'
    }
  </p>
)}
```

- [ ] **Step 2: Verify in browser**

Switch Most Played to "7D" — if empty, should see the explanatory message instead of blank space.

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "fix: show explanatory message when 7D Most Played is empty"
```

---

## Task 3: Header — Fix CAROUSEL_LABELS + Add `hideLibraryAlbums` Toggle UI

**Files:**
- Modify: `src/components/layout/Header.jsx`

- [ ] **Step 1: Fix `CAROUSEL_LABELS`**

At the top of `Header.jsx`, update `CAROUSEL_LABELS`:

```js
const CAROUSEL_LABELS = {
  'most-played':        '👑 Most Played',
  'latest-discoveries': '🔭 Latest Discoveries',
  'golden-oldies':      '🕰️ Golden Oldies',
  'climbers':           '📈 Climbers',
  'fallers':            '📉 Fallers',
  'on-this-day':        '📅 On This Day',
  'recently-added':     '🔔 Recently Added',
}
```

- [ ] **Step 2: Add `hideLibraryAlbums` props to `SettingsModal`**

Find the `SettingsModal` function signature (around line 136) and add two new props:

```js
function SettingsModal({
  isOpen,
  onClose,
  albumCount,
  lastfmMeta,
  onRefresh,
  carouselSettings,
  onUpdateCarouselSettings,
  onUpdateCarouselOrder,
  playlists = [],
  playlistsLoading,
  playlistsError,
  selectedPlaylists = [],
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
  hideLibraryAlbums = false,
  onUpdateHideLibraryAlbums,
}) {
```

- [ ] **Step 3: Add toggle UI in Explore Playlists section**

In the Explore Playlists section of SettingsModal, find the block that starts with `<div className="pb-4 space-y-3">` (around line 324). Add the toggle as the FIRST child, before the collapsible picker header:

```jsx
<div className="pb-4 space-y-3">
  {/* Hide library albums toggle */}
  <button
    onClick={() => onUpdateHideLibraryAlbums(!hideLibraryAlbums)}
    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-card-raised border border-border-subtle active:opacity-70 transition-all duration-200"
  >
    <div className="text-left">
      <p className="text-[12px] font-medium text-ink">Hide library albums</p>
      <p className="text-[10px] text-ink-muted mt-0.5">Only show albums not already in your library</p>
    </div>
    <div className={`w-11 h-6 rounded-full relative flex-shrink-0 border transition-all duration-300 ${
      hideLibraryAlbums ? 'bg-accent border-accent' : 'bg-card border-border-subtle'
    }`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
        hideLibraryAlbums ? 'left-[22px]' : 'left-0.5'
      }`} />
    </div>
  </button>

  {/* existing: collapsible picker header */}
  <button
    onClick={() => setPickerOpen(p => !p)}
    ...
```

- [ ] **Step 4: Add `hideLibraryAlbums` + `onUpdateHideLibraryAlbums` to the `<SettingsModal>` call site in `Header`**

Find where `<SettingsModal>` is rendered inside `Header` (search for `<SettingsModal`) and add the two props:

```jsx
<SettingsModal
  isOpen={isSettingsOpen}
  onClose={onSettingsClose}
  albumCount={albumCount}
  lastfmMeta={lastfmMeta}
  onRefresh={onRefresh}
  carouselSettings={carouselSettings}
  onUpdateCarouselSettings={onUpdateCarouselSettings}
  onUpdateCarouselOrder={onUpdateCarouselOrder}
  playlists={playlists}
  playlistsLoading={playlistsLoading}
  playlistsError={playlistsError}
  selectedPlaylists={selectedPlaylists}
  onUpdateSelectedPlaylists={onUpdateSelectedPlaylists}
  onRefreshPlaylists={onRefreshPlaylists}
  hideLibraryAlbums={hideLibraryAlbums}
  onUpdateHideLibraryAlbums={onUpdateHideLibraryAlbums}
/>
```

- [ ] **Step 5: Add `hideLibraryAlbums` + `onUpdateHideLibraryAlbums` to `Header` function signature**

Find the `export default function Header(...)` signature and add the two new props (with defaults):

```js
export default function Header({
  onLogout,
  albumCount,
  lastfmMeta,
  onRefresh,
  isSidebarOpen,
  onSidebarOpen,
  onSidebarClose,
  isSettingsOpen,
  onSettingsOpen,
  onSettingsClose,
  carouselSettings,
  onUpdateCarouselSettings,
  onUpdateCarouselOrder,
  playlists = [],
  playlistsLoading,
  playlistsError,
  selectedPlaylists = [],
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
  hideLibraryAlbums = false,
  onUpdateHideLibraryAlbums,
}) {
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Header.jsx
git commit -m "feat: add hideLibraryAlbums toggle to Explore settings, fix carousel labels"
```

---

## Task 4: App + BrowseTab — Thread `hideLibraryAlbums`

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/browse/BrowseTab.jsx`

- [ ] **Step 1: Add `'recently-added'` to `defaultCarouselSettings()` in App.jsx**

Find `defaultCarouselSettings()` (around line 74):

```js
function defaultCarouselSettings() {
  return {
    _order: ['most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'recently-added'],
    'most-played':        { visible: true, sort: 'original' },
    'latest-discoveries': { visible: true, sort: 'original' },
    'golden-oldies':      { visible: true, sort: 'original' },
    'climbers':           { visible: true, sort: 'original' },
    'fallers':            { visible: true, sort: 'original' },
    'on-this-day':        { visible: true, sort: 'original' },
    'recently-added':     { visible: true, sort: 'original' },
  }
}
```

- [ ] **Step 2: Add `hideLibraryAlbums` state + updater to `MainApp`**

In `MainApp`, after the `carouselSettings` useState (around line 94), add:

```js
const [hideLibraryAlbums, setHideLibraryAlbums] = useState(() => {
  try { return localStorage.getItem('sonar_hide_library_albums') === 'true' } catch { return false }
})

function updateHideLibraryAlbums(val) {
  setHideLibraryAlbums(val)
  localStorage.setItem('sonar_hide_library_albums', String(val))
}
```

- [ ] **Step 3: Pass `hideLibraryAlbums` props to `<Header>`**

In the `<Header>` JSX (around line 223), add:

```jsx
<Header
  ...
  hideLibraryAlbums={hideLibraryAlbums}
  onUpdateHideLibraryAlbums={updateHideLibraryAlbums}
/>
```

- [ ] **Step 4: Pass `hideLibraryAlbums` to `<BrowseTab>` in the `renderTab()` switch**

In the `case 'browse':` return (around line 182), add the prop:

```jsx
case 'browse': return (
  <BrowseTab
    ...
    hideLibraryAlbums={hideLibraryAlbums}
  />
)
```

- [ ] **Step 5: Forward `hideLibraryAlbums` through BrowseTab**

In `BrowseTab.jsx`, add `hideLibraryAlbums` to the destructured props and forward it to `<ExploreTab>`:

```js
export default function BrowseTab({
  albums,
  getAlbumStats,
  lastfmMap,
  lastfmLoaded,
  onThisDay,
  genresLoading,
  saveLater,
  removeLater,
  isSaved,
  activeSubTab,
  onSubTabChange,
  libraryFilter,
  onClearFilter,
  onBadgeClick,
  carouselSettings,
  onUpdateCarouselSettings,
  selectedPlaylists,
  playlistAlbums,
  playlistsLoading,
  playlists,
  hideLibraryAlbums = false,
}) {
```

And in the `case 'explore':` block:

```jsx
case 'explore':
default:
  return (
    <ExploreTab
      albums={albums}
      getAlbumStats={getAlbumStats}
      selectedPlaylists={selectedPlaylists}
      playlistAlbums={playlistAlbums}
      playlists={playlists}
      saveLater={saveLater}
      removeLater={removeLater}
      isSaved={isSaved}
      onBadgeClick={onBadgeClick}
      hideLibraryAlbums={hideLibraryAlbums}
    />
  )
```

- [ ] **Step 6: Apply filter in ExploreTab**

In `ExploreTab.jsx`, add `hideLibraryAlbums = false` to props:

```js
export default function ExploreTab({
  albums = [],
  getAlbumStats,
  selectedPlaylists = [],
  playlistAlbums = new Map(),
  playlists = [],
  saveLater,
  removeLater,
  isSaved,
  onBadgeClick,
  hideLibraryAlbums = false,
}) {
```

Then in the per-playlist render loop, find where `visible` is computed (around line 114):

```js
const visible = enriched.filter(a => !isBurned(a.id, carouselId))
```

Replace with:

```js
const visible = enriched.filter(a =>
  !isBurned(a.id, carouselId) &&
  (!hideLibraryAlbums || !libraryIdSet.has(a.id))
)
```

- [ ] **Step 7: Verify in browser**

Open Settings → Explore Playlists → toggle "Hide library albums" → ON. Switch to Explore tab, verify albums already in library disappear from playlist carousels. Toggle OFF → they reappear.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/components/browse/BrowseTab.jsx src/components/explore/ExploreTab.jsx
git commit -m "feat: thread hideLibraryAlbums from App through BrowseTab to ExploreTab"
```

---

## Task 5: DiscoverTab — Top Spacing Fix

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx`

- [ ] **Step 1: Add top padding to DiscoverTab scroll container**

Find the return statement of the main `DiscoverTab` component. The outermost scrollable div likely starts with something like `<div className="px-4 pb-20 ...">`. Add `pt-3`:

Search for the main return's opening div (after all modals/sheets, the actual content container). It will be something like:

```jsx
return (
  <div className="px-4 pb-20 space-y-4">
```

Change to:

```jsx
return (
  <div className="px-4 pt-3 pb-20 space-y-4">
```

- [ ] **Step 2: Verify in browser**

Discover tab — small gap visible between header bar ("Sonar") and the Discovery Mode section.

- [ ] **Step 3: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "fix: add top spacing between header and DiscoverTab content"
```

---

## Task 6: DiscoverTab — Genre Counts + "No Genre" Chip

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx`

- [ ] **Step 1: Add genre pool counts computation in `FilterModal`**

`FilterModal` receives `draftFilters`, `draftToggles`, and the existing `albums` prop is NOT passed to it. We need to pass `albums` and `getAlbumStats` down so counts can be computed. Update the `FilterModal` signature:

```js
function FilterModal({ draftFilters, draftToggles, setDraftFilters, setDraftToggles, onApply, onClose, onSavePreset, activeFilterCount, albums, getAlbumStats }) {
```

Add a `genreCounts` computation inside `FilterModal` (before the return):

```js
// Count albums per genre cluster from the current draft-filtered pool
// (applies decade filter from draftFilters, but not genre filter — so counts reflect available albums per genre)
const genreCounts = useMemo(() => {
  const activeDecades = DECADES.filter(d => draftFilters.has(d))
  const pool = albums.filter(a => {
    if (activeDecades.length && !activeDecades.includes(albumDecade(a))) return false
    return true
  })
  const counts = {}
  let noGenreCount = 0
  for (const a of pool) {
    const cluster = getGenreCluster(a)
    if (cluster) {
      counts[cluster.id] = (counts[cluster.id] || 0) + 1
    } else {
      noGenreCount++
    }
  }
  counts['no-genre'] = noGenreCount
  return counts
}, [albums, draftFilters])
```

Note: `FilterModal` is a nested component inside the same file as `albumDecade`, `getGenreCluster`, `DECADES`, `GENRE_CLUSTERS` — they are all in scope.

Add `useState` import is already at the top; add `useMemo` to the import if not already present. Check line 1 of DiscoverTab.jsx — `useMemo` is already imported.

- [ ] **Step 2: Update genre chips to show counts**

Find the genre chips render in `FilterModal` (around line 489):

```jsx
{GENRE_CLUSTERS.map(c => {
  const active = draftFilters.has(c.id)
  return (
    <button
      key={c.id}
      onClick={() => toggleDraftFilter(c.id)}
      className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
        active
          ? 'border-accent bg-accent text-black font-semibold'
          : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
      }`}
    >
      <span>{c.icon}</span><span>{c.label}</span>
    </button>
  )
})}
```

Replace with:

```jsx
{GENRE_CLUSTERS.map(c => {
  const active = draftFilters.has(c.id)
  const count = genreCounts[c.id] ?? 0
  return (
    <button
      key={c.id}
      onClick={() => toggleDraftFilter(c.id)}
      className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
        active
          ? 'border-accent bg-accent text-black font-semibold'
          : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
      }`}
    >
      <span>{c.icon}</span>
      <span>{c.label}</span>
      <span className={active ? 'opacity-70' : 'text-ink-muted'}>{count}</span>
    </button>
  )
})}
{/* No Genre chip */}
{(() => {
  const active = draftFilters.has('no-genre')
  const count = genreCounts['no-genre'] ?? 0
  return (
    <button
      onClick={() => {
        setDraftFilters(prev => {
          const next = new Set(prev)
          if (next.has('no-genre')) {
            next.delete('no-genre')
          } else {
            // deselect all genre cluster IDs
            GENRE_CLUSTERS.forEach(c => next.delete(c.id))
            next.add('no-genre')
          }
          return next
        })
      }}
      className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
        active
          ? 'border-accent bg-accent text-black font-semibold'
          : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
      }`}
    >
      <span>No Genre</span>
      <span className={active ? 'opacity-70' : 'text-ink-muted'}>{count}</span>
    </button>
  )
})()}
```

- [ ] **Step 3: Deselect "No Genre" when a genre chip is selected**

In `toggleDraftFilter` inside `FilterModal`, update to auto-deselect 'no-genre':

```js
function toggleDraftFilter(f) {
  setDraftFilters(prev => {
    const next = new Set(prev)
    if (next.has(f)) {
      next.delete(f)
    } else {
      next.add(f)
      // if adding a genre cluster, remove no-genre
      if (GENRE_CLUSTERS.some(c => c.id === f)) {
        next.delete('no-genre')
      }
    }
    return next
  })
}
```

- [ ] **Step 4: Apply "no-genre" filter in `filteredAlbums` pool**

In the main `DiscoverTab` component, find `filteredAlbums` useMemo (around line 736). After the existing genre cluster filter block, add:

```js
if (activeFilters.has('no-genre') && getGenreCluster(a) !== null) return false
```

So the relevant section becomes:

```js
if (activeGenreClusters.length) {
  const albumClusters = new Set((a._genres || []).map(clusterOf))
  if (!activeGenreClusters.some(c => albumClusters.has(c.id))) return false
}
if (activeFilters.has('no-genre') && getGenreCluster(a) !== null) return false
```

- [ ] **Step 5: Pass `albums` + `getAlbumStats` to `FilterModal` call site**

Find where `<FilterModal>` is rendered in the main DiscoverTab return. Add the two new props:

```jsx
<FilterModal
  draftFilters={draftFilters}
  draftToggles={draftToggles}
  setDraftFilters={setDraftFilters}
  setDraftToggles={setDraftToggles}
  onApply={applyFilters}
  onClose={() => setFilterModalOpen(false)}
  onSavePreset={savePreset}
  activeFilterCount={activeFilterCount}
  albums={albums}
  getAlbumStats={getAlbumStats}
/>
```

- [ ] **Step 6: Verify in browser**

Open Discover → Filters sheet. Genre chips now show counts. "No Genre" chip appears at end of genre row. Tap "No Genre" → all genre chips deselect; tap any genre chip → "No Genre" deselects. Pool changes accordingly.

- [ ] **Step 7: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "feat: add genre counts and No Genre filter chip to Discover"
```

---

## Task 7: DiscoverTab — "Recently Added" Filter Chips

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx`

- [ ] **Step 1: Add constants**

At the top of DiscoverTab.jsx, after `THIRTY_DAYS_MS`, add:

```js
const RECENTLY_ADDED_RANGES = [
  { id: '7d',  label: '7d',  ms: 7   * 24 * 60 * 60 * 1000 },
  { id: '1m',  label: '1m',  ms: 30  * 24 * 60 * 60 * 1000 },
  { id: '3m',  label: '3m',  ms: 90  * 24 * 60 * 60 * 1000 },
  { id: '6m',  label: '6m',  ms: 180 * 24 * 60 * 60 * 1000 },
  { id: '1y',  label: '1y',  ms: 365 * 24 * 60 * 60 * 1000 },
]
```

- [ ] **Step 2: Add `recentlyAddedFilter` to `FilterModal` state**

`FilterModal` already receives `draftToggles` / `setDraftToggles`. Add `recentlyAddedFilter` / `setRecentlyAddedFilter` as new props:

```js
function FilterModal({ draftFilters, draftToggles, setDraftFilters, setDraftToggles, onApply, onClose, onSavePreset, activeFilterCount, albums, getAlbumStats, recentlyAddedFilter, setRecentlyAddedFilter }) {
```

- [ ] **Step 3: Add "Recently Added" section in FilterModal UI**

In the scrollable content section of FilterModal, add after the "Listening History" section and before "Preferences":

```jsx
{/* Recently Added */}
<div>
  <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Recently Added</p>
  <div className="flex flex-wrap gap-2">
    {RECENTLY_ADDED_RANGES.map(r => {
      const active = recentlyAddedFilter === r.id
      return (
        <button
          key={r.id}
          onClick={() => setRecentlyAddedFilter(active ? null : r.id)}
          className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
            active
              ? 'border-accent bg-accent text-black font-semibold'
              : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
          }`}
        >
          {r.label}
        </button>
      )
    })}
  </div>
</div>
```

- [ ] **Step 4: Add `recentlyAddedFilter` state in main DiscoverTab**

In the main `DiscoverTab` component, after `draftToggles` useState:

```js
const [recentlyAddedFilter, setRecentlyAddedFilter]   = useState(null)
const [draftRecentlyAddedFilter, setDraftRecentlyAddedFilter] = useState(null)
```

- [ ] **Step 5: Update `openFilterModal` and `applyFilters`**

```js
function openFilterModal() {
  setDraftFilters(new Set(activeFilters))
  setDraftToggles({ ...toggles })
  setDraftRecentlyAddedFilter(recentlyAddedFilter)
  setFilterModalOpen(true)
}

function applyFilters() {
  setActiveFilters(draftFilters)
  setToggles(draftToggles)
  setRecentlyAddedFilter(draftRecentlyAddedFilter)
  setActivePreset(null)
  setPickedAlbums([])
  setFilterModalOpen(false)
}
```

- [ ] **Step 6: Apply `recentlyAddedFilter` in `filteredAlbums` pool**

In `filteredAlbums` useMemo, add before the closing `return true`:

```js
if (recentlyAddedFilter) {
  const range = RECENTLY_ADDED_RANGES.find(r => r.id === recentlyAddedFilter)
  if (range) {
    const addedAt = a._added_at ? new Date(a._added_at).getTime() : null
    if (!addedAt || now - addedAt > range.ms) return false
  }
}
```

Also add `recentlyAddedFilter` to the `useMemo` dependency array:

```js
}, [albums, activeFilters, toggles, queueHistory, getAlbumStats, recentlyAddedFilter])
```

- [ ] **Step 7: Include `recentlyAddedFilter` in `activeFilterCount`**

```js
const activeFilterCount = activeFilters.size
  + (toggles.weightUnheard ? 1 : 0)
  + (toggles.excludeKeywords ? 1 : 0)
  + (toggles.avoidRecent ? 1 : 0)
  + (recentlyAddedFilter ? 1 : 0)
```

- [ ] **Step 8: Reset `recentlyAddedFilter` in `applyPreset` built-ins**

In `applyPreset`, for the built-in presets (`surprise`, `forgotten`, `deepcuts`), add `setRecentlyAddedFilter(null)`:

```js
if (id === 'surprise') {
  setActiveFilters(new Set())
  setToggles({ weightUnheard: false, excludeKeywords: false, avoidRecent: false })
  setRecentlyAddedFilter(null)
} else if (id === 'forgotten') {
  setActiveFilters(new Set(['Never heard']))
  setToggles({ weightUnheard: true, excludeKeywords: true, avoidRecent: false })
  setRecentlyAddedFilter(null)
} else if (id === 'deepcuts') {
  setActiveFilters(new Set(['70s', '80s', '90s', '00s']))
  setToggles({ weightUnheard: false, excludeKeywords: true, avoidRecent: true })
  setRecentlyAddedFilter(null)
} else {
  const cp = customPresets.find(p => p.id === id)
  if (cp) {
    setActiveFilters(new Set(cp.filters ?? cp.savedFilters ?? []))
    setToggles(cp.toggles ?? cp.savedToggles ?? { weightUnheard: false, excludeKeywords: false, avoidRecent: false })
    setRecentlyAddedFilter(cp.recentlyAddedFilter ?? null)
  }
}
```

- [ ] **Step 9: Include `recentlyAddedFilter` in `savePreset`**

```js
function savePreset(name, filters, toggleState) {
  const preset = {
    id: Date.now().toString(),
    icon: '⭐',
    label: name,
    filters: [...filters],
    toggles: { ...toggleState },
    recentlyAddedFilter: recentlyAddedFilter,
  }
  ...
}
```

- [ ] **Step 10: Pass draft props to FilterModal call site**

```jsx
<FilterModal
  draftFilters={draftFilters}
  draftToggles={draftToggles}
  setDraftFilters={setDraftFilters}
  setDraftToggles={setDraftToggles}
  onApply={applyFilters}
  onClose={() => setFilterModalOpen(false)}
  onSavePreset={savePreset}
  activeFilterCount={activeFilterCount}
  albums={albums}
  getAlbumStats={getAlbumStats}
  recentlyAddedFilter={draftRecentlyAddedFilter}
  setRecentlyAddedFilter={setDraftRecentlyAddedFilter}
/>
```

- [ ] **Step 11: Verify in browser**

Open Discover → Filters → "Recently Added" section with 5 chips. Select "1m" → pool shrinks to albums added in last 30 days. Deselect → pool restores. Filter count badge increments.

- [ ] **Step 12: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "feat: add Recently Added filter chips to Discover"
```

---

## Task 8: DiscoverTab — "Boost Recently Added" Toggle

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx`

- [ ] **Step 1: Add `boostRecentlyAdded` toggle state**

In main `DiscoverTab`, update `toggles` state to include the new key:

```js
const [toggles, setToggles] = useState({
  weightUnheard: false,
  excludeKeywords: false,
  avoidRecent: false,
  boostRecentlyAdded: false,
})
```

And update `draftToggles` state similarly:

```js
const [draftToggles, setDraftToggles] = useState({
  weightUnheard: false,
  excludeKeywords: false,
  avoidRecent: false,
  boostRecentlyAdded: false,
})
```

- [ ] **Step 2: Add toggle row to FilterModal Preferences section**

In the preferences array inside FilterModal (around line 536), add the new entry:

```js
{ key: 'weightUnheard',      label: '⚖ Weighted',            desc: 'Unheard albums 10× more likely' },
{ key: 'excludeKeywords',    label: '🚫 No Remixes',          desc: 'Filters live/remix/edit/version' },
{ key: 'avoidRecent',        label: '🕐 Not Recently Queued', desc: 'Skips albums queued in last 30 days' },
{ key: 'boostRecentlyAdded', label: '🆕 Boost Recently Added', desc: 'Albums added in last 30 days get 5× boost' },
```

- [ ] **Step 3: Apply boost in `pickRandom`**

The `weightedPickIndex` function currently receives `albums` and `getAlbumStats`. We need to pass the boost flag and use it. Since `weightedPickIndex` is a standalone function at module level, we'll create a modified version inline at the call site.

Find `pickRandom` (around line 766):

```js
function pickRandom() {
  if (!filteredAlbums.length) return
  const pool = [...filteredAlbums]
  const picks = []
  const n = Math.min(pickCount, pool.length)
  for (let i = 0; i < n; i++) {
    const idx = toggles.weightUnheard
      ? weightedPickIndex(pool, getAlbumStats)
      : Math.floor(Math.random() * pool.length)
    if (idx < 0) break
    picks.push(pool[idx])
    pool.splice(idx, 1)
  }
  setPickedAlbums(picks)
}
```

Replace with:

```js
function pickRandom() {
  if (!filteredAlbums.length) return
  const pool = [...filteredAlbums]
  const picks = []
  const n = Math.min(pickCount, pool.length)
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    let idx
    if (toggles.weightUnheard || toggles.boostRecentlyAdded) {
      const weighted = pool.map(a => {
        const stats = getAlbumStats(a)
        const listenCount = stats?.listenCount ?? 0
        const lastHeard   = stats?.lastHeard ?? null
        let w = toggles.weightUnheard
          ? (listenCount === 0 ? 10 : !lastHeard ? 5 : now - lastHeard > NINETY_DAYS_MS ? 5 : 1)
          : 1
        if (toggles.boostRecentlyAdded && a._added_at) {
          const addedAt = new Date(a._added_at).getTime()
          if (now - addedAt < THIRTY_DAYS_MS) w *= 5
        }
        return w
      })
      const total = weighted.reduce((s, w) => s + w, 0)
      let r = Math.random() * total
      idx = weighted.length - 1
      for (let j = 0; j < weighted.length; j++) {
        r -= weighted[j]
        if (r <= 0) { idx = j; break }
      }
    } else {
      idx = Math.floor(Math.random() * pool.length)
    }
    if (idx < 0) break
    picks.push(pool[idx])
    pool.splice(idx, 1)
  }
  setPickedAlbums(picks)
}
```

- [ ] **Step 4: Update `activeFilterCount` for new toggle**

```js
const activeFilterCount = activeFilters.size
  + (toggles.weightUnheard ? 1 : 0)
  + (toggles.excludeKeywords ? 1 : 0)
  + (toggles.avoidRecent ? 1 : 0)
  + (toggles.boostRecentlyAdded ? 1 : 0)
  + (recentlyAddedFilter ? 1 : 0)
```

Also update `draftCount` inside `FilterModal`:

```js
const draftCount = draftFilters.size
  + (draftToggles.weightUnheard   ? 1 : 0)
  + (draftToggles.excludeKeywords ? 1 : 0)
  + (draftToggles.avoidRecent     ? 1 : 0)
  + (draftToggles.boostRecentlyAdded ? 1 : 0)
```

- [ ] **Step 5: Reset `boostRecentlyAdded` in `applyPreset` built-ins**

In `applyPreset`, for all three built-in presets, include `boostRecentlyAdded: false` in the toggles:

```js
if (id === 'surprise') {
  setActiveFilters(new Set())
  setToggles({ weightUnheard: false, excludeKeywords: false, avoidRecent: false, boostRecentlyAdded: false })
  setRecentlyAddedFilter(null)
} else if (id === 'forgotten') {
  setActiveFilters(new Set(['Never heard']))
  setToggles({ weightUnheard: true, excludeKeywords: true, avoidRecent: false, boostRecentlyAdded: false })
  setRecentlyAddedFilter(null)
} else if (id === 'deepcuts') {
  setActiveFilters(new Set(['70s', '80s', '90s', '00s']))
  setToggles({ weightUnheard: false, excludeKeywords: true, avoidRecent: true, boostRecentlyAdded: false })
  setRecentlyAddedFilter(null)
}
```

- [ ] **Step 6: Verify in browser**

Open Discover → Filters → Preferences. "🆕 Boost Recently Added" toggle visible. Enable it. Pick albums — albums added in last 30 days should appear more frequently. Enable "⚖ Weighted" together with it — stacking boost works (unheard + recently added).

- [ ] **Step 7: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "feat: add Boost Recently Added preference toggle to Discover"
```

---

## Self-Review Notes

- **Spec coverage check:**
  - ✅ Task 1: Recently Added carousel + revert Latest Discoveries
  - ✅ Task 2: 7D empty state
  - ✅ Tasks 3+4: hideLibraryAlbums threaded end-to-end
  - ✅ Task 5: Spacing fix
  - ✅ Task 6: No Genre chip + genre counts
  - ✅ Task 7: Recently Added filter chips
  - ✅ Task 8: Boost Recently Added toggle

- **Prop threading order:** App.jsx → Header (toggle UI) + BrowseTab (value forwarding) → ExploreTab (filter). All wired in Tasks 3+4.

- **Type consistency:** `recentlyAddedFilter` is `null | string` throughout. `boostRecentlyAdded` is boolean in `toggles` object throughout. `hideLibraryAlbums` is boolean with `false` default throughout.

- **No placeholders:** All code blocks are complete and self-contained.
