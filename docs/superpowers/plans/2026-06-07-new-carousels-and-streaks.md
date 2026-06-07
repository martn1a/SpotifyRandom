# New Carousels + Listening Streaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new carousels (Überfällig, Peak Nostalgie, Lange Wartend, Artist-Lücken, Frühere Liebe, Genre Deep Dive, Gateway) and a Listening Streaks stats card to StatsTab, all toggleable in Settings.

**Architecture:** Pure frontend — all computations in `useMemo` inside `StatsTab.jsx`, using existing `enriched`, `albums`, and `lastfmMap` data. Settings wiring via `CAROUSEL_LABELS` in `Header.jsx` and `defaultCarouselSettings()` in `App.jsx`.

**Tech Stack:** React, Tailwind CSS v4, existing `clusterOf()` from `src/data/genre-clusters.js`, existing `useBurnTracking` hook

---

## Files

| File | Change |
|---|---|
| `src/components/layout/Header.jsx` | Add 8 entries to `CAROUSEL_LABELS`, skip Sort UI for `streaks` |
| `src/App.jsx` | Add 8 entries to `defaultCarouselSettings()` |
| `src/components/stats/StatsTab.jsx` | Add import, update `DEFAULT_CAROUSEL_ORDER`, add `lastfmByKey` + 9 new `useMemo`s, update `originalLengths`, add 8 burn-filtered arrays, add 8 `blocks` entries |

---

## Task 1: Settings Wiring — Header.jsx + App.jsx

**Files:**
- Modify: `src/components/layout/Header.jsx:6-14` (CAROUSEL_LABELS)
- Modify: `src/components/layout/Header.jsx:349-364` (skip Sort for streaks)
- Modify: `src/App.jsx:75-86` (defaultCarouselSettings)

- [ ] **Step 1: Add new carousel labels to CAROUSEL_LABELS in Header.jsx**

Replace:
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
With:
```js
const CAROUSEL_LABELS = {
  'most-played':        '👑 Most Played',
  'latest-discoveries': '🔭 Latest Discoveries',
  'golden-oldies':      '🕰️ Golden Oldies',
  'climbers':           '📈 Climbers',
  'fallers':            '📉 Fallers',
  'on-this-day':        '📅 On This Day',
  'recently-added':     '🔔 Recently Added',
  'overdue':            '⏰ Überfällig',
  'peak-nostalgie':     '📅 Peak Nostalgie',
  'long-waiting':       '📦 Lange Wartend',
  'artist-gaps':        '🎯 Artist-Lücken',
  'former-love':        '💔 Frühere Liebe',
  'genre-dive':         '🎸 Genre Deep Dive',
  'gateway':            '🚪 Gateway',
  'streaks':            '🔥 Listening Streaks',
}
```

- [ ] **Step 2: Skip Sort UI for streaks in Header.jsx**

In `renderItem`, the sort buttons section looks like:
```jsx
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
```

Replace with:
```jsx
<div className="flex gap-1">
  {id !== 'streaks' && SORT_OPTIONS.map(opt => (
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
```

- [ ] **Step 3: Add new carousel defaults to App.jsx**

Replace:
```js
function defaultCarouselSettings() {
  return {
    _order: ['most-played', 'latest-discoveries', 'recently-added', 'golden-oldies', 'climbers', 'fallers', 'on-this-day'],
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
With:
```js
function defaultCarouselSettings() {
  return {
    _order: ['most-played', 'latest-discoveries', 'recently-added', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'overdue', 'peak-nostalgie', 'long-waiting', 'artist-gaps', 'former-love', 'genre-dive', 'gateway', 'streaks'],
    'most-played':        { visible: true, sort: 'original' },
    'latest-discoveries': { visible: true, sort: 'original' },
    'golden-oldies':      { visible: true, sort: 'original' },
    'climbers':           { visible: true, sort: 'original' },
    'fallers':            { visible: true, sort: 'original' },
    'on-this-day':        { visible: true, sort: 'original' },
    'recently-added':     { visible: true, sort: 'original' },
    'overdue':            { visible: true, sort: 'original' },
    'peak-nostalgie':     { visible: true, sort: 'original' },
    'long-waiting':       { visible: true, sort: 'original' },
    'artist-gaps':        { visible: true, sort: 'original' },
    'former-love':        { visible: true, sort: 'original' },
    'genre-dive':         { visible: true, sort: 'original' },
    'gateway':            { visible: true, sort: 'original' },
    'streaks':            { visible: true },
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.jsx src/App.jsx
git commit -m "feat(stats): wire new carousel settings — labels + defaults"
```

---

## Task 2: StatsTab Infrastructure

**Files:**
- Modify: `src/components/stats/StatsTab.jsx:1` (add import)
- Modify: `src/components/stats/StatsTab.jsx:20-22` (DEFAULT_CAROUSEL_ORDER)
- Modify: `src/components/stats/StatsTab.jsx` (add `lastfmByKey` useMemo after `spotifyLookup`)

- [ ] **Step 1: Add clusterOf + GENRE_CLUSTERS import**

At the top of `src/components/stats/StatsTab.jsx`, add after the existing imports:
```js
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'
```

- [ ] **Step 2: Extend DEFAULT_CAROUSEL_ORDER**

Replace:
```js
const DEFAULT_CAROUSEL_ORDER = [
  'most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'recently-added',
]
```
With:
```js
const DEFAULT_CAROUSEL_ORDER = [
  'most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'recently-added',
  'overdue', 'peak-nostalgie', 'long-waiting', 'artist-gaps', 'former-love', 'genre-dive', 'gateway', 'streaks',
]
```

- [ ] **Step 3: Add lastfmByKey useMemo**

In `StatsTab`, after the `spotifyLookup` useMemo (around line 174), add:

```js
  // Reverse lookup: normalized key → lastfm entry (for Spotify-sourced carousels)
  const lastfmByKey = useMemo(() => {
    const m = new Map()
    for (const [key, entry] of lastfmMap.entries()) {
      m.set(key, entry)
    }
    return m
  }, [lastfmMap])
```

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): add infrastructure for new carousels — import, order, lastfmByKey"
```

---

## Task 3: Carousels from enriched — Überfällig, Peak Nostalgie, Frühere Liebe

**Files:**
- Modify: `src/components/stats/StatsTab.jsx` (add 3 useMemos after existing carousel useMemos, before `onThisDayItems`)

All three use the existing `enriched` array (lastfm entries matched to library albums with `listenCount > 0`).

- [ ] **Step 1: Add overdue useMemo**

After the `fallers` useMemo (around line 251), add:

```js
  const overdue = useMemo(() => {
    return [...enriched]
      .filter(e =>
        e.avgGapDays != null &&
        e.listenCount > 0 &&
        (now - (e.lastHeard || 0)) > e.avgGapDays * 1.5 * 86400000
      )
      .map(e => ({
        ...e,
        _overdueRatio: (now - (e.lastHeard || 0)) / (e.avgGapDays * 86400000),
        _stat: `Alle ${Math.round(e.avgGapDays)}d — seit ${Math.round((now - (e.lastHeard || 0)) / 86400000)}d`,
        _carouselId: 'overdue',
      }))
      .sort((a, b) => b._overdueRatio - a._overdueRatio)
      .slice(0, 20)
  }, [enriched, now])
```

- [ ] **Step 2: Add peakNostalgie useMemo**

```js
  const peakNostalgie = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1
    return [...enriched]
      .filter(e => {
        if (!e.peakMonth) return false
        const mm = parseInt(e.peakMonth.split('-')[1], 10)
        return mm === currentMonth
      })
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({
        ...e,
        _stat: `Peak ${e.peakMonth.split('-')[0]}`,
        _carouselId: 'peak-nostalgie',
      }))
  }, [enriched])
```

- [ ] **Step 3: Add formerLove useMemo**

```js
  const formerLove = useMemo(() =>
    [...enriched]
      .filter(e =>
        e.listenCount >= 5 &&
        e.trend === 'falling' &&
        (now - (e.lastHeard || 0)) > 180 * 86400000
      )
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({
        ...e,
        _stat: `${e.listenCount}× — vor ${Math.round((now - (e.lastHeard || 0)) / 86400000 / 30)}M`,
        _carouselId: 'former-love',
      }))
  , [enriched, now])
```

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): add Überfällig, Peak Nostalgie, Frühere Liebe useMemos"
```

---

## Task 4: Library-Based Carousels — Lange Wartend + Artist-Lücken

**Files:**
- Modify: `src/components/stats/StatsTab.jsx` (add 2 useMemos)

These use `albums` (the full Spotify library with `_genres`) as their source, plus `lastfmByKey` for listen-count lookup.

- [ ] **Step 1: Add longWaiting useMemo**

```js
  const longWaiting = useMemo(() => {
    return albums
      .filter(a => a._added_at)
      .map(a => {
        const artist = a.artists?.[0]?.name || ''
        const key    = `${artist}||${a.name}`.toLowerCase()
        const normKey = normalizeAlbumKey(artist, a.name)
        const lfm    = lastfmByKey.get(key) ?? lastfmByKey.get(normKey)
        return { a, artist, listenCount: lfm?.listenCount ?? 0 }
      })
      .filter(({ listenCount }) => listenCount === 0)
      .sort((x, y) => new Date(x.a._added_at) - new Date(y.a._added_at))
      .slice(0, 20)
      .map(({ a, artist }) => ({
        name:        a.name,
        artist,
        spotifyAlbum: a,
        listenCount: 0,
        _stat:       `Seit ${Math.round((now - new Date(a._added_at).getTime()) / 86400000)}d in Library`,
        _carouselId: 'long-waiting',
      }))
  }, [albums, lastfmByKey, now])
```

- [ ] **Step 2: Add artistGaps useMemo**

```js
  const artistGaps = useMemo(() => {
    const lovedArtists = new Set(
      enriched
        .filter(e => e.listenCount >= 3)
        .map(e => (e.artist || '').toLowerCase())
    )

    return albums
      .filter(a => {
        const artist = a.artists?.[0]?.name || ''
        if (!lovedArtists.has(artist.toLowerCase())) return false
        const key     = `${artist}||${a.name}`.toLowerCase()
        const normKey = normalizeAlbumKey(artist, a.name)
        const lfm     = lastfmByKey.get(key) ?? lastfmByKey.get(normKey)
        return (lfm?.listenCount ?? 0) === 0
      })
      .sort((a, b) =>
        (a.artists?.[0]?.name || '').localeCompare(b.artists?.[0]?.name || '')
      )
      .slice(0, 20)
      .map(a => {
        const artist = a.artists?.[0]?.name || ''
        return {
          name:        a.name,
          artist,
          spotifyAlbum: a,
          listenCount: 0,
          _stat:       `${artist} • Noch nicht gehört`,
          _carouselId: 'artist-gaps',
        }
      })
  }, [enriched, albums, lastfmByKey])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): add Lange Wartend, Artist-Lücken useMemos"
```

---

## Task 5: Recommendation Carousels — Genre Deep Dive + Gateway

**Files:**
- Modify: `src/components/stats/StatsTab.jsx` (add 2 useMemos)

Both use `clusterOf(genreTag)` to map genre tags → cluster IDs. Albums have `_genres: string[]` (genre tags from Last.fm).

- [ ] **Step 1: Add genreDive useMemo**

```js
  const genreDive = useMemo(() => {
    const cutoff30 = now - 30 * 86400000

    // Count recent sessions per cluster
    const clusterCounts = new Map()
    for (const e of enriched) {
      const recent = (e.sessionDates || []).filter(d => d > cutoff30).length
      if (recent === 0) continue
      const tags    = e.spotifyAlbum?._genres || []
      const cluster = tags.map(g => clusterOf(g)).find(c => c !== 'other')
      if (!cluster) continue
      clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + recent)
    }

    if (clusterCounts.size === 0) return []

    const topCluster = [...clusterCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0][0]
    const topLabel = GENRE_CLUSTERS.find(c => c.id === topCluster)?.label ?? topCluster

    return albums
      .filter(a => {
        const tags    = a._genres || []
        const cluster = tags.map(g => clusterOf(g)).find(c => c !== 'other')
        if (cluster !== topCluster) return false
        const artist  = a.artists?.[0]?.name || ''
        const key     = `${artist}||${a.name}`.toLowerCase()
        const normKey = normalizeAlbumKey(artist, a.name)
        const lfm     = lastfmByKey.get(key) ?? lastfmByKey.get(normKey)
        return (lfm?.listenCount ?? 0) === 0
      })
      .sort((a, b) => new Date(b._added_at || 0) - new Date(a._added_at || 0))
      .slice(0, 20)
      .map(a => ({
        name:        a.name,
        artist:      a.artists?.[0]?.name || '',
        spotifyAlbum: a,
        listenCount: 0,
        _stat:       `Weil du ${topLabel} liebst`,
        _carouselId: 'genre-dive',
      }))
  }, [enriched, albums, lastfmByKey, now])
```

- [ ] **Step 2: Add gateway useMemo**

```js
  const gateway = useMemo(() => {
    const cutoff90 = now - 90 * 86400000

    const discoveryGenres = new Set()
    for (const e of enriched) {
      if (!e.firstHeard || e.firstHeard <= cutoff90) continue
      const tags    = e.spotifyAlbum?._genres || []
      const cluster = tags.map(g => clusterOf(g)).find(c => c !== 'other')
      if (cluster) discoveryGenres.add(cluster)
    }

    if (discoveryGenres.size === 0) return []

    // Daily seed for deterministic shuffle
    const today = new Date().toISOString().slice(0, 10)
    const seed  = today.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0)

    return albums
      .filter(a => {
        const tags    = a._genres || []
        const cluster = tags.map(g => clusterOf(g)).find(c => c !== 'other')
        if (!cluster || !discoveryGenres.has(cluster)) return false
        const artist  = a.artists?.[0]?.name || ''
        const key     = `${artist}||${a.name}`.toLowerCase()
        const normKey = normalizeAlbumKey(artist, a.name)
        const lfm     = lastfmByKey.get(key) ?? lastfmByKey.get(normKey)
        return (lfm?.listenCount ?? 0) === 0
      })
      .map(a => ({ a, _sort: Math.sin(seed + a.name.length + (a.artists?.[0]?.name || '').length) }))
      .sort((x, y) => x._sort - y._sort)
      .slice(0, 20)
      .map(({ a }) => ({
        name:        a.name,
        artist:      a.artists?.[0]?.name || '',
        spotifyAlbum: a,
        listenCount: 0,
        _stat:       'Frisch entdecktes Genre',
        _carouselId: 'gateway',
      }))
  }, [enriched, albums, lastfmByKey, now])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): add Genre Deep Dive, Gateway useMemos"
```

---

## Task 6: Listening Streaks useMemos

**Files:**
- Modify: `src/components/stats/StatsTab.jsx` (add 2 useMemos — `listeningDays` + `streakStats`)

`listeningDays` aggregates all `sessionDates` from the full `lastfmMap` (not just `enriched`) into a Set of date strings.

- [ ] **Step 1: Add listeningDays useMemo**

```js
  const listeningDays = useMemo(() => {
    const days = new Set()
    for (const entry of lastfmMap.values()) {
      for (const ts of entry.sessionDates || []) {
        days.add(new Date(ts).toISOString().slice(0, 10))
      }
    }
    return days
  }, [lastfmMap])
```

- [ ] **Step 2: Add streakStats useMemo**

```js
  const streakStats = useMemo(() => {
    if (listeningDays.size === 0) return { current: 0, longest: 0, total: 0, lastDay: null }

    const todayStr     = new Date().toISOString().slice(0, 10)
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    // Current streak: count back from today (or yesterday if today not yet heard)
    let current  = 0
    const startDay = listeningDays.has(todayStr)
      ? todayStr
      : listeningDays.has(yesterdayStr) ? yesterdayStr : null

    if (startDay) {
      let d = new Date(startDay)
      while (listeningDays.has(d.toISOString().slice(0, 10))) {
        current++
        d = new Date(d.getTime() - 86400000)
      }
    }

    // Longest streak: sorted unique days → max consecutive run
    const sorted  = [...listeningDays].sort()
    let longest   = sorted.length > 0 ? 1 : 0
    let run       = 1
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = Math.round(
        (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000
      )
      if (diffDays === 1) {
        run++
        if (run > longest) longest = run
      } else {
        run = 1
      }
    }

    return {
      current,
      longest,
      total:   listeningDays.size,
      lastDay: sorted[sorted.length - 1],
    }
  }, [listeningDays])
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): add listeningDays + streakStats useMemos"
```

---

## Task 7: Burn Filters + originalLengths

**Files:**
- Modify: `src/components/stats/StatsTab.jsx` (update `originalLengths` + add 7 burn-filtered arrays)

- [ ] **Step 1: Update originalLengths**

Replace the `originalLengths` useMemo:
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
With:
```js
  const originalLengths = useMemo(() => ({
    'most-played':        mostPlayed.length,
    'latest-discoveries': latestDiscoveries.length,
    'golden-oldies':      goldenOldies.length,
    'climbers':           climbers.length,
    'fallers':            fallers.length,
    'on-this-day':        onThisDayItems.length,
    'recently-added':     recentlyAdded.length,
    'overdue':            overdue.length,
    'peak-nostalgie':     peakNostalgie.length,
    'long-waiting':       longWaiting.length,
    'artist-gaps':        artistGaps.length,
    'former-love':        formerLove.length,
    'genre-dive':         genreDive.length,
    'gateway':            gateway.length,
  }), [mostPlayed, latestDiscoveries, goldenOldies, climbers, fallers, onThisDayItems, recentlyAdded, overdue, peakNostalgie, longWaiting, artistGaps, formerLove, genreDive, gateway])
```

- [ ] **Step 2: Add 7 burn-filtered arrays**

After the existing burn-filtered arrays (after `filteredRecentlyAdded`, around line 310), add:

```js
  const filteredOverdue = useMemo(
    () => overdue.filter(e => !isBurned(e.spotifyAlbum?.id, 'overdue')),
    [overdue, burnedMap]
  )
  const filteredPeakNostalgie = useMemo(
    () => peakNostalgie.filter(e => !isBurned(e.spotifyAlbum?.id, 'peak-nostalgie')),
    [peakNostalgie, burnedMap]
  )
  const filteredLongWaiting = useMemo(
    () => longWaiting.filter(e => !isBurned(e.spotifyAlbum?.id, 'long-waiting')),
    [longWaiting, burnedMap]
  )
  const filteredArtistGaps = useMemo(
    () => artistGaps.filter(e => !isBurned(e.spotifyAlbum?.id, 'artist-gaps')),
    [artistGaps, burnedMap]
  )
  const filteredFormerLove = useMemo(
    () => formerLove.filter(e => !isBurned(e.spotifyAlbum?.id, 'former-love')),
    [formerLove, burnedMap]
  )
  const filteredGenreDive = useMemo(
    () => genreDive.filter(e => !isBurned(e.spotifyAlbum?.id, 'genre-dive')),
    [genreDive, burnedMap]
  )
  const filteredGateway = useMemo(
    () => gateway.filter(e => !isBurned(e.spotifyAlbum?.id, 'gateway')),
    [gateway, burnedMap]
  )
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): add burn filters + originalLengths for new carousels"
```

---

## Task 8: Render — blocks entries + Streaks Card

**Files:**
- Modify: `src/components/stats/StatsTab.jsx` (add 8 entries to `blocks` object)

The `blocks` object starts around line 356. Add the new entries inside it, after `'recently-added'`.

- [ ] **Step 1: Add the 7 new carousel blocks**

Inside the `blocks` object, after the `'recently-added'` entry, add:

```jsx
    'overdue': (carouselSettings?.['overdue']?.visible ?? true) && (
      <Carousel title="⏰ Überfällig" items={filteredOverdue} onTap={handleCarouselTap} onReset={() => resetCarousel('overdue')} {...carouselBurnProps('overdue')} />
    ),
    'peak-nostalgie': (carouselSettings?.['peak-nostalgie']?.visible ?? true) && (
      <Carousel title="📅 Peak Nostalgie" items={filteredPeakNostalgie} onTap={handleCarouselTap} onReset={() => resetCarousel('peak-nostalgie')} {...carouselBurnProps('peak-nostalgie')} />
    ),
    'long-waiting': (carouselSettings?.['long-waiting']?.visible ?? true) && (
      <Carousel title="📦 Lange Wartend" items={filteredLongWaiting} onTap={handleCarouselTap} onReset={() => resetCarousel('long-waiting')} {...carouselBurnProps('long-waiting')} />
    ),
    'artist-gaps': (carouselSettings?.['artist-gaps']?.visible ?? true) && (
      <Carousel title="🎯 Artist-Lücken" items={filteredArtistGaps} onTap={handleCarouselTap} onReset={() => resetCarousel('artist-gaps')} {...carouselBurnProps('artist-gaps')} />
    ),
    'former-love': (carouselSettings?.['former-love']?.visible ?? true) && (
      <Carousel title="💔 Frühere Liebe" items={filteredFormerLove} onTap={handleCarouselTap} onReset={() => resetCarousel('former-love')} {...carouselBurnProps('former-love')} />
    ),
    'genre-dive': (carouselSettings?.['genre-dive']?.visible ?? true) && (
      <Carousel title="🎸 Genre Deep Dive" items={filteredGenreDive} onTap={handleCarouselTap} onReset={() => resetCarousel('genre-dive')} {...carouselBurnProps('genre-dive')} />
    ),
    'gateway': (carouselSettings?.['gateway']?.visible ?? true) && (
      <Carousel title="🚪 Gateway" items={filteredGateway} onTap={handleCarouselTap} onReset={() => resetCarousel('gateway')} {...carouselBurnProps('gateway')} />
    ),
```

- [ ] **Step 2: Add the Streaks card block**

```jsx
    'streaks': (carouselSettings?.['streaks']?.visible ?? true) && (() => {
      const pct = streakStats.longest > 0
        ? Math.round((streakStats.current / streakStats.longest) * 100)
        : 0
      return (
        <section>
          <h2 className="text-[13px] font-medium text-ink mb-2.5">🔥 Listening Streaks</h2>
          <div className="bg-card rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-[26px] font-bold text-ink leading-none">{streakStats.current}</p>
                <p className="text-[10px] text-ink-muted mt-1">Aktuell</p>
              </div>
              <div className="text-center border-x border-border-subtle">
                <p className="text-[26px] font-bold text-accent leading-none">{streakStats.longest}</p>
                <p className="text-[10px] text-ink-muted mt-1">Längste</p>
              </div>
              <div className="text-center">
                <p className="text-[26px] font-bold text-ink leading-none">{streakStats.total}</p>
                <p className="text-[10px] text-ink-muted mt-1">Gesamt</p>
              </div>
            </div>
            {streakStats.longest > 0 && (
              <div className="h-[3px] bg-card-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {streakStats.current === 0 && streakStats.lastDay && (
              <p className="text-[11px] text-ink-muted mt-2 text-center">
                Zuletzt gehört: {new Date(streakStats.lastDay).toLocaleDateString('de', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </section>
      )
    })(),
```

- [ ] **Step 3: Run the dev server and verify**

```bash
npm run dev
```

Open the app → browse to Stats/Insights tab. Check:
- New carousels appear at the bottom (scroll down)
- Settings panel shows all 8 new entries with On/Off toggle
- Streaks card shows numbers (not 0/0/0 unless no sessionDates in data)
- Streaks entry in settings has no Sort buttons
- Existing carousels are unaffected

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat(stats): render new carousels + Listening Streaks card"
```
