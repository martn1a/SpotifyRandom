# SONAR Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the AI Studio SONAR redesign into the existing React app — 3-tab navigation (Discover/Browse/Later), framer-motion animations, album badges, Similar To section, sidebar and settings modal — without changing any data hooks or API code.

**Architecture:** Component-by-component port. All real data (Spotify library, Last.fm stats, IndexedDB) stays in existing hooks unchanged. The UI layer is replaced tab by tab, starting from the shell (App.jsx, Header, TabBar), then shared components (AlbumModal), then individual tabs. New utility functions (`cn`, `getAlbumBadges`, `getSimilarAlbums`) are unit-tested with Vitest.

**Tech Stack:** React 19 + Vite 6, Tailwind CSS v4, `motion/react` (framer-motion v11), `clsx`, `tailwind-merge`, Vitest (dev only)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/utils.js` | `cn()` — className merger |
| Create | `src/lib/badge-utils.js` | `getAlbumBadges()` + `getSimilarAlbums()` |
| Create | `src/components/browse/BrowseTab.jsx` | Browse container with Library/Insights/Explore sub-tabs |
| Create | `src/components/explore/ExploreTab.jsx` | "Coming Soon" placeholder |
| Create | `src/tests/utils.test.js` | Vitest tests for utils.js |
| Create | `src/tests/badge-utils.test.js` | Vitest tests for badge-utils.js |
| Modify | `vite.config.js` | Add Vitest test config |
| Modify | `package.json` | Add motion, clsx, tailwind-merge, vitest |
| Modify | `src/App.jsx` | 3-tab routing, new state, handleBadgeClick |
| Modify | `src/components/layout/Header.jsx` | SONAR branding, Sidebar, Settings Modal |
| Modify | `src/components/layout/TabBar.jsx` | 3 tabs + Browse sub-tab row |
| Modify | `src/components/AlbumModal.jsx` | framer-motion, badges, burn animation, Similar To |
| Modify | `src/components/library/LibraryTab.jsx` | Inline filter panel, badge filter banner |
| Modify | `src/components/stats/StatsTab.jsx` | Time-range filter for Most Played, carousel settings prop |
| Modify | `src/components/listen-later/ListenLaterTab.jsx` | 2-column grid layout |
| Modify | `src/components/discover/DiscoverTab.jsx` | Visual refresh, framer-motion drag for swipe |

---

## Task 1: Create branch + install dependencies

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Create the feature branch**

```bash
cd /path/to/SpotifyRandom
git checkout -b feature/sonar-redesign
```

Expected: prompt shows `Switched to a new branch 'feature/sonar-redesign'`

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install motion clsx tailwind-merge
```

Expected: `package.json` now lists `motion`, `clsx`, `tailwind-merge` under `dependencies`.

- [ ] **Step 3: Install Vitest**

```bash
npm install -D vitest
```

Expected: `vitest` appears under `devDependencies`.

- [ ] **Step 4: Add test script to package.json**

Open `package.json`. The `scripts` section currently is:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

Change it to:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Add Vitest config to vite.config.js**

`vite.config.js` currently is:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  base: '/SpotifyRandom/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: true,
  },
})
```

Add `test` config:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  base: '/SpotifyRandom/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 6: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected output: `No test files found` or similar — no errors, just no tests yet.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "chore: install motion, clsx, tailwind-merge, vitest for SONAR redesign"
```

---

## Task 2: src/lib/utils.js

**Files:**
- Create: `src/lib/utils.js`
- Create: `src/tests/utils.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/tests/utils.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { cn } from '../lib/utils.js'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('drops falsy values', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar')
  })

  it('resolves tailwind conflicts (last wins)', () => {
    // tailwind-merge: bg-red-500 then bg-blue-500 → bg-blue-500 wins
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('handles conditional objects (clsx)', () => {
    expect(cn({ 'text-accent': true, 'text-muted': false })).toBe('text-accent')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../lib/utils.js'`

- [ ] **Step 3: Create src/lib/utils.js**

```js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: `4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.js src/tests/utils.test.js
git commit -m "feat: add cn() utility (clsx + tailwind-merge)"
```

---

## Task 3: src/lib/badge-utils.js

**Files:**
- Create: `src/lib/badge-utils.js`
- Create: `src/tests/badge-utils.test.js`

**Context:** `getAlbumBadges(album, stats)` takes a Spotify album object (with `_genres: string[]`, `release_date: string`, `tracks.items: array`) and a Last.fm stats object (from `getAlbumStats()`, shape: `{ listenCount: number } | null`). `getSimilarAlbums(album, library, count)` takes the same album, the full Spotify library array, and a count limit.

The `clusterOf(genreString)` function from `src/data/genre-clusters.js` returns a cluster id string or `'other'`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/badge-utils.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { getAlbumBadges, getSimilarAlbums } from '../lib/badge-utils.js'

// Minimal album fixture
const makeAlbum = (overrides = {}) => ({
  id: 'a1',
  release_date: '1995-01-01',
  _genres: [],
  tracks: { items: Array(10).fill({}) },
  ...overrides,
})

describe('getAlbumBadges', () => {
  it('returns Unheard badge when listenCount is 0', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 0 })
    expect(badges.some(b => b.value === 'unheard')).toBe(true)
  })

  it('returns Hidden Gem badge when listenCount is between 1 and 4', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 3 })
    expect(badges.some(b => b.value === 'hidden-gem')).toBe(true)
  })

  it('returns Heavy Rotation badge when listenCount > 50', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 75 })
    expect(badges.some(b => b.value === 'heavy-rotation')).toBe(true)
  })

  it('returns Masterpiece badge when listenCount > 100', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 120 })
    expect(badges.some(b => b.value === 'masterpiece')).toBe(true)
  })

  it('returns Vintage badge for pre-1970 releases', () => {
    const badges = getAlbumBadges(makeAlbum({ release_date: '1965-01-01' }), null)
    expect(badges.some(b => b.value === 'vintage')).toBe(true)
  })

  it('returns Golden Oldie badge for 1970s releases', () => {
    const badges = getAlbumBadges(makeAlbum({ release_date: '1975-01-01' }), null)
    expect(badges.some(b => b.value === 'golden-oldie')).toBe(true)
  })

  it('returns Brand New badge for 2024+ releases', () => {
    const badges = getAlbumBadges(makeAlbum({ release_date: '2024-06-01' }), null)
    expect(badges.some(b => b.value === 'brand-new')).toBe(true)
  })

  it('returns Epic LP badge when track count >= 15', () => {
    const album = makeAlbum({ tracks: { items: Array(16).fill({}) } })
    const badges = getAlbumBadges(album, null)
    expect(badges.some(b => b.value === 'epic-lp')).toBe(true)
  })

  it('returns EP badge when track count <= 6', () => {
    const album = makeAlbum({ tracks: { items: Array(5).fill({}) } })
    const badges = getAlbumBadges(album, null)
    expect(badges.some(b => b.value === 'ep')).toBe(true)
  })

  it('returns empty array when stats is null and album is unremarkable', () => {
    // Release 1995, 10 tracks, no genres → no badges
    const badges = getAlbumBadges(makeAlbum(), null)
    expect(badges).toEqual([])
  })
})

describe('getSimilarAlbums', () => {
  const library = [
    makeAlbum({ id: 'a1', _genres: ['rock', 'alternative'] }),
    makeAlbum({ id: 'a2', _genres: ['rock', 'grunge'] }),
    makeAlbum({ id: 'a3', _genres: ['jazz', 'blues'] }),
    makeAlbum({ id: 'a4', _genres: ['rock', 'indie'] }),
    makeAlbum({ id: 'a5', _genres: ['electronic', 'ambient'] }),
  ]
  const currentAlbum = library[0] // a1, rock cluster

  it('excludes the current album from results', () => {
    const results = getSimilarAlbums(currentAlbum, library, 4)
    expect(results.find(a => a.id === 'a1')).toBeUndefined()
  })

  it('returns only albums from the same genre cluster', () => {
    const results = getSimilarAlbums(currentAlbum, library, 4)
    // a2 (rock/grunge) and a4 (rock/indie) should be included; a3 (jazz) and a5 (electronic) should not
    expect(results.some(a => a.id === 'a2')).toBe(true)
    expect(results.some(a => a.id === 'a4')).toBe(true)
    expect(results.some(a => a.id === 'a3')).toBe(false)
    expect(results.some(a => a.id === 'a5')).toBe(false)
  })

  it('respects the count limit', () => {
    const results = getSimilarAlbums(currentAlbum, library, 1)
    expect(results.length).toBe(1)
  })

  it('returns empty array when no genres match', () => {
    const albumNoGenre = makeAlbum({ id: 'ax', _genres: [] })
    const results = getSimilarAlbums(albumNoGenre, library, 4)
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../lib/badge-utils.js'`

- [ ] **Step 3: Create src/lib/badge-utils.js**

```js
import { clusterOf } from '../data/genre-clusters.js'

/**
 * Returns an array of badge objects for an album.
 * @param {object} album  - Spotify album (has _genres, release_date, tracks.items)
 * @param {object|null} stats - Last.fm stats from getAlbumStats() (has listenCount), or null
 * @returns {Array<{ value: string, label: string, icon: string, color: string }>}
 */
export function getAlbumBadges(album, stats) {
  const badges = []
  const year = parseInt((album.release_date || '').substring(0, 4))
  const trackCount = album.tracks?.items?.length ?? 0
  const listenCount = stats?.listenCount ?? null

  // ── Listen count badges ──────────────────────────────────────────────
  if (listenCount !== null) {
    if (listenCount === 0) {
      badges.push({ value: 'unheard', label: 'Unheard', icon: '🌑', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' })
    } else if (listenCount > 100) {
      badges.push({ value: 'masterpiece', label: 'Masterpiece', icon: '👑', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' })
    } else if (listenCount > 50) {
      badges.push({ value: 'heavy-rotation', label: 'Heavy Rotation', icon: '🎧', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' })
    } else if (listenCount < 5) {
      badges.push({ value: 'hidden-gem', label: 'Hidden Gem', icon: '💎', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' })
    }
  }

  // ── Era badges ───────────────────────────────────────────────────────
  if (!isNaN(year)) {
    if (year < 1970) {
      badges.push({ value: 'vintage', label: 'Vintage', icon: '📻', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
    } else if (year < 1980) {
      badges.push({ value: 'golden-oldie', label: 'Golden Oldie', icon: '📀', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' })
    } else if (year >= 2024) {
      badges.push({ value: 'brand-new', label: 'Brand New', icon: '🔥', color: 'bg-red-500/20 text-red-400 border-red-500/30' })
    } else if (year >= 2020) {
      badges.push({ value: 'recent', label: 'Recent', icon: '✨', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
    }
  }

  // ── Format badges ────────────────────────────────────────────────────
  if (trackCount >= 15) {
    badges.push({ value: 'epic-lp', label: 'Epic LP', icon: '📚', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  } else if (trackCount > 0 && trackCount <= 6) {
    badges.push({ value: 'ep', label: 'EP / Short', icon: '💿', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  }

  // ── Genre/mood badges ────────────────────────────────────────────────
  const genres = album._genres || []
  const clusterIds = [...new Set(genres.map(g => clusterOf(g)).filter(id => id !== 'other'))]

  if (clusterIds.includes('electronic')) {
    badges.push({ value: 'late-night', label: 'Late Night', icon: '🌙', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' })
  }
  if (clusterIds.includes('jazz') || clusterIds.includes('classical')) {
    badges.push({ value: 'focus', label: 'Focus', icon: '🧠', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' })
  }

  return badges
}

/**
 * Returns albums from the library that share the same genre cluster as the given album.
 * @param {object} album    - The current album (has _genres)
 * @param {object[]} library - Full Spotify library array
 * @param {number} count    - Max number of results to return
 * @returns {object[]}
 */
export function getSimilarAlbums(album, library, count = 4) {
  const genres = album._genres || []
  const clusterIds = new Set(genres.map(g => clusterOf(g)).filter(id => id !== 'other'))

  if (clusterIds.size === 0) return []

  return library
    .filter(a => {
      if (a.id === album.id) return false
      const aClusterIds = (a._genres || []).map(g => clusterOf(g)).filter(id => id !== 'other')
      return aClusterIds.some(id => clusterIds.has(id))
    })
    .slice(0, count)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: `19 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/badge-utils.js src/tests/badge-utils.test.js
git commit -m "feat: add getAlbumBadges() and getSimilarAlbums() utilities"
```

---

## Task 4: App.jsx restructure

**Files:**
- Modify: `src/App.jsx`

**Context:** Currently `MainApp` has `activeTab` defaulting to `'library'` and a `renderTab()` switch with cases `discover`, `library`, `stats`, `later`. We replace this with 3 tabs (`discover`, `browse`, `later`) and add new state. The `BrowseTab` component doesn't exist yet — we'll stub it and fill it in Task 8.

- [ ] **Step 1: Add new imports to App.jsx**

At the top of `src/App.jsx`, replace the current tab imports:

```js
// Before:
import DiscoverTab from './components/discover/DiscoverTab.jsx'
import LibraryTab from './components/library/LibraryTab.jsx'
import StatsTab from './components/stats/StatsTab.jsx'
import ListenLaterTab from './components/listen-later/ListenLaterTab.jsx'

// After:
import DiscoverTab from './components/discover/DiscoverTab.jsx'
import BrowseTab from './components/browse/BrowseTab.jsx'
import ListenLaterTab from './components/listen-later/ListenLaterTab.jsx'
```

`BrowseTab` doesn't exist yet — create a temporary stub so the import doesn't crash:

Create `src/components/browse/BrowseTab.jsx` with:

```jsx
export default function BrowseTab() {
  return <div className="p-6 text-ink-muted">Browse (stub)</div>
}
```

- [ ] **Step 2: Update MainApp state in App.jsx**

Inside `MainApp`, change the existing `activeTab` state and add new state:

```js
// Before:
const [activeTab, setActiveTab] = useState('library')

// After:
const [activeTab, setActiveTab] = useState('discover')
const [browseSubTab, setBrowseSubTab] = useState('library')
const [isSidebarOpen, setIsSidebarOpen] = useState(false)
const [isSettingsOpen, setIsSettingsOpen] = useState(false)
const [libraryFilter, setLibraryFilter] = useState(null)
const [carouselSettings, setCarouselSettings] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem('sonar_carousel_settings')) ?? defaultCarouselSettings()
  } catch {
    return defaultCarouselSettings()
  }
})
```

Add the `defaultCarouselSettings` helper and `handleBadgeClick` just before the `renderTab` function:

```js
function defaultCarouselSettings() {
  return {
    'most-played':        { visible: true, sort: 'original' },
    'latest-discoveries': { visible: true, sort: 'original' },
    'golden-oldies':      { visible: true, sort: 'original' },
    'climbers':           { visible: true, sort: 'original' },
    'fallers':            { visible: true, sort: 'original' },
    'on-this-day':        { visible: true, sort: 'original' },
  }
}

function handleBadgeClick(badge) {
  setLibraryFilter(badge)
  setActiveTab('browse')
  setBrowseSubTab('library')
}

function updateCarouselSettings(id, patch) {
  setCarouselSettings(prev => {
    const next = { ...prev, [id]: { ...prev[id], ...patch } }
    localStorage.setItem('sonar_carousel_settings', JSON.stringify(next))
    return next
  })
}
```

- [ ] **Step 3: Replace renderTab() switch**

```js
// Before:
const renderTab = () => {
  switch (activeTab) {
    case 'discover': return (
      <DiscoverTab
        albums={albums}
        getAlbumStats={getAlbumStats}
        saveLater={saveLater}
        removeLater={removeLater}
        isSaved={isSaved}
      />
    )
    case 'library': return (
      <LibraryTab
        albums={albums}
        getAlbumStats={getAlbumStats}
        genresLoading={genresLoading}
        saveLater={saveLater}
        removeLater={removeLater}
        isSaved={isSaved}
      />
    )
    case 'stats': return (
      <StatsTab
        albums={albums}
        getAlbumStats={getAlbumStats}
        lastfmMap={lastfmMap}
        lastfmLoaded={lastfmLoaded}
        onThisDay={onThisDay}
        saveLater={saveLater}
        removeLater={removeLater}
        isSaved={isSaved}
      />
    )
    case 'later': return (
      <ListenLaterTab
        items={listenLater}
        saveLater={saveLater}
        removeLater={removeLater}
        isSaved={isSaved}
        getAlbumStats={getAlbumStats}
      />
    )
    default: return null
  }
}

// After:
const renderTab = () => {
  switch (activeTab) {
    case 'discover': return (
      <DiscoverTab
        albums={albums}
        getAlbumStats={getAlbumStats}
        saveLater={saveLater}
        removeLater={removeLater}
        isSaved={isSaved}
        onBadgeClick={handleBadgeClick}
      />
    )
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
      />
    )
    case 'later': return (
      <ListenLaterTab
        items={listenLater}
        saveLater={saveLater}
        removeLater={removeLater}
        isSaved={isSaved}
        getAlbumStats={getAlbumStats}
        albums={albums}
        onBadgeClick={handleBadgeClick}
      />
    )
    default: return null
  }
}
```

- [ ] **Step 4: Update the return JSX in MainApp**

Replace the return statement in `MainApp` to pass new props to Header and TabBar:

```jsx
return (
  <div className="flex flex-col h-dvh bg-page overflow-hidden">
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
    />
    <main className="flex-1 overflow-y-auto overflow-x-hidden">
      <ErrorBoundary key={activeTab}>
        {renderTab()}
      </ErrorBoundary>
    </main>
    <TabBar
      activeTab={activeTab}
      onTabChange={setActiveTab}
      browseSubTab={browseSubTab}
      onBrowseSubTabChange={setBrowseSubTab}
    />
  </div>
)
```

- [ ] **Step 5: Verify app still loads**

```bash
npm run dev
```

Open `https://localhost:5173/SpotifyRandom/`. The app should load, show the Discover tab (now the default), and Browse tab should show the stub text. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/browse/BrowseTab.jsx
git commit -m "feat: restructure App.jsx to 3-tab navigation shell (Discover/Browse/Later)"
```

---

## Task 5: Header.jsx — SONAR branding + Sidebar + Settings Modal

**Files:**
- Modify: `src/components/layout/Header.jsx`

**Context:** The new Header has three zones: hamburger left, "SONAR" logo center, avatar right. The Sidebar slides in from the left (framer-motion `x`). The Settings Modal scales in from center. Both live inside `Header.jsx` to keep App.jsx clean.

The carousel IDs used in `carouselSettings` are: `'most-played'`, `'latest-discoveries'`, `'golden-oldies'`, `'climbers'`, `'fallers'`, `'on-this-day'` — matching the keys in StatsTab.

- [ ] **Step 1: Rewrite Header.jsx**

Replace the entire contents of `src/components/layout/Header.jsx`:

```jsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils.js'

const CAROUSEL_LABELS = {
  'most-played':        '👑 Most Played',
  'latest-discoveries': '🔭 Latest Discoveries',
  'golden-oldies':      '🕰️ Golden Oldies',
  'climbers':           '📈 Climbers',
  'fallers':            '📉 Fallers',
  'on-this-day':        '📅 On This Day',
}

const SORT_OPTIONS = [
  { id: 'original', label: 'Default' },
  { id: 'added',    label: 'By Date' },
  { id: 'relevance', label: 'By Plays' },
]

function Sidebar({ isOpen, onClose, onSettingsOpen, onLogout }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-card z-50 border-r border-border-subtle flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-border-subtle">
              <span className="font-black text-lg tracking-tight">SONAR</span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-ink-muted"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4">
              <button
                onClick={() => { onSettingsOpen(); onClose() }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-card-raised transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-border-subtle flex items-center justify-center text-ink-muted">
                  ⚙
                </div>
                <div>
                  <p className="font-bold text-sm">Settings</p>
                  <p className="text-xs text-ink-muted">Customize your experience</p>
                </div>
              </button>
            </div>

            <div className="p-6 border-t border-border-subtle">
              <button
                onClick={onLogout}
                className="text-sm text-ink-muted hover:text-ink transition-colors font-medium"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SettingsModal({ isOpen, onClose, albumCount, lastfmMeta, onRefresh, carouselSettings, onUpdateCarouselSettings }) {
  const [expandedSection, setExpandedSection] = useState(null)

  const toggle = (id) => setExpandedSection(prev => prev === id ? null : id)

  const metaDate = lastfmMeta?.generatedAt
    ? new Date(lastfmMeta.generatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg bg-card z-50 rounded-3xl border border-border-subtle overflow-hidden flex flex-col max-h-[88vh] shadow-2xl"
          >
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Settings</h2>
                <p className="text-xs text-ink-muted">Personalize your SONAR experience</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-card-raised flex items-center justify-center text-ink-muted"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {/* Sync section */}
              <div>
                <button
                  onClick={() => toggle('sync')}
                  className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
                >
                  <span>Data Synchronization</span>
                  <span className="text-ink-muted">{expandedSection === 'sync' ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {expandedSection === 'sync' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4 space-y-3">
                        <div className="flex items-center justify-between bg-card-raised p-4 rounded-2xl border border-border-subtle">
                          <div>
                            <p className="font-bold text-sm">Spotify Library</p>
                            <p className="text-xs text-ink-muted">{albumCount} albums cached</p>
                          </div>
                          <button
                            onClick={onRefresh}
                            className="px-4 py-2 bg-accent text-page text-xs font-bold rounded-xl"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="bg-card-raised p-4 rounded-2xl border border-border-subtle">
                          <p className="font-bold text-sm">Last.fm Data</p>
                          <p className="text-xs text-ink-muted mt-1">
                            {metaDate ? `Generated ${metaDate} · parser output` : 'No metadata'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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
                      <div className="pb-4 space-y-2">
                        {Object.entries(CAROUSEL_LABELS).map(([id, label]) => {
                          const settings = carouselSettings[id] || { visible: true, sort: 'original' }
                          return (
                            <div key={id} className="bg-card-raised p-3 rounded-xl border border-border-subtle">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{label}</span>
                                <button
                                  onClick={() => onUpdateCarouselSettings(id, { visible: !settings.visible })}
                                  className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                                    settings.visible
                                      ? 'bg-accent/20 text-accent border-accent/30'
                                      : 'bg-transparent text-ink-muted border-border-subtle'
                                  )}
                                >
                                  {settings.visible ? 'Visible' : 'Hidden'}
                                </button>
                              </div>
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
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Explore placeholder */}
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
                      <p className="text-xs text-ink-muted pb-4">
                        Curated playlist support is coming in a future update.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

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
}) {
  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 bg-page/90 border-b border-border-subtle flex-shrink-0 backdrop-blur-xl">
        {/* Hamburger */}
        <button
          onClick={onSidebarOpen}
          className="w-9 h-9 rounded-full bg-card-raised flex items-center justify-center text-ink hover:bg-border-subtle transition-all"
          aria-label="Open menu"
        >
          ☰
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-page">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
            </svg>
          </div>
          <span className="font-black tracking-tight text-lg">SONAR</span>
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-card-raised border border-border-subtle flex items-center justify-center text-ink-muted text-sm font-bold">
          ♪
        </div>
      </header>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={onSidebarClose}
        onSettingsOpen={onSettingsOpen}
        onLogout={onLogout}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onSettingsClose}
        albumCount={albumCount}
        lastfmMeta={lastfmMeta}
        onRefresh={onRefresh}
        carouselSettings={carouselSettings}
        onUpdateCarouselSettings={onUpdateCarouselSettings}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

- Header shows hamburger left, SONAR logo center, avatar right.
- Tapping hamburger opens the sidebar from the left with animation.
- "Settings" in sidebar opens Settings Modal centered with scale animation.
- Settings Modal shows 3 collapsible sections.
- Carousels section shows all 6 carousels with visible/hidden toggle and sort options.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.jsx
git commit -m "feat: SONAR header with sidebar and settings modal (framer-motion)"
```

---

## Task 6: TabBar.jsx — 3 tabs + Browse sub-tabs

**Files:**
- Modify: `src/components/layout/TabBar.jsx`

- [ ] **Step 1: Rewrite TabBar.jsx**

Replace the entire contents of `src/components/layout/TabBar.jsx`:

```jsx
import { motion } from 'motion/react'
import { cn } from '../../lib/utils.js'

const MAIN_TABS = [
  {
    id: 'discover',
    label: 'Discover',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    ),
  },
  {
    id: 'browse',
    label: 'Browse',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'later',
    label: 'Later',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
]

const BROWSE_SUB_TABS = [
  { id: 'library',  label: 'Library' },
  { id: 'insights', label: 'Insights' },
  { id: 'explore',  label: 'Explore' },
]

export default function TabBar({ activeTab, onTabChange, browseSubTab, onBrowseSubTabChange }) {
  return (
    <div className="flex-shrink-0 pb-safe border-t border-border-subtle" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      {/* Browse sub-tabs (only visible when Browse is active) */}
      {activeTab === 'browse' && (
        <div className="flex border-b border-border-subtle px-4 pt-2">
          {BROWSE_SUB_TABS.map(sub => (
            <button
              key={sub.id}
              onClick={() => onBrowseSubTabChange(sub.id)}
              className={cn(
                'flex-1 pb-2 text-xs font-bold uppercase tracking-widest transition-colors relative',
                browseSubTab === sub.id ? 'text-accent' : 'text-ink-muted'
              )}
            >
              {sub.label}
              {browseSubTab === sub.id && (
                <motion.div
                  layoutId="browse-sub-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main tabs */}
      <nav className="flex h-16">
        {MAIN_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-accent' : 'text-ink-muted'
              )}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

- Tab bar shows 3 tabs: Discover, Browse, Later.
- Tapping Browse shows a second row with Library / Insights / Explore sub-tabs.
- Active sub-tab has an animated accent underline (framer-motion layoutId).
- Sub-tab row disappears when switching away from Browse.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TabBar.jsx
git commit -m "feat: TabBar with 3 main tabs and Browse sub-tab row (framer-motion)"
```

---

## Task 7: AlbumModal.jsx — framer-motion + badges + burn animation + Similar To

**Files:**
- Modify: `src/components/AlbumModal.jsx`

**Context:** The current modal uses CSS positioning. We replace it with a framer-motion Bottom Sheet that supports drag-to-close. New props: `library` (array, for Similar To), `onBadgeClick` (function). The existing queue logic (`addToQueue` from `spotify-api.js`) stays intact. Current props: `album, stats, saved, onSave, onRemove, onClose, onQueue`.

- [ ] **Step 1: Replace AlbumModal.jsx**

Replace the entire contents of `src/components/AlbumModal.jsx`:

```jsx
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { addToQueue } from '../lib/spotify-api.js'
import { cn } from '../lib/utils.js'
import { getAlbumBadges, getSimilarAlbums } from '../lib/badge-utils.js'

// ── Helpers ───────────────────────────────────────────────────────────

function fmtDuration(ms) {
  if (!ms) return ''
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function fmtDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────

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
}) {
  const [queueStatus, setQueueStatus] = useState(null)
  const [isBurning,   setIsBurning]   = useState(false)
  const [currentAlbum, setCurrentAlbum] = useState(album)

  // Sync current album when prop changes (new modal open)
  useEffect(() => {
    setCurrentAlbum(album)
    setIsBurning(false)
  }, [album])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const art     = currentAlbum.images?.[0]?.url
  const artist  = (currentAlbum.artists || []).map(a => a.name).join(', ')
  const year    = (currentAlbum.release_date || '').substring(0, 4)
  const tracks  = currentAlbum.tracks?.items || []
  const badges  = getAlbumBadges(currentAlbum, stats)
  const similar = getSimilarAlbums(currentAlbum, library, 4)

  const triggerBurn = useCallback(async (action) => {
    setIsBurning(true)
    await new Promise(r => setTimeout(r, 400))
    action()
    onClose()
  }, [onClose])

  const handleQueue = useCallback(async () => {
    const uris = tracks.filter(t => t?.uri).map(t => t.uri)
    if (!uris.length) {
      setQueueStatus({ msg: 'No tracks found', error: true })
      setTimeout(() => setQueueStatus(null), 2500)
      return
    }
    await triggerBurn(async () => {
      try {
        for (const uri of uris) await addToQueue(uri)
        onQueue?.(currentAlbum)
        setQueueStatus({ msg: `"${currentAlbum.name}" added to queue`, error: false })
      } catch (e) {
        setQueueStatus({ msg: e.message, error: true })
      }
    })
  }, [tracks, currentAlbum, onQueue, triggerBurn])

  const handleSave = useCallback(() => {
    triggerBurn(() => {
      if (saved) onRemove(currentAlbum)
      else onSave(currentAlbum)
    })
  }, [saved, currentAlbum, onSave, onRemove, triggerBurn])

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
      />
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{
          y: isBurning ? '20%' : 0,
          opacity: isBurning ? 0 : 1,
          scale: isBurning ? 0.92 : 1,
          filter: isBurning ? 'blur(8px)' : 'blur(0px)',
        }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag={isBurning ? false : 'y'}
        dragConstraints={{ top: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.y > 150 || info.velocity.y > 500) onClose()
        }}
        className="fixed bottom-0 left-0 right-0 max-h-[92vh] bg-card border-t border-border-subtle z-50 rounded-t-[2rem] overflow-hidden flex flex-col touch-none"
        style={{ boxShadow: '0 -20px 50px rgba(0,0,0,0.5)' }}
      >
        {/* Drag handle */}
        <div className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1.5 bg-border-subtle rounded-full" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-12">
          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
              {badges.map(badge => (
                <button
                  key={badge.value}
                  onClick={() => onBadgeClick?.(badge)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95',
                    badge.color
                  )}
                >
                  <span>{badge.icon}</span>
                  <span>{badge.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="flex gap-5 mb-6">
            <motion.div
              animate={{
                scale: isBurning ? 0.5 : 1,
                opacity: isBurning ? 0 : 1,
                rotate: isBurning ? -10 : 0,
              }}
              className="relative flex-shrink-0"
            >
              {art && (
                <img
                  src={art}
                  alt={currentAlbum.name}
                  className="w-24 h-24 rounded-xl shadow-2xl object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold leading-tight mb-0.5 line-clamp-2">{currentAlbum.name}</h2>
              <p className="text-ink-secondary truncate">{artist}</p>
              <p className="text-ink-muted text-sm mt-1">
                {year} · {currentAlbum.album_type} · {tracks.length} tracks
              </p>
              {stats?.listenCount > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full bg-accent/15 text-accent text-xs font-bold">
                  {stats.listenCount}× heard
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleQueue}
              disabled={isBurning}
              className="flex items-center justify-center gap-2 bg-accent text-page py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              ▶ Queue
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={isBurning}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl font-bold border transition-all disabled:opacity-50',
                saved
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-transparent border-border-subtle text-ink hover:bg-card-raised'
              )}
            >
              {saved ? '✓ Saved' : '+ Save for Later'}
            </motion.button>
          </div>

          {/* Queue status toast */}
          {queueStatus && (
            <p className={cn(
              'text-xs text-center mb-4 font-medium',
              queueStatus.error ? 'text-red-400' : 'text-accent'
            )}>
              {queueStatus.msg}
            </p>
          )}

          {/* Last.fm stats */}
          {stats?.listenCount > 0 && (
            <div className="mb-6">
              <h3 className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-3">Last.fm Insights</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Listens',     value: stats.listenCount },
                  { label: 'Background',  value: stats.backgroundCount ?? 0 },
                  { label: 'First heard', value: fmtDate(stats.firstHeard) },
                  { label: 'Last heard',  value: fmtDate(stats.lastHeard) },
                  { label: 'Peak month',  value: stats.peakMonth ?? '—' },
                  { label: 'Scrobbles',   value: stats.rawScrobbles ?? '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-card-raised p-3 rounded-xl border border-border-subtle">
                    <p className="text-ink-muted text-[9px] font-bold uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-ink text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar To */}
          {similar.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-ink-muted text-[10px] font-bold uppercase tracking-widest">Similar To</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Genre Match</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {similar.map(sim => (
                  <button
                    key={sim.id}
                    onClick={() => setCurrentAlbum(sim)}
                    className="bg-card-raised rounded-xl p-3 border border-border-subtle text-left hover:border-accent/30 transition-all flex gap-3 items-center group"
                  >
                    {sim.images?.[0]?.url && (
                      <img
                        src={sim.images[0].url}
                        alt={sim.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate group-hover:text-accent transition-colors">{sim.name}</p>
                      <p className="text-ink-muted text-[10px] truncate">{sim.artists?.[0]?.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Track list */}
          <div>
            <h3 className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-3">Tracks</h3>
            <div className="space-y-1">
              {tracks.map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center gap-3 py-2 border-b border-border-subtle/50 last:border-0"
                >
                  <span className="w-5 text-ink-muted text-xs text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{t.name}</span>
                  {t.duration_ms && (
                    <span className="text-ink-muted text-xs flex-shrink-0">{fmtDuration(t.duration_ms)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Find all places AlbumModal is used and add the new props**

AlbumModal is used in: `DiscoverTab.jsx`, `LibraryTab.jsx`, `StatsTab.jsx`, `ListenLaterTab.jsx`.

In each file, find the `<AlbumModal ... />` usage and add two new props:

```jsx
// Add these to every AlbumModal usage:
library={albums}
onBadgeClick={onBadgeClick}
```

Each tab already receives `albums` as a prop from App.jsx. The `onBadgeClick` prop also comes from App.jsx (added in Task 4). If a tab doesn't yet receive `onBadgeClick`, add it to its props destructuring.

**In DiscoverTab.jsx** — add `onBadgeClick` to props and pass to AlbumModal.
**In LibraryTab.jsx** — add `onBadgeClick` to props and pass to AlbumModal.
**In StatsTab.jsx** — add `onBadgeClick` to props and pass to AlbumModal. Also add `albums` if not already there (it is passed from App.jsx in Task 4's renderTab).
**In ListenLaterTab.jsx** — add `onBadgeClick` to props, and `albums` (passed from App.jsx in Task 4).

- [ ] **Step 3: Verify in browser**

Open any album modal:
- Badges appear at the top (tapping one should navigate to Browse > Library — won't fully work until BrowseTab is wired in Task 8)
- Drag handle visible, dragging down dismisses the modal
- Queue button triggers burn animation (~400ms of cover shrink + blur), then modal closes
- Similar To section shows genre-matched albums from the real library
- Track list present

- [ ] **Step 4: Commit**

```bash
git add src/components/AlbumModal.jsx src/components/discover/DiscoverTab.jsx src/components/library/LibraryTab.jsx src/components/stats/StatsTab.jsx src/components/listen-later/ListenLaterTab.jsx
git commit -m "feat: AlbumModal with framer-motion, badges, burn animation, Similar To"
```

---

## Task 8: BrowseTab.jsx — sub-tab container

**Files:**
- Modify: `src/components/browse/BrowseTab.jsx` (currently a stub from Task 4)

**Context:** BrowseTab receives `activeSubTab` and `onSubTabChange` from App.jsx (via TabBar). It renders LibraryTab, InsightsTab (renamed from StatsTab), or ExploreTab based on `activeSubTab`. InsightsTab doesn't exist yet — we'll import StatsTab by its current name temporarily and rename in Task 9.

- [ ] **Step 1: Rewrite BrowseTab.jsx**

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
      return <ExploreTab />
  }
}
```

- [ ] **Step 2: Create ExploreTab stub**

Create `src/components/explore/ExploreTab.jsx`:

```jsx
export default function ExploreTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-6">
      <div className="w-20 h-20 bg-card-raised rounded-full flex items-center justify-center border border-border-subtle">
        <span className="text-3xl">🔭</span>
      </div>
      <div>
        <h2 className="font-black text-xl mb-2">Explore</h2>
        <p className="text-ink-secondary text-sm max-w-xs">
          Curated mood and genre playlists are coming soon.
        </p>
      </div>
      <div className="px-5 py-2.5 bg-accent/10 border border-accent/20 rounded-2xl">
        <span className="text-accent text-xs font-bold uppercase tracking-widest">Coming Soon</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

- Browse > Library shows the real library grid.
- Browse > Insights shows the stats carousels.
- Browse > Explore shows the "Coming Soon" placeholder.
- Switching sub-tabs works instantly.

- [ ] **Step 4: Commit**

```bash
git add src/components/browse/BrowseTab.jsx src/components/explore/ExploreTab.jsx
git commit -m "feat: BrowseTab sub-tab container + ExploreTab stub"
```

---

## Task 9: LibraryTab.jsx — inline filter panel + badge filter banner

**Files:**
- Modify: `src/components/library/LibraryTab.jsx`

**Context:** Currently LibraryTab has its own sort/filter UI (likely a bottom-sheet or header row). We need to add: (1) an inline expandable filter panel (framer-motion height animation), (2) a badge filter banner when `libraryFilter` prop is set, (3) updated button/chip styles. The existing search, sort, and genre filter logic stays the same.

- [ ] **Step 1: Add new imports to LibraryTab.jsx**

At the top of `src/components/library/LibraryTab.jsx`, add:

```js
import { useState } from 'react'  // already there
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils.js'
```

- [ ] **Step 2: Add libraryFilter and onClearFilter to props**

In the component signature, add the new props:

```js
// Before (example, match existing signature):
export default function LibraryTab({ albums, getAlbumStats, genresLoading, saveLater, removeLater, isSaved })

// After:
export default function LibraryTab({ albums, getAlbumStats, genresLoading, saveLater, removeLater, isSaved, libraryFilter, onClearFilter, onBadgeClick })
```

- [ ] **Step 3: Add badge filter logic to the filtering useMemo**

Find the `useMemo` that builds `filteredAlbums`. Add a badge filter clause after the existing filters:

```js
// Add inside the useMemo filter chain:
if (libraryFilter) {
  // Import getAlbumBadges at top: import { getAlbumBadges } from '../../lib/badge-utils.js'
  filtered = filtered.filter(album => {
    const stats = getAlbumStats(album)
    const badges = getAlbumBadges(album, stats)
    return badges.some(b => b.value === libraryFilter.value)
  })
}
```

Add the import at the top:
```js
import { getAlbumBadges } from '../../lib/badge-utils.js'
```

- [ ] **Step 4: Add badge filter banner at the top of the JSX**

Just inside the outermost `div` of the component's return, before the search bar, add:

```jsx
{/* Badge filter banner */}
{libraryFilter && (
  <div className="flex items-center justify-between bg-accent/10 border border-accent/20 p-4 rounded-2xl mb-4">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-page text-base shadow-lg">
        {libraryFilter.icon || '🏷'}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent/60">Filtered by</p>
        <p className="font-bold text-sm text-ink">{libraryFilter.label}</p>
      </div>
    </div>
    <button
      onClick={onClearFilter}
      className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center hover:bg-accent/30 transition-colors"
    >
      ✕
    </button>
  </div>
)}
```

- [ ] **Step 5: Wrap the sort/filter controls in a framer-motion collapsible panel**

Find the existing filter controls (sort chips, type filter, genre filter). Wrap them in:

```jsx
{/* Filter toggle button */}
<button
  onClick={() => setIsFilterOpen(prev => !prev)}
  className={cn(
    'w-11 h-11 rounded-2xl border flex items-center justify-center transition-all flex-shrink-0',
    isFilterOpen || genreFilter || typeFilter !== 'all' || sortBy !== 'added'
      ? 'bg-accent text-page border-accent'
      : 'bg-card-raised text-ink-muted border-border-subtle'
  )}
>
  ⊞
</button>
```

Add `const [isFilterOpen, setIsFilterOpen] = useState(false)` to state.

Wrap the existing filter controls:

```jsx
<AnimatePresence>
  {isFilterOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-card-raised border border-border-subtle rounded-2xl p-5 space-y-5 mb-2">
        {/* existing sort and genre filter controls here */}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 6: Pass onBadgeClick down to AlbumModal in LibraryTab**

In the `<AlbumModal ... />` usage inside LibraryTab, add `onBadgeClick={onBadgeClick}` if not already done in Task 7.

- [ ] **Step 7: Verify in browser**

- Browse > Library loads real albums.
- Filter button expands/collapses inline with animation.
- From AlbumModal, tap a badge → Library shows the badge filter banner at top and filters results.
- Tapping ✕ on the banner clears the filter.

- [ ] **Step 8: Commit**

```bash
git add src/components/library/LibraryTab.jsx
git commit -m "feat: LibraryTab with inline filter panel, badge filter banner (framer-motion)"
```

---

## Task 10: StatsTab.jsx — Most Played time-range filter + carousel settings

**Files:**
- Modify: `src/components/stats/StatsTab.jsx`

**Context:** StatsTab currently renders 6 carousels with burn tracking. We add: (1) time-range filter chips (7D/3M/6M/1Y/ALL) on the Most Played carousel, (2) per-carousel visibility and sort controlled by `carouselSettings` prop from App.jsx. The existing carousel logic, burn tracking, and AlbumModal stay in place.

- [ ] **Step 1: Add new imports to StatsTab.jsx**

```js
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils.js'
```

- [ ] **Step 2: Add new props to StatsTab**

```js
// Add to props destructuring:
export default function StatsTab({
  albums,
  getAlbumStats,
  lastfmMap,
  lastfmLoaded,
  onThisDay,
  saveLater,
  removeLater,
  isSaved,
  onBadgeClick,          // new
  carouselSettings,      // new — { [carouselId]: { visible, sort } }
  onUpdateCarouselSettings,  // new — (id, patch) => void
}) {
```

- [ ] **Step 3: Add Most Played time-range state**

Inside the component, add:

```js
const [mostPlayedRange, setMostPlayedRange] = useState('all')

const TIME_RANGES = [
  { id: '7d',  label: '7D',  ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '3m',  label: '3M',  ms: 90 * 24 * 60 * 60 * 1000 },
  { id: '6m',  label: '6M',  ms: 180 * 24 * 60 * 60 * 1000 },
  { id: '1y',  label: '1Y',  ms: 365 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'ALL', ms: null },
]
```

- [ ] **Step 4: Apply time-range filter and carousel settings in the useMemo that builds carousels**

Find the `useMemo` that computes `mostPlayed` (the Most Played carousel items). Apply the time-range filter:

```js
// Inside the useMemo for mostPlayed:
const range = TIME_RANGES.find(r => r.id === mostPlayedRange)
const mostPlayed = [...albums]
  .filter(a => {
    const s = getAlbumStats(a)
    if (!s || s.listenCount === 0) return false
    if (range.ms === null) return true
    return (s.lastHeard || 0) > Date.now() - range.ms
  })
  .sort((a, b) => (getAlbumStats(b)?.listenCount || 0) - (getAlbumStats(a)?.listenCount || 0))
  .slice(0, 10)
```

Apply visibility from `carouselSettings` when rendering each carousel:

```js
// When rendering carousel headers/lists, check settings:
const settings = carouselSettings?.['most-played'] || { visible: true, sort: 'original' }
if (!settings.visible) return null  // skip hidden carousels
```

Apply sort from `carouselSettings` (sort `'original'` = existing sort, `'added'` = sort by `_added_at`, `'relevance'` = sort by listenCount):

```js
function applySortToItems(items, sort, getAlbumStats) {
  if (sort === 'added') return [...items].sort((a, b) => new Date(b._added_at) - new Date(a._added_at))
  if (sort === 'relevance') return [...items].sort((a, b) => (getAlbumStats(b)?.listenCount || 0) - (getAlbumStats(a)?.listenCount || 0))
  return items // 'original'
}
```

- [ ] **Step 5: Add time-range chips to the Most Played carousel header**

Find where the Most Played carousel header is rendered. Add the time-range chips below the title:

```jsx
{/* Time-range filter for Most Played carousel */}
<div className="flex gap-1.5 mt-1">
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
```

- [ ] **Step 6: Add AnimatePresence to carousel item lists (burn animation)**

Find where carousel items are mapped (the horizontal scrollable list). Wrap with `AnimatePresence` and add exit animation to each item:

```jsx
<AnimatePresence mode="popLayout">
  {carouselItems.map(album => (
    <motion.div
      key={album.id}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onClick={() => openModal(album)}
      className="flex-shrink-0 w-32 cursor-pointer group"
    >
      {/* existing item content */}
    </motion.div>
  ))}
</AnimatePresence>
```

- [ ] **Step 7: Verify in browser**

- Browse > Insights shows carousels.
- Most Played has time-range chips (7D/3M/6M/1Y/ALL) — switching them filters the list.
- Settings Modal > Carousels section: hiding a carousel makes it disappear from Insights.
- Burning an item animates it out with the popLayout animation.

- [ ] **Step 8: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat: InsightsTab with Most Played time-range filter and carousel settings support"
```

---

## Task 11: ListenLaterTab.jsx — 2-column grid view

**Files:**
- Modify: `src/components/listen-later/ListenLaterTab.jsx`

**Context:** Currently a vertical list. Change to a 2-column grid of album art cards. The existing remove/queue logic stays unchanged. The `albums` prop (from App.jsx, added in Task 4) is needed to look up cover art by id when `items` only contains saved album objects.

- [ ] **Step 1: Add new imports**

```js
import { motion } from 'motion/react'
import { cn } from '../../lib/utils.js'
```

- [ ] **Step 2: Update props**

```js
// Add to props:
export default function ListenLaterTab({ items, saveLater, removeLater, isSaved, getAlbumStats, albums = [], onBadgeClick })
```

- [ ] **Step 3: Replace the list rendering with a 2-column grid**

Find the section where `items` is mapped to rendered rows. Replace with:

```jsx
{items.length === 0 ? (
  <div className="py-20 text-center space-y-4">
    <div className="w-16 h-16 bg-card-raised rounded-full flex items-center justify-center mx-auto border border-border-subtle">
      <span className="text-2xl">🔖</span>
    </div>
    <p className="text-ink-secondary font-medium">No albums saved yet.</p>
    <p className="text-ink-muted text-sm">Save albums from Discover or Browse.</p>
  </div>
) : (
  <div className="grid grid-cols-2 gap-4">
    {items.map(item => (
      <div
        key={item.id}
        onClick={() => openModal(item)}
        className="space-y-2 group cursor-pointer"
      >
        <div className="relative aspect-square rounded-2xl overflow-hidden border border-border-subtle">
          {item.images?.[0]?.url && (
            <img
              src={item.images[0].url}
              alt={item.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); removeLater(item) }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-accent border border-white/10"
          >
            🔖
          </button>
        </div>
        <div>
          <p className="font-bold text-sm truncate group-hover:text-accent transition-colors">{item.name}</p>
          <p className="text-ink-secondary text-xs truncate">{item.artists?.[0]?.name}</p>
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Pass new props to AlbumModal in ListenLaterTab**

In the `<AlbumModal />` inside ListenLaterTab, add `library={albums}` and `onBadgeClick={onBadgeClick}` if not done in Task 7.

- [ ] **Step 5: Verify in browser**

- Later tab shows saved albums as a 2-column grid.
- Empty state shows the bookmark placeholder.
- Tapping an album opens AlbumModal.
- Bookmark button removes the album.

- [ ] **Step 6: Commit**

```bash
git add src/components/listen-later/ListenLaterTab.jsx
git commit -m "feat: LaterTab grid view (2-column) with improved empty state"
```

---

## Task 12: DiscoverTab.jsx — visual refresh + framer-motion swipe

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx`

**Context:** DiscoverTab already has swipe gestures implemented with touch events. We port the swipe cards to framer-motion `drag` for consistency. The existing weighted random pick logic, presets, filter chips, and AlbumModal integration stay unchanged.

- [ ] **Step 1: Add new imports to DiscoverTab.jsx**

```js
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils.js'
```

- [ ] **Step 2: Add onBadgeClick to props**

```js
export default function DiscoverTab({
  albums,
  getAlbumStats,
  saveLater,
  removeLater,
  isSaved,
  onBadgeClick,  // new
})
```

- [ ] **Step 3: Port swipe card touch events to framer-motion drag**

Find the swipeable card component (likely a `div` with `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers). Replace with a `motion.div`:

```jsx
// Before — something like:
<div
  style={{ transform: `translateX(${dragX}px) rotate(...)` }}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>

// After:
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.7}
  onDragEnd={(_, info) => {
    if (info.offset.x < -80 || info.velocity.x < -500) {
      handleSwipeLeft(album)  // existing swipe-left action (queue)
    } else if (info.offset.x > 80 || info.velocity.x > 500) {
      handleSwipeRight(album) // existing swipe-right action (skip)
    }
  }}
  className="cursor-grab active:cursor-grabbing touch-none"
>
```

Remove the old `dragX` state and the three touch event handlers for this card — the framer-motion `drag` handles all of that. Keep the existing `handleSwipeLeft` and `handleSwipeRight` functions that do the actual album action.

- [ ] **Step 4: Pass library and onBadgeClick to AlbumModal in DiscoverTab**

```jsx
<AlbumModal
  {/* existing props */}
  library={albums}
  onBadgeClick={onBadgeClick}
/>
```

- [ ] **Step 5: Verify in browser**

- Discover tab loads and shows picks.
- Swipe left on a card queues it (same as before).
- Swipe right skips it.
- Opening album modal from Discover and tapping a badge navigates to Browse > Library with filter active.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all utility tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "feat: DiscoverTab swipe cards ported to framer-motion drag"
```

---

## Task 13: Final verification + branch cleanup

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass (utils + badge-utils).

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no TypeScript or build errors. Check console for any import path issues.

- [ ] **Step 3: Manual smoke test — golden paths**

Open `https://localhost:5173/SpotifyRandom/` and verify:

| Path | Expected |
|---|---|
| App loads | SONAR logo in header, 3 tabs visible |
| Sidebar | Hamburger → sidebar slides in, Settings opens modal |
| Settings > Carousels | Can hide/show and change sort of each carousel |
| Discover | Album picks show, swipe works, album modal opens |
| Discover modal | Badges visible, burn animation works, Similar To shows real albums |
| Browse > Library | Albums load, filter panel expands, search works |
| Badge tap in modal | Navigates to Browse > Library with filter banner |
| Browse > Insights | Carousels visible, Most Played time-range chips work |
| Browse > Explore | "Coming Soon" placeholder |
| Later | Saved albums in 2-column grid, empty state if none |

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: SONAR redesign complete — final verification"
```

- [ ] **Step 5: Push branch**

```bash
git push -u origin feature/sonar-redesign
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `feature/sonar-redesign` branch | Task 1 |
| motion, clsx, tailwind-merge | Task 1 |
| `cn()` utility | Task 2 |
| `getAlbumBadges()` | Task 3 |
| `getSimilarAlbums()` | Task 3 |
| 3-tab App.jsx restructure | Task 4 |
| SONAR header branding | Task 5 |
| Sidebar with Settings | Task 5 |
| Settings Modal (Sync + Carousels + Explore) | Task 5 |
| TabBar 3 tabs + Browse sub-tabs | Task 6 |
| AlbumModal framer-motion bottom sheet | Task 7 |
| Album badges in modal | Task 7 |
| Burn animation | Task 7 |
| Similar To section | Task 7 |
| BrowseTab sub-tab container | Task 8 |
| ExploreTab stub | Task 8 |
| LibraryTab inline filter panel | Task 9 |
| Badge filter banner in Library | Task 9 |
| Most Played time-range filter | Task 10 |
| Carousel visibility/sort via Settings | Task 10 |
| Carousel burn `AnimatePresence popLayout` | Task 10 |
| LaterTab 2-column grid | Task 11 |
| DiscoverTab framer-motion swipe | Task 12 |
| Badge click → Browse > Library navigation | Tasks 7+9 |
| `handleBadgeClick` in App.jsx | Task 4 |
| `carouselSettings` persisted to localStorage | Task 4 |

All spec requirements covered. No gaps found.
