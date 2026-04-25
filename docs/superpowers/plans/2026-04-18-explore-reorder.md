# Explore Tab + Settings Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ExploreTab stub with playlist-driven carousels and add drag-to-reorder for Insights and Explore in Settings.

**Architecture:** A new `usePlaylists` hook fetches own Spotify playlists and caches them in IndexedDB (no TTL, manual refresh). Selected playlists (up to 5, stored in localStorage) are shown as carousels in ExploreTab, mirroring the burn-tracking pattern from StatsTab. Settings gains drag handles for both Insights carousel order and Explore playlist order.

**Tech Stack:** React + Vite, JSX, Tailwind CSS v4, `motion/react` v12, IndexedDB via `idb`, HTML5 Drag and Drop API, Spotify PKCE OAuth.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/db.js` | Modify | DB v3: add `playlists_meta` + `playlist_albums` stores |
| `src/lib/spotify-api.js` | Modify | Add `fetchCurrentUser`, `fetchUserPlaylists`, `fetchPlaylistItems`, `fetchAlbumTracks` |
| `src/hooks/usePlaylists.js` | Create | Playlist list + lazy album cache, manual refresh |
| `src/App.jsx` | Modify | Add `usePlaylists`, `selectedPlaylists` state, `carouselOrder` in settings, thread new props |
| `src/components/browse/BrowseTab.jsx` | Modify | Thread explore props to ExploreTab |
| `src/components/AlbumModal.jsx` | Modify | Lazy-fetch tracks for `inLibrary=false` albums |
| `src/components/stats/StatsTab.jsx` | Modify | Render carousels in `carouselSettings._order` order |
| `src/components/layout/Header.jsx` | Modify | Drag-to-reorder for Insights; real Explore Playlists section |
| `src/components/explore/ExploreTab.jsx` | Rewrite | Full playlist carousel implementation |

---

## Task 1: DB schema v3 — new IndexedDB stores

**Files:**
- Modify: `src/lib/db.js`

- [ ] **Step 1: Bump version and add stores**

Open `src/lib/db.js`. Change `DB_VERSION` from `2` to `3` and add a new upgrade block:

```js
const DB_VERSION = 3
```

```js
      if (oldVersion < 3) {
        // Playlist metadata list (own playlists from Spotify)
        if (!db.objectStoreNames.contains('playlists_meta'))
          db.createObjectStore('playlists_meta')

        // Albums per playlist (keyed by playlist ID)
        if (!db.objectStoreNames.contains('playlist_albums'))
          db.createObjectStore('playlist_albums')
      }
```

Add this block inside the `upgrade(db, oldVersion)` callback, after the existing `if (oldVersion < 2)` block.

- [ ] **Step 2: Verify in browser**

Run `npm run dev`. Open DevTools → Application → IndexedDB → `albumdisc_react_v1`. Confirm version is `3` and `playlists_meta` + `playlist_albums` stores exist.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.js
git commit -m "feat: bump IndexedDB to v3, add playlists_meta + playlist_albums stores"
```

---

## Task 2: Spotify API additions

**Files:**
- Modify: `src/lib/spotify-api.js`

- [ ] **Step 1: Add `fetchCurrentUser`**

Append to `src/lib/spotify-api.js`:

```js
// GET /me — returns the authenticated user's profile
export async function fetchCurrentUser() {
  return get('https://api.spotify.com/v1/me')
}
```

- [ ] **Step 2: Add `fetchUserPlaylists`**

```js
// GET /me/playlists — paginated, returns only playlists owned by userId
export async function fetchUserPlaylists(userId) {
  const results = []
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50'
  while (url) {
    const data = await get(url)
    for (const p of data.items ?? []) {
      if (p.owner?.id === userId) {
        results.push({ id: p.id, name: p.name, trackCount: p.tracks?.total ?? 0 })
      }
    }
    url = data.next
  }
  return results
}
```

- [ ] **Step 3: Add `fetchPlaylistItems`**

```js
// GET /playlists/{id}/items — paginated, deduplicates by album ID, skips non-tracks
export async function fetchPlaylistItems(playlistId) {
  const albums = []
  const seen = new Set()
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=50`
  while (url) {
    const data = await get(url)
    for (const item of data.items ?? []) {
      if (item?.track?.type !== 'track') continue
      const album = item.track.album
      if (!album?.id || seen.has(album.id)) continue
      seen.add(album.id)
      albums.push(album)
    }
    url = data.next
  }
  return albums
}
```

- [ ] **Step 4: Add `fetchAlbumTracks`**

```js
// GET /albums/{id}/tracks — paginated, returns full track list (for non-library album queuing)
export async function fetchAlbumTracks(albumId) {
  const tracks = []
  let url = `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`
  while (url) {
    const data = await get(url)
    tracks.push(...(data.items ?? []))
    url = data.next
  }
  return tracks
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotify-api.js
git commit -m "feat: add fetchCurrentUser, fetchUserPlaylists, fetchPlaylistItems, fetchAlbumTracks"
```

---

## Task 3: `usePlaylists` hook

**Files:**
- Create: `src/hooks/usePlaylists.js`

- [ ] **Step 1: Create the hook**

Create `src/hooks/usePlaylists.js` with the following content:

```js
import { useState, useEffect } from 'react'
import { getDb } from '../lib/db.js'
import { fetchCurrentUser, fetchUserPlaylists, fetchPlaylistItems } from '../lib/spotify-api.js'

export function usePlaylists(selectedPlaylistIds = []) {
  const [playlists, setPlaylists] = useState([])
  const [playlistAlbums, setPlaylistAlbums] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const db = await getDb()
        const cached = await db.get('playlists_meta', 'list')
        if (cached) {
          if (!cancelled) { setPlaylists(cached.data); setLoading(false) }
          const user = await fetchCurrentUser()
          if (!cancelled) setUserId(user.id)
        } else {
          const user = await fetchCurrentUser()
          if (cancelled) return
          setUserId(user.id)
          const data = await fetchUserPlaylists(user.id)
          if (cancelled) return
          await db.put('playlists_meta', { data, cachedAt: Date.now() }, 'list')
          setPlaylists(data)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Lazy-fetch albums for selected playlists (skip already-loaded ones)
  const idsKey = selectedPlaylistIds.join(',')
  useEffect(() => {
    if (!selectedPlaylistIds.length) return
    let cancelled = false
    async function fetchSelected() {
      const db = await getDb()
      const updates = new Map()
      await Promise.all(selectedPlaylistIds.map(async (id) => {
        const cached = await db.get('playlist_albums', id)
        if (cached) { updates.set(id, cached.data); return }
        try {
          const albums = await fetchPlaylistItems(id)
          await db.put('playlist_albums', { data: albums, cachedAt: Date.now() }, id)
          updates.set(id, albums)
        } catch {
          updates.set(id, [])
        }
      }))
      if (cancelled) return
      setPlaylistAlbums(prev => {
        const next = new Map(prev)
        for (const [id, albums] of updates) next.set(id, albums)
        return next
      })
    }
    fetchSelected()
    return () => { cancelled = true }
  }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshPlaylists() {
    setLoading(true)
    setError(null)
    try {
      const db = await getDb()
      await db.delete('playlists_meta', 'list').catch(() => {})
      for (const id of selectedPlaylistIds) {
        await db.delete('playlist_albums', id).catch(() => {})
      }
      const uid = userId ?? (await fetchCurrentUser()).id
      const data = await fetchUserPlaylists(uid)
      await db.put('playlists_meta', { data, cachedAt: Date.now() }, 'list')
      setPlaylists(data)
      const updates = new Map()
      await Promise.all(selectedPlaylistIds.map(async (id) => {
        try {
          const albums = await fetchPlaylistItems(id)
          await db.put('playlist_albums', { data: albums, cachedAt: Date.now() }, id)
          updates.set(id, albums)
        } catch {
          updates.set(id, [])
        }
      }))
      setPlaylistAlbums(prev => {
        const next = new Map(prev)
        for (const [id, albums] of updates) next.set(id, albums)
        return next
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return { playlists, playlistAlbums, loading, error, refreshPlaylists }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePlaylists.js
git commit -m "feat: add usePlaylists hook with lazy album fetch and manual refresh"
```

---

## Task 4: App.jsx + BrowseTab wiring

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/browse/BrowseTab.jsx`

- [ ] **Step 1: Update `defaultCarouselSettings` to include `_order`**

In `src/App.jsx`, replace the `defaultCarouselSettings` function:

```js
function defaultCarouselSettings() {
  return {
    _order: ['most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day'],
    'most-played':        { visible: true, sort: 'original' },
    'latest-discoveries': { visible: true, sort: 'original' },
    'golden-oldies':      { visible: true, sort: 'original' },
    'climbers':           { visible: true, sort: 'original' },
    'fallers':            { visible: true, sort: 'original' },
    'on-this-day':        { visible: true, sort: 'original' },
  }
}
```

- [ ] **Step 2: Add `usePlaylists` import and state in `MainApp`**

Add import at the top of `src/App.jsx` alongside the other hook imports:

```js
import { usePlaylists } from './hooks/usePlaylists.js'
```

Inside `MainApp`, after the existing hook calls, add:

```js
  const [selectedPlaylists, setSelectedPlaylists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonar_selected_playlists')) ?? []
    } catch { return [] }
  })

  const { playlists, playlistAlbums, loading: playlistsLoading, error: playlistsError, refreshPlaylists } = usePlaylists(selectedPlaylists)

  function updateSelectedPlaylists(ids) {
    const capped = ids.slice(0, 5)
    setSelectedPlaylists(capped)
    localStorage.setItem('sonar_selected_playlists', JSON.stringify(capped))
  }

  function updateCarouselOrder(newOrder) {
    setCarouselSettings(prev => {
      const next = { ...prev, _order: newOrder }
      localStorage.setItem('sonar_carousel_settings', JSON.stringify(next))
      return next
    })
  }
```

- [ ] **Step 3: Thread new props to `Header`**

In the `Header` JSX inside `MainApp`, add the new props:

```jsx
        <Header
          onLogout={onLogout}
          albumCount={albums.length}
          lastfmMeta={lastfmMeta}
          onRefresh={handleRefresh}
          isSidebarOpen={isSidebarOpen}
          onSidebarOpen={() => setIsSidebarOpen(true)}
          onSidebarClose={() => setIsSidebarOpen(false)}
          isSettingsOpen={isSettingsOpen}
          onSettingsOpen={() => setIsSettingsOpen(true)}
          onSettingsClose={() => setIsSettingsOpen(false)}
          carouselSettings={carouselSettings}
          onUpdateCarouselSettings={updateCarouselSettings}
          onUpdateCarouselOrder={updateCarouselOrder}
          playlists={playlists}
          playlistsLoading={playlistsLoading}
          playlistsError={playlistsError}
          selectedPlaylists={selectedPlaylists}
          onUpdateSelectedPlaylists={updateSelectedPlaylists}
          onRefreshPlaylists={refreshPlaylists}
        />
```

- [ ] **Step 4: Thread explore props to `BrowseTab`**

In the `renderTab` function's `'browse'` case, add the new props:

```jsx
      case 'browse': return (
        <BrowseTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          lastfmMap={lastfmMap}
          lastfmLoaded={lastfmLoaded}
          onThisDay={onThisDay}
          genresLoading={genresLoading}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          activeSubTab={browseSubTab}
          onSubTabChange={setBrowseSubTab}
          libraryFilter={libraryFilter}
          onClearFilter={() => setLibraryFilter(null)}
          onBadgeClick={handleBadgeClick}
          carouselSettings={carouselSettings}
          onUpdateCarouselSettings={updateCarouselSettings}
          selectedPlaylists={selectedPlaylists}
          playlistAlbums={playlistAlbums}
          playlistsLoading={playlistsLoading}
        />
      )
```

- [ ] **Step 5: Update `BrowseTab` to accept and pass explore props**

Replace `src/components/browse/BrowseTab.jsx` entirely:

```jsx
import LibraryTab from '../library/LibraryTab.jsx'
import StatsTab from '../stats/StatsTab.jsx'
import ExploreTab from '../explore/ExploreTab.jsx'

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
}) {
  switch (activeSubTab) {
    case 'library':
      return (
        <LibraryTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          genresLoading={genresLoading}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          libraryFilter={libraryFilter}
          onClearFilter={onClearFilter}
          onBadgeClick={onBadgeClick}
        />
      )
    case 'insights':
      return (
        <StatsTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          lastfmMap={lastfmMap}
          lastfmLoaded={lastfmLoaded}
          onThisDay={onThisDay}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          onBadgeClick={onBadgeClick}
          carouselSettings={carouselSettings}
          onUpdateCarouselSettings={onUpdateCarouselSettings}
        />
      )
    case 'explore':
    default:
      return (
        <ExploreTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          selectedPlaylists={selectedPlaylists}
          playlistAlbums={playlistAlbums}
          playlistsLoading={playlistsLoading}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
        />
      )
  }
}
```

- [ ] **Step 6: Verify app still loads**

Run `npm run dev`. Open browser. Confirm no console errors and all three Browse sub-tabs render without crashing.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/browse/BrowseTab.jsx
git commit -m "feat: wire usePlaylists into App, thread explore props through BrowseTab"
```

---

## Task 5: AlbumModal — lazy track fetch for non-library albums

**Files:**
- Modify: `src/components/AlbumModal.jsx`

- [ ] **Step 1: Add `fetchAlbumTracks` import**

At the top of `src/components/AlbumModal.jsx`, update the spotify-api import:

```js
import { addToQueue, fetchAlbumTracks } from '../lib/spotify-api.js'
```

- [ ] **Step 2: Add `inLibrary` prop and lazy track loading**

Update the `AlbumModal` function signature to accept `inLibrary`:

```js
export default function AlbumModal({
  album,
  stats,
  saved,
  onSave,
  onRemove,
  onClose,
  onQueue,
  library = [],
  onBadgeClick,
  inLibrary = true,
}) {
```

Add state for loaded tracks (after the existing `useState` calls):

```js
  const [loadedTracks, setLoadedTracks] = useState(null)
  const [tracksLoading, setTracksLoading] = useState(false)
```

Add a `useEffect` to fetch tracks for non-library albums (after the existing `useEffect` calls):

```js
  useEffect(() => {
    setLoadedTracks(null)
    if (!inLibrary && album?.id) {
      setTracksLoading(true)
      fetchAlbumTracks(album.id)
        .then(t => setLoadedTracks(t))
        .catch(() => setLoadedTracks([]))
        .finally(() => setTracksLoading(false))
    }
  }, [album?.id, inLibrary])
```

- [ ] **Step 3: Use `loadedTracks` for non-library albums**

Replace the `tracks` constant:

```js
  const tracks = inLibrary
    ? (currentAlbum.tracks?.items || [])
    : (loadedTracks || [])
```

- [ ] **Step 4: Adapt the header track count display**

Find the line that renders `{year} · {currentAlbum.album_type} · {tracks.length} tracks` and replace it with:

```jsx
              <p className="text-ink-muted text-sm mt-1">
                {year}{currentAlbum.album_type ? ` · ${currentAlbum.album_type}` : ''}{inLibrary ? ` · ${tracks.length} tracks` : ''}
              </p>
```

- [ ] **Step 5: Adapt the Queue button to show loading state**

Find the Queue `<motion.button>` and update `disabled` and label:

```jsx
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleQueue}
              disabled={isBurning || (!inLibrary && tracksLoading)}
              className="flex items-center justify-center gap-2 bg-accent text-page py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {!inLibrary && tracksLoading ? '⏳ Loading…' : '▶ Queue'}
            </motion.button>
```

- [ ] **Step 6: Verify in browser**

Open any album from the Library tab → AlbumModal opens with track list and Queue works normally (`inLibrary` defaults to `true`, no change). Non-library modal behavior will be tested in Task 8.

- [ ] **Step 7: Commit**

```bash
git add src/components/AlbumModal.jsx
git commit -m "feat: AlbumModal lazy-fetches tracks for non-library albums"
```

---

## Task 6: StatsTab — carousel ordering

**Files:**
- Modify: `src/components/stats/StatsTab.jsx`

- [ ] **Step 1: Add `DEFAULT_CAROUSEL_ORDER` constant**

At the top of `src/components/stats/StatsTab.jsx`, after the existing constants, add:

```js
const DEFAULT_CAROUSEL_ORDER = [
  'most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day',
]
```

- [ ] **Step 2: Build a `blocks` map and render in order**

In the `return` statement of `StatsTab`, replace the entire carousel section (from `{/* Most Played */}` through the last `{(carouselSettings?.['on-this-day']...)}`) with:

```jsx
  const order = carouselSettings?._order ?? DEFAULT_CAROUSEL_ORDER

  const blocks = {
    'most-played': (carouselSettings?.['most-played']?.visible ?? true) && (() => {
      const bp = carouselBurnProps('most-played')
      return (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[13px] font-medium text-ink">👑 Most Played</h2>
            <div className="flex items-center gap-2">
              {bp.lastBurnedAt != null && (
                <span className="text-[10px] text-ink-muted">{fmtAgo(bp.lastBurnedAt)}</span>
              )}
              <button onClick={() => resetCarousel('most-played')} className="text-[11px] text-ink-muted active:text-ink flex items-center gap-1">
                {bp.burnedCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-card-raised text-[9px] font-semibold text-ink-muted">{bp.burnedCount}</span>
                )}
                Reset
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-1 mb-2">
            {TIME_RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setMostPlayedRange(r.id)}
                className={cn(
                  'text-[10px] font-bold px-2.5 py-1 rounded-full transition-all',
                  mostPlayedRange === r.id
                    ? 'bg-accent text-page'
                    : 'bg-card-raised text-ink-muted hover:text-ink'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {bp.completionPct > 0 && (
            <div className="h-[2px] bg-card-raised rounded-full overflow-hidden mb-2.5">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${bp.completionPct}%` }} />
            </div>
          )}
          {filteredMostPlayed.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
              <AnimatePresence>
                {applySortToItems(filteredMostPlayed, carouselSettings?.['most-played']?.sort || 'original', getAlbumStats).map((item) => (
                  <motion.div
                    key={`${item.artist}||${item.name}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="flex-shrink-0 w-[calc(50%-8px)]"
                  >
                    <CarouselItem entry={item} onTap={handleCarouselTap} className="w-full" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <p className="text-[12px] text-ink-muted py-2">All burned — tap Reset to restore.</p>
          )}
        </section>
      )
    })(),
    'latest-discoveries': (carouselSettings?.['latest-discoveries']?.visible ?? true) && (
      <Carousel title="🔭 Latest Discoveries" items={filteredLatestDiscoveries} onTap={handleCarouselTap} onReset={() => resetCarousel('latest-discoveries')} {...carouselBurnProps('latest-discoveries')} />
    ),
    'golden-oldies': (carouselSettings?.['golden-oldies']?.visible ?? true) && (
      <Carousel title="🕰️ Golden Oldies" items={filteredGoldenOldies} onTap={handleCarouselTap} onReset={() => resetCarousel('golden-oldies')} {...carouselBurnProps('golden-oldies')} />
    ),
    'climbers': (carouselSettings?.['climbers']?.visible ?? true) && (
      <Carousel title="📈 Climbers" items={filteredClimbers} onTap={handleCarouselTap} onReset={() => resetCarousel('climbers')} {...carouselBurnProps('climbers')} />
    ),
    'fallers': (carouselSettings?.['fallers']?.visible ?? true) && (
      <Carousel title="📉 Fallers" items={filteredFallers} onTap={handleCarouselTap} onReset={() => resetCarousel('fallers')} {...carouselBurnProps('fallers')} />
    ),
    'on-this-day': (carouselSettings?.['on-this-day']?.visible ?? true) && (
      <Carousel title="📅 On This Day" items={filteredOnThisDayItems} onTap={handleCarouselTap} onReset={() => resetCarousel('on-this-day')} {...carouselBurnProps('on-this-day')} />
    ),
  }

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {order.map(id => blocks[id]
        ? <Fragment key={id}>{blocks[id]}</Fragment>
        : null
      )}

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={getAlbumStats(selectedAlbum)}
          saved={isSaved?.(selectedAlbum.id) ?? false}
          onSave={(album) => { saveLater(album); burnAlbum(album, selectedCarouselId, 'save') }}
          onRemove={removeLater}
          onClose={() => { setSelectedAlbum(null); setSelectedCarouselId(null) }}
          onQueue={(album) => burnAlbum(album, selectedCarouselId, 'queue')}
          library={albums}
          onBadgeClick={onBadgeClick}
        />
      )}
    </div>
  )
```

Note: `Fragment` must be imported. Update the import at the top:

```js
import { useState, useMemo, Fragment } from 'react'
```

- [ ] **Step 3: Verify in browser**

Open the Insights tab. All carousels still appear in the default order. The app does not crash.

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat: StatsTab renders carousels in carouselSettings._order order"
```

---

## Task 7: Settings — drag-to-reorder + Explore Playlists

**Files:**
- Modify: `src/components/layout/Header.jsx`

This task replaces the flat `Object.entries(CAROUSEL_LABELS).map(...)` Insights list with a draggable list, adds `onUpdateCarouselOrder`, and replaces the "coming soon" Explore Playlists section with the real UI.

- [ ] **Step 1: Add a `DraggableList` component to `Header.jsx`**

At the top of `Header.jsx`, add a helper component (before `Sidebar`):

```jsx
function DraggableList({ items, onReorder, renderItem }) {
  const [localItems, setLocalItems] = useState(items)
  const [dragIdx, setDragIdx] = useState(null)

  useEffect(() => { setLocalItems(items) }, [items])

  function handleDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnter(idx) {
    if (dragIdx === null || dragIdx === idx) return
    const next = [...localItems]
    const [item] = next.splice(dragIdx, 1)
    next.splice(idx, 0, item)
    setLocalItems(next)
    setDragIdx(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
    onReorder(localItems.map(i => i.id))
  }

  return (
    <div>
      {localItems.map((item, idx) => (
        <div
          key={item.id}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragEnter={() => handleDragEnter(idx)}
          onDragOver={e => e.preventDefault()}
          onDragEnd={handleDragEnd}
          style={{ opacity: dragIdx === idx ? 0.4 : 1, transition: 'opacity 0.15s' }}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  )
}
```

Add `useEffect` to the imports at the top: `import { useState, useEffect } from 'react'`

- [ ] **Step 2: Update `SettingsModal` signature to accept new props**

Replace the `SettingsModal` function signature:

```jsx
function SettingsModal({
  isOpen,
  onClose,
  albumCount,
  lastfmMeta,
  onRefresh,
  carouselSettings,
  onUpdateCarouselSettings,
  onUpdateCarouselOrder,
  playlists,
  playlistsLoading,
  playlistsError,
  selectedPlaylists,
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
}) {
```

- [ ] **Step 3: Replace Insights Carousels section with draggable list**

Find the `{/* Carousels section */}` block in `SettingsModal`. Replace the inner `Object.entries(CAROUSEL_LABELS).map(...)` render with a `DraggableList`.

The full Carousels section becomes:

```jsx
              {/* Carousels section */}
              <div className="border-t border-border-subtle pt-2">
                <button
                  onClick={() => toggle('carousels')}
                  className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
                >
                  <span>Insights Carousels</span>
                  <span className="text-ink-muted">{expandedSection === 'carousels' ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {expandedSection === 'carousels' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4">
                        <DraggableList
                          items={(carouselSettings?._order ?? Object.keys(CAROUSEL_LABELS)).map(id => ({ id, label: CAROUSEL_LABELS[id] }))}
                          onReorder={onUpdateCarouselOrder}
                          renderItem={({ id, label }) => {
                            const settings = carouselSettings?.[id] || { visible: true, sort: 'original' }
                            return (
                              <div className="flex items-center gap-2 bg-card-raised p-3 rounded-xl border border-border-subtle mb-2">
                                <span className="text-ink-muted text-base select-none cursor-grab active:cursor-grabbing">⠿</span>
                                <span className="text-sm font-medium flex-1">{label}</span>
                                <div className="flex gap-1">
                                  {SORT_OPTIONS.map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => onUpdateCarouselSettings(id, { sort: opt.id })}
                                      className={cn(
                                        'px-2 py-1 rounded text-[10px] font-bold transition-all',
                                        settings.sort === opt.id
                                          ? 'bg-accent text-page'
                                          : 'text-ink-muted hover:text-ink'
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => onUpdateCarouselSettings(id, { visible: !settings.visible })}
                                  className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                                    settings.visible
                                      ? 'bg-accent/20 text-accent border-accent/30'
                                      : 'bg-transparent text-ink-muted border-border-subtle'
                                  )}
                                >
                                  {settings.visible ? 'On' : 'Off'}
                                </button>
                              </div>
                            )
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
```

- [ ] **Step 4: Replace Explore Playlists section**

Find the `{/* Explore placeholder */}` block and replace it with:

```jsx
              {/* Explore Playlists section */}
              <div className="border-t border-border-subtle pt-2">
                <button
                  onClick={() => toggle('explore')}
                  className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
                >
                  <span>Explore Playlists</span>
                  <span className="text-ink-muted">{expandedSection === 'explore' ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {expandedSection === 'explore' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4 space-y-3">
                        {/* Header row with refresh button */}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-ink-muted">Select up to 5 playlists</p>
                          <button
                            onClick={onRefreshPlaylists}
                            disabled={playlistsLoading}
                            className="text-xs text-accent font-medium disabled:opacity-50"
                          >
                            {playlistsLoading ? 'Loading…' : 'Refresh ↻'}
                          </button>
                        </div>

                        {/* Error state */}
                        {playlistsError && (
                          <p className="text-xs text-red-400">{playlistsError}</p>
                        )}

                        {/* Playlist picker */}
                        {!playlistsLoading && playlists.length === 0 && !playlistsError && (
                          <p className="text-xs text-ink-muted">No playlists found. Tap Refresh to load.</p>
                        )}
                        {playlists.length > 0 && (
                          <div className="max-h-60 overflow-y-auto rounded-xl border border-border-subtle bg-card-raised">
                            {playlists.map((pl, idx) => {
                              const isSelected = selectedPlaylists.includes(pl.id)
                              const atMax = selectedPlaylists.length >= 5 && !isSelected
                              return (
                                <button
                                  key={pl.id}
                                  disabled={atMax}
                                  onClick={() => {
                                    if (isSelected) {
                                      onUpdateSelectedPlaylists(selectedPlaylists.filter(id => id !== pl.id))
                                    } else {
                                      onUpdateSelectedPlaylists([...selectedPlaylists, pl.id])
                                    }
                                  }}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all',
                                    idx < playlists.length - 1 ? 'border-b border-border-subtle' : '',
                                    atMax ? 'opacity-40' : 'hover:bg-card'
                                  )}
                                >
                                  <span className={cn(
                                    'w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] border',
                                    isSelected
                                      ? 'bg-accent border-accent text-page'
                                      : 'border-border-subtle'
                                  )}>
                                    {isSelected ? '✓' : ''}
                                  </span>
                                  <span className="text-sm flex-1 truncate">{pl.name}</span>
                                  <span className="text-[11px] text-ink-muted flex-shrink-0">{pl.trackCount}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Reorder selected playlists */}
                        {selectedPlaylists.length > 1 && (
                          <>
                            <p className="text-xs text-ink-muted pt-1">Drag to reorder</p>
                            <DraggableList
                              items={selectedPlaylists.map(id => ({
                                id,
                                label: playlists.find(p => p.id === id)?.name ?? id,
                              }))}
                              onReorder={onUpdateSelectedPlaylists}
                              renderItem={({ label }) => (
                                <div className="flex items-center gap-3 bg-card-raised px-4 py-2.5 rounded-xl border border-border-subtle mb-2">
                                  <span className="text-ink-muted text-base select-none cursor-grab active:cursor-grabbing">⠿</span>
                                  <span className="text-sm flex-1 truncate">{label}</span>
                                </div>
                              )}
                            />
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
```

- [ ] **Step 5: Update `Header` default export to pass new props to `SettingsModal`**

Update the `SettingsModal` render inside `Header`:

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
      />
```

Update the `Header` function signature to accept these props:

```jsx
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
  playlists,
  playlistsLoading,
  playlistsError,
  selectedPlaylists,
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
}) {
```

- [ ] **Step 6: Verify Settings in browser**

Open Settings → Insights Carousels. Confirm drag handles appear. Drag one carousel row — it should reorder. Open Insights tab and confirm the order reflects the change.

Open Settings → Explore Playlists. Confirm it shows a Refresh button (playlists load on first open). Select 2+ playlists and confirm the reorder list appears.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Header.jsx
git commit -m "feat: Settings — drag-to-reorder for Insights carousels + Explore Playlists section"
```

---

## Task 8: ExploreTab — full implementation

**Files:**
- Rewrite: `src/components/explore/ExploreTab.jsx`

- [ ] **Step 1: Write ExploreTab**

Replace `src/components/explore/ExploreTab.jsx` entirely:

```jsx
import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AlbumModal from '../AlbumModal.jsx'
import { useBurnTracking } from '../../hooks/useBurnTracking.js'
import { cn } from '../../lib/utils.js'

function fmtAgo(ts) {
  if (!ts) return null
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(days / 7)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  return new Date(ts).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

function ExploreCarouselItem({ album, onTap, inLibrary }) {
  const [imgError, setImgError] = useState(false)
  const art = !imgError ? album.images?.[0]?.url : null

  return (
    <div
      className="flex-shrink-0 w-[calc(50%-8px)] cursor-pointer active:opacity-80 transition-opacity"
      onClick={() => onTap(album, inLibrary)}
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-card mb-2">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={() => setImgError(true)} />
          : <div className="w-full h-full flex items-center justify-center text-3xl">💿</div>
        }
      </div>
      <p className="text-[13px] font-semibold text-ink leading-tight line-clamp-2">{album.name}</p>
      <p className="text-[11px] text-ink-muted mt-0.5 truncate">{album.artists?.[0]?.name}</p>
      <span className={cn(
        'inline-block mt-1 text-[11px] font-medium',
        inLibrary ? 'text-accent' : 'text-[#a0a0ff]'
      )}>
        {inLibrary ? '★ Library' : '+ New'}
      </span>
    </div>
  )
}

export default function ExploreTab({
  albums = [],
  getAlbumStats,
  selectedPlaylists = [],
  playlistAlbums = new Map(),
  playlistsLoading = false,
  saveLater,
  removeLater,
  isSaved,
}) {
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedInLibrary, setSelectedInLibrary] = useState(true)
  const [selectedCarouselId, setSelectedCarouselId] = useState(null)
  const { isBurned, burnAlbum, resetCarousel, burnStats, burnedMap } = useBurnTracking()

  // Build a Set of library album IDs for O(1) lookup
  const libraryIdSet = useMemo(() => new Set(albums.map(a => a.id)), [albums])
  // Build a Map of library albums for quick merge
  const libraryMap = useMemo(() => {
    const m = new Map()
    for (const a of albums) m.set(a.id, a)
    return m
  }, [albums])

  if (selectedPlaylists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4">
        <span className="text-4xl">🎵</span>
        <p className="text-sm font-medium text-ink">No playlists selected</p>
        <p className="text-xs text-ink-muted max-w-xs">
          Open Settings → Explore Playlists to pick up to 5 of your Spotify playlists.
        </p>
      </div>
    )
  }

  function handleTap(album, inLibrary) {
    // If in library, use full library album data
    const albumToOpen = inLibrary ? (libraryMap.get(album.id) ?? album) : album
    setSelectedAlbum(albumToOpen)
    setSelectedInLibrary(inLibrary)
  }

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {selectedPlaylists.map(playlistId => {
        const carouselId = `explore_${playlistId}`
        const rawAlbums = playlistAlbums.get(playlistId)

        if (rawAlbums === undefined) {
          // Not yet loaded
          return (
            <section key={playlistId}>
              <div className="h-4 w-32 bg-card-raised rounded animate-pulse mb-3" />
              <div className="flex gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex-shrink-0 w-[calc(50%-8px)] aspect-square bg-card-raised rounded-xl animate-pulse" />
                ))}
              </div>
            </section>
          )
        }

        // Enrich with _inLibrary flag
        const enriched = rawAlbums.map(a => ({
          ...a,
          _inLibrary: libraryIdSet.has(a.id),
        }))

        const burned = burnedMap.get(carouselId)
        const visible = enriched.filter(a => !isBurned(a.id, carouselId))
        const burnedCount = burned?.size ?? 0
        const completionPct = enriched.length > 0
          ? Math.round((burnedCount / enriched.length) * 100)
          : 0
        const bpStats = burnStats.perCarousel.get(carouselId)
        const lastBurnedAt = bpStats?.lastBurnedAt ?? null

        return (
          <section key={playlistId}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[13px] font-medium text-ink truncate flex-1 mr-2">
                {playlistAlbums.get(playlistId)?.name ?? playlistId}
              </h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lastBurnedAt != null && (
                  <span className="text-[10px] text-ink-muted">{fmtAgo(lastBurnedAt)}</span>
                )}
                <button
                  onClick={() => resetCarousel(carouselId)}
                  className="text-[11px] text-ink-muted active:text-ink flex items-center gap-1"
                >
                  {burnedCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-card-raised text-[9px] font-semibold text-ink-muted">{burnedCount}</span>
                  )}
                  Reset
                </button>
              </div>
            </div>
            {completionPct > 0 && (
              <div className="h-[2px] bg-card-raised rounded-full overflow-hidden mb-2.5">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
            )}
            {!completionPct && <div className="mb-2.5" />}
            {visible.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                <AnimatePresence>
                  {visible.map(album => (
                    <motion.div
                      key={album.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className="flex-shrink-0 w-[calc(50%-8px)]"
                    >
                      <ExploreCarouselItem
                        album={album}
                        onTap={(a, inLib) => {
                          setSelectedCarouselId(carouselId)
                          handleTap(a, inLib)
                        }}
                        inLibrary={album._inLibrary}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <p className="text-[12px] text-ink-muted py-2">All burned — tap Reset to restore.</p>
            )}
          </section>
        )
      })}

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={selectedInLibrary ? getAlbumStats?.(selectedAlbum) : null}
          saved={isSaved?.(selectedAlbum.id) ?? false}
          onSave={(album) => { saveLater(album); burnAlbum(album, selectedCarouselId, 'save') }}
          onRemove={removeLater}
          onClose={() => { setSelectedAlbum(null); setSelectedCarouselId(null) }}
          onQueue={(album) => burnAlbum(album, selectedCarouselId, 'queue')}
          library={albums}
          inLibrary={selectedInLibrary}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Fix playlist name display**

The section title uses `playlistAlbums.get(playlistId)?.name` but `playlistAlbums` is a `Map<id, Album[]>`, not albums with names. We need to pass playlist metadata to ExploreTab. 

In `BrowseTab.jsx`, add `playlists` prop to ExploreTab:

```jsx
    case 'explore':
    default:
      return (
        <ExploreTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          selectedPlaylists={selectedPlaylists}
          playlistAlbums={playlistAlbums}
          playlistsLoading={playlistsLoading}
          playlists={playlists}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
        />
      )
```

Thread `playlists` from `App.jsx` → `BrowseTab.jsx` → `ExploreTab.jsx`:

In `App.jsx` browse case, add `playlists={playlists}` to BrowseTab.

In `BrowseTab.jsx`, add `playlists` to the destructured props and pass it to ExploreTab.

In `ExploreTab.jsx`, add `playlists = []` to the props and use it for the section title:

```jsx
// Replace this line in ExploreTab:
const playlistName = playlists.find(p => p.id === playlistId)?.name ?? playlistId
```

In the section header, replace `{playlistAlbums.get(playlistId)?.name ?? playlistId}` with `{playlists.find(p => p.id === playlistId)?.name ?? playlistId}`.

- [ ] **Step 3: Verify Explore tab end-to-end**

1. Open Settings → Explore Playlists → tap Refresh → wait for playlists to load
2. Select 1-2 playlists → close Settings
3. Go to Browse → Explore tab
4. Confirm playlist carousel(s) appear with album covers
5. Albums in your library should show "★ Library", others "+ New"
6. Tap a library album → AlbumModal opens normally with Last.fm stats
7. Tap a non-library album → AlbumModal opens, "Loading…" briefly on Queue button, then becomes active
8. Queue a non-library album → burns it and closes modal
9. Confirm burn tracking: burned count badge appears, progress bar fills, Reset restores all

- [ ] **Step 4: Commit**

```bash
git add src/components/explore/ExploreTab.jsx src/components/browse/BrowseTab.jsx src/App.jsx
git commit -m "feat: implement ExploreTab with playlist carousels and burn tracking"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `usePlaylists` hook with lazy album fetch (Task 3)
- ✅ `fetchCurrentUser`, `fetchUserPlaylists`, `fetchPlaylistItems`, `fetchAlbumTracks` (Task 2)
- ✅ No TTL / manual refresh (Tasks 3, 7)
- ✅ `selectedPlaylists` in localStorage `sonar_selected_playlists` (Task 4)
- ✅ Carousel order via `sonar_carousel_settings._order` (Tasks 4, 6)
- ✅ `_inLibrary` flag with Library vs New label (Task 8)
- ✅ AlbumModal: full for library, lazy tracks for non-library (Task 5)
- ✅ Burn tracking per playlist carousel (Task 8)
- ✅ Drag-to-reorder Insights (Task 7)
- ✅ Explore Playlists section in Settings with picker + drag (Task 7)
- ✅ Empty state when no playlists selected (Task 8)
- ✅ Podcast/non-track filter (`item.track.type !== 'track'`) (Task 2)

**Placeholder scan:** No TBD/TODO remaining.

**Type consistency:** 
- `carouselId` for explore carousels is always `explore_${playlistId}` — used consistently in Task 8
- `DraggableList.items` shape: `{id: string, label: string}[]` — used consistently in Task 7
- `usePlaylists` returns `{playlists, playlistAlbums, loading, error, refreshPlaylists}` — matches Task 4 destructuring
