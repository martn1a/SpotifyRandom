# Discover Tab — Dark Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Discover Tab (and the app shell) to the approved dark theme: OLED black background, Surface Dark cards, Accent Green CTAs, on-cover badges with blur backdrop, horizontal-scroll multi-pick cards.

**Architecture:** Token-first approach — Task 1 establishes all CSS custom properties in `index.css`. All subsequent tasks replace Tailwind class strings to use the new tokens. The filter modal and pick logic are NOT touched — only visual layer changes.

**Tech Stack:** React, Tailwind CSS v4 (`@theme {}`), pointer-event swipe (no library)

---

## Note on swipe direction

The spec (approved) defines: **swipe left = skip, swipe right = queue**. The existing code has it reversed (left = queue, right = skip). Task 4 corrects this to match the spec.

---

## File map

| File | Change |
|---|---|
| `src/index.css` | Replace light tokens with dark tokens |
| `src/App.jsx` | `bg-page` → dark; loading/error screens → dark |
| `src/components/layout/Header.jsx` | Dark bg + border |
| `src/components/layout/TabBar.jsx` | Dark bg + backdrop blur |
| `src/components/discover/DiscoverTab.jsx` | Restyle all sub-components |

---

## Task 1: Dark Theme Tokens

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace `@theme` block with dark tokens**

Replace the entire `@theme {}` block in `src/index.css` with:

```css
@import "tailwindcss";

@theme {
  /* Typography */
  --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* Surfaces — dark theme */
  --color-page:         #0a0a0a;
  --color-card:         #141414;
  --color-card-raised:  #1e1e1e;
  --color-border-subtle: #2a2a2a;

  /* Text */
  --color-ink:           #f0f0f0;
  --color-ink-secondary: #8a8a8a;
  --color-ink-muted:     #4a4a4a;

  /* Accent — Spotify Green */
  --color-accent:      #1ed760;
  --color-accent-dim:  rgba(30,215,96,0.15);
  --color-accent-text: #1ed760;

  /* Badges (listen count) */
  --color-badge-listen-bg: rgba(30,215,96,0.15);
  --color-badge-listen:    #1ed760;

  /* Genre badge */
  --color-badge-genre-bg: rgba(138,138,255,0.15);
  --color-badge-genre:    #a0a0ff;

  /* Trend badges */
  --color-badge-rising-bg: rgba(100,180,50,0.15);
  --color-badge-rising:    #7ec84a;
  --color-badge-falling-bg: rgba(200,60,60,0.15);
  --color-badge-falling:    #e06060;

  /* Filter chips */
  --color-chip-active:   #1ed760;
  --color-chip-inactive: #1e1e1e;
}

html, body, #root {
  height: 100%;
  overscroll-behavior: none;
  background: #0a0a0a;
  color-scheme: dark;
}

@utility scrollbar-hide {
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

@utility pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}

@keyframes sheetUp {
  from { transform: translateY(100%); opacity: 0.7; }
  to   { transform: translateY(0);    opacity: 1;   }
}
@keyframes toastIn {
  from { transform: translateY(1rem); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes fadeUp {
  from { transform: translateY(2rem); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes cardIn {
  from { transform: translateY(8px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)   scale(1);    opacity: 1; }
}
```

- [ ] **Step 2: Run dev server and verify no build errors**

```bash
cd C:\Users\marti\SpotifyRandom && npm run dev
```

Expected: server starts, no Tailwind compilation errors. Open app in browser — background should now be near-black.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: dark theme tokens in index.css"
```

---

## Task 2: App Shell — Dark Background

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/layout/Header.jsx`
- Modify: `src/components/layout/TabBar.jsx`

- [ ] **Step 1: Update App.jsx — LoadingScreen and error states**

In `src/App.jsx`, find `LoadingScreen` and update:

```jsx
function LoadingScreen({ progress }) {
  const { done, total } = progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="h-dvh bg-page flex flex-col items-center justify-center px-8 gap-6">
      <p className="text-base font-medium text-ink">Loading your library…</p>

      {total > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div className="h-1 bg-card-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-ink-muted text-center">
            {done} / {total} albums
          </p>
        </div>
      )}
    </div>
  )
}
```

In `MainApp`, find the error state div and update:

```jsx
if (libraryError) {
  return (
    <div className="h-dvh bg-page flex flex-col items-center justify-center px-8 gap-4">
      <p className="text-sm font-medium text-ink">Failed to load library</p>
      <p className="text-xs text-ink-secondary text-center">{libraryError}</p>
      <button
        onClick={onLogout}
        className="mt-2 px-4 py-2 bg-accent text-black text-sm font-semibold rounded-xl"
      >
        Sign out and retry
      </button>
    </div>
  )
}
```

In `ErrorBoundary.render`, update the error UI:

```jsx
return (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3">
    <p className="text-2xl">⚠️</p>
    <p className="text-sm font-medium text-ink">Something went wrong</p>
    <p className="text-[11px] text-ink-secondary max-w-xs">{this.state.error.message}</p>
    <button
      onClick={() => this.setState({ error: null })}
      className="mt-1 px-4 py-2 bg-accent text-black text-[13px] font-semibold rounded-xl"
    >
      Try again
    </button>
  </div>
)
```

In `MainApp`'s main return, the outer div already uses `bg-page` — leave it. Also update the `handlingCb` screen near the bottom of `App()`:

```jsx
if (handlingCb) {
  return (
    <div className="h-dvh bg-page flex items-center justify-center">
      <p className="text-sm text-ink-secondary">Connecting to Spotify…</p>
    </div>
  )
}
```

- [ ] **Step 2: Update Header.jsx**

Replace the entire file content:

```jsx
function fmtMetaDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export default function Header({ onLogout, albumCount, lastfmMeta, onRefresh }) {
  const metaDate = fmtMetaDate(lastfmMeta?.generatedAt)

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-page border-b border-border-subtle flex-shrink-0">
      <div className="flex flex-col justify-center">
        <span className="text-base font-semibold text-ink tracking-tight leading-tight">
          Album Discovery
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {albumCount > 0 && (
            <span className="text-[10px] text-ink-muted">{albumCount} albums</span>
          )}
          {metaDate && (
            <span className="text-[10px] text-ink-muted">· Last.fm: {metaDate}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-ink-secondary text-base active:text-ink transition-colors"
            aria-label="Refresh library"
          >
            ↺
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="text-xs text-ink-secondary active:text-ink transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Update TabBar.jsx**

Replace the `return` in `TabBar`:

```jsx
export default function TabBar({ activeTab, onTabChange }) {
  return (
    <nav
      className="flex h-16 border-t border-border-subtle flex-shrink-0 pb-safe"
      style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? 'text-accent' : 'text-ink-muted'
            }`}
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
  )
}
```

- [ ] **Step 4: Verify in browser**

Run `npm run dev`. Check:
- Background is `#0a0a0a` (near black)
- Header has dark background, light text
- TabBar has frosted-glass dark bg, active tab icon is green
- Loading screen (if triggered) shows dark bg + green progress bar

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/layout/Header.jsx src/components/layout/TabBar.jsx
git commit -m "style: dark theme for app shell, header, tab bar"
```

---

## Task 3: Featured Album Card (Single Pick)

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx` — `FeaturedAlbumCard` function (lines ~100–195)

- [ ] **Step 1: Replace FeaturedAlbumCard**

Find `function FeaturedAlbumCard` and replace the entire function:

```jsx
function FeaturedAlbumCard({ album, stats, onQueue, onSave, onRemove, saved, onTap }) {
  const art     = album.images?.[0]?.url
  const artist  = (album.artists || []).map(a => a.name).join(', ')
  const cluster = getGenreCluster(album)
  const count   = stats?.listenCount ?? 0
  const year    = (album.release_date || '').substring(0, 4)
  const [revealRef, revealed] = useScrollReveal()

  return (
    <div
      ref={revealRef}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)',
        animation: revealed ? 'cardIn 0.4s cubic-bezier(0.32,0.72,0,1) both' : 'none',
      }}
      className="bg-card rounded-2xl border border-border-subtle overflow-hidden"
    >
      {/* Cover with badges overlay */}
      <div
        className="relative w-full aspect-square cursor-pointer active:opacity-90 transition-opacity duration-200"
        onClick={onTap}
      >
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover block" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-5xl bg-card-raised">💿</div>
        }

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {count > 0 && (
            <span
              className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{
                background: 'rgba(30,215,96,0.2)',
                color: '#1ed760',
                border: '1px solid rgba(30,215,96,0.3)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {count}×
            </span>
          )}
          {year && (
            <span
              className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#f0f0f0',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {year}
            </span>
          )}
        </div>

        {/* Swipe hints — bottom */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between pointer-events-none">
          <span
            className="px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#8a8a8a',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            ← Skip
          </span>
          <span
            className="px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{
              background: 'rgba(30,215,96,0.2)',
              color: '#1ed760',
              border: '1px solid rgba(30,215,96,0.3)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            Queue →
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 pt-3 pb-1 cursor-pointer" onClick={onTap}>
        <p className="text-[17px] font-bold text-ink leading-snug line-clamp-2">{album.name}</p>
        <p className="text-[13px] text-ink-secondary mt-1 truncate">{artist}</p>
        {cluster && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: 'rgba(138,138,255,0.15)', color: '#a0a0ff' }}
            >
              {cluster.icon} {cluster.label}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); onQueue(album) }}
          className="w-full py-3.5 rounded-xl text-[15px] font-bold transition-all duration-200 active:scale-[0.98]"
          style={{ background: '#1ed760', color: '#000' }}
        >
          ▶ Queue to Spotify
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); saved ? onRemove(album.id) : onSave(album) }}
          className="w-full py-3.5 rounded-xl text-[14px] font-semibold border border-border-subtle text-ink transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'transparent' }}
        >
          {saved ? 'Saved ✓' : '⏰ Save for Later'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to Discover tab. Verify:
- Card has dark bg (`#141414`)
- Cover fills full card width
- Listens badge (green, blur) and year badge (white, blur) visible top-left
- "← Skip" and "Queue →" hints visible at cover bottom
- Metadata (title, artist, genre) below cover on dark bg
- Green Queue button, ghost Save button

- [ ] **Step 3: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "style: dark album card for single pick — cover badges, swipe hints, dark surface"
```

---

## Task 4: Multi-Pick — Horizontal Scroll Cards

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx` — `SwipeableAlbumRow` and `MultiPickList` functions

The current `SwipeableAlbumRow` is a horizontal list row (small cover + text + buttons). The new design uses cards with full-width covers in a horizontal scroll. Swipe direction is also corrected: **left = skip, right = queue** (matches spec; was reversed in old code).

- [ ] **Step 1: Replace SwipeableAlbumRow**

Find `function SwipeableAlbumRow` and replace the entire function:

```jsx
function SwipeableAlbumRow({ album, stats, onQueue, onSave, onRemove, saved, onTap }) {
  const art    = album.images?.[0]?.url
  const artist = (album.artists || []).map(a => a.name).join(', ')
  const count  = stats?.listenCount ?? 0
  const year   = (album.release_date || '').substring(0, 4)

  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [done,    setDone]    = useState(false)
  const startXRef             = useRef(null)

  const THRESHOLD = 80
  const MAX_DRAG  = 120

  function onPointerDown(e) {
    startXRef.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
    setSwiping(true)
  }

  function onPointerMove(e) {
    if (startXRef.current === null) return
    const dx = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, e.clientX - startXRef.current))
    setOffsetX(dx)
  }

  function onPointerUp() {
    if (startXRef.current === null) return
    const dx = offsetX
    startXRef.current = null
    setSwiping(false)

    if (dx < -THRESHOLD) {
      // Left swipe → Skip
      setDone(true)
    } else if (dx > THRESHOLD) {
      // Right swipe → Queue
      setDone(true)
      onQueue(album)
    } else {
      setOffsetX(0)
    }
  }

  if (done) return null

  const progress  = Math.abs(offsetX) / THRESHOLD
  const isLeft    = offsetX < -8
  const isRight   = offsetX > 8
  const leftOpacity  = isLeft  ? Math.min(1, progress) : 0
  const rightOpacity = isRight ? Math.min(1, progress) : 0

  return (
    <div
      className="bg-card rounded-2xl border border-border-subtle overflow-hidden flex-shrink-0"
      style={{ minWidth: 'calc(50% - 6px)' }}
    >
      {/* Cover with swipe gesture */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.15s ease',
          touchAction: 'pan-y',
          cursor: 'grab',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => { if (Math.abs(offsetX) < 5) onTap(album) }}
      >
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover block select-none" draggable={false} loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-4xl bg-card-raised">💿</div>
        }

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {count > 0 && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{
                background: 'rgba(30,215,96,0.2)', color: '#1ed760',
                border: '1px solid rgba(30,215,96,0.3)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              }}
            >{count}×</span>
          )}
        </div>

        {/* Swipe overlays */}
        <div className="absolute inset-0 flex items-center justify-start px-3 pointer-events-none"
             style={{ opacity: leftOpacity }}>
          <span className="text-[11px] font-bold" style={{ color: '#8a8a8a', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 6, backdropFilter: 'blur(8px)' }}>
            ← Skip
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-end px-3 pointer-events-none"
             style={{ opacity: rightOpacity }}>
          <span className="text-[11px] font-bold" style={{ color: '#1ed760', background: 'rgba(30,215,96,0.2)', padding: '4px 8px', borderRadius: 6, backdropFilter: 'blur(8px)' }}>
            Queue →
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-3 py-2.5 cursor-pointer" onClick={() => onTap(album)}>
        <p className="text-[13px] font-semibold text-ink leading-tight line-clamp-1">{album.name}</p>
        <p className="text-[11px] text-ink-secondary mt-0.5 truncate">{artist}</p>
        {year && <p className="text-[10px] text-ink-muted mt-0.5">{year}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace MultiPickList**

Find `function MultiPickList` and replace:

```jsx
function MultiPickList({ albums, getAlbumStats, onQueue, onSave, onRemove, isSaved, onTap, onQueueAll, onSaveAll }) {
  if (!albums.length) return null
  return (
    <div>
      {/* Horizontal scroll row */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1" style={{ paddingRight: 20 }}>
        {albums.map((album, i) => (
          <SwipeableAlbumRow
            key={album.id}
            album={album}
            stats={getAlbumStats(album)}
            onQueue={onQueue}
            onSave={onSave}
            onRemove={onRemove}
            saved={isSaved(album.id)}
            onTap={onTap}
          />
        ))}
      </div>

      {/* Batch actions */}
      {albums.length > 1 && (
        <div className="flex gap-3 pt-3">
          <button
            onClick={onQueueAll}
            className="flex-1 py-3.5 rounded-xl text-[14px] font-bold transition-all duration-200 active:scale-[0.98]"
            style={{ background: '#1ed760', color: '#000' }}
          >
            ▶ Queue All
          </button>
          <button
            onClick={onSaveAll}
            className="flex-1 py-3.5 rounded-xl text-[14px] font-semibold border border-border-subtle text-ink transition-all duration-200 active:scale-[0.98]"
            style={{ background: 'transparent' }}
          >
            Save All
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Switch count to 3 or 5. Verify:
- Cards appear side by side in horizontal scroll
- 2 cards visible, third partially visible (peek)
- Swipe left on a card → it disappears (skip)
- Swipe right on a card → it disappears + album queued
- "Queue All" and "Save All" buttons below row, green primary

- [ ] **Step 4: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "style: multi-pick horizontal scroll cards, fix swipe direction (left=skip right=queue)"
```

---

## Task 5: Filter Sheet — Dark Restyle

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx` — `FilterModal` function (lines ~374–568)

The `FilterModal` component already exists and has all the correct logic. Only the visual classes change.

- [ ] **Step 1: Replace FilterModal**

Find `function FilterModal` and replace the entire function:

```jsx
function FilterModal({ draftFilters, draftToggles, setDraftFilters, setDraftToggles, onApply, onClose, customPresets, onSavePreset, activeFilterCount }) {
  const [presetName, setPresetName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)

  function toggleDraftFilter(f) {
    setDraftFilters(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  function toggleDraftToggle(key) {
    setDraftToggles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const draftCount = draftFilters.size
    + (draftToggles.weightUnheard  ? 1 : 0)
    + (draftToggles.excludeKeywords ? 1 : 0)
    + (draftToggles.avoidRecent    ? 1 : 0)

  function handleSavePreset() {
    if (!showNameInput) { setShowNameInput(true); return }
    if (presetName.trim()) {
      onSavePreset(presetName.trim(), draftFilters, draftToggles)
      setShowNameInput(false)
      setPresetName('')
    }
  }

  const chipActive   = 'text-black font-semibold'
  const chipInactive = 'text-ink-secondary font-medium'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'toastIn 0.3s ease both' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[1.75rem] border-t border-border-subtle max-h-[88vh] flex flex-col"
        style={{ animation: 'sheetUp 0.45s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* Drag pill */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-card-raised" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border-subtle">
          <span className="text-[15px] font-semibold text-ink">Filters</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-ink-secondary text-[18px] leading-none active:scale-[0.92] transition-transform duration-200"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-5 pt-4">

          {/* Decades */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Decades</p>
            <div className="flex flex-wrap gap-2">
              {DECADES.map(d => {
                const active = draftFilters.has(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleDraftFilter(d)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
                      active
                        ? `border-accent bg-accent ${chipActive}`
                        : `border-border-subtle bg-card-raised ${chipInactive}`
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Genres */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Genres</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_CLUSTERS.map(c => {
                const active = draftFilters.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleDraftFilter(c.id)}
                    className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
                      active
                        ? `border-accent bg-accent ${chipActive}`
                        : `border-border-subtle bg-card-raised ${chipInactive}`
                    }`}
                  >
                    <span>{c.icon}</span><span>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Listening history */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Listening History</p>
            <div className="flex flex-wrap gap-2">
              {['Never heard', 'Not recently played'].map(label => {
                const active = draftFilters.has(label)
                return (
                  <button
                    key={label}
                    onClick={() => toggleDraftFilter(label)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
                      active
                        ? `border-accent bg-accent ${chipActive}`
                        : `border-border-subtle bg-card-raised ${chipInactive}`
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preferences */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Preferences</p>
            <div className="space-y-2">
              {[
                { key: 'weightUnheard',   label: '⚖ Weighted',            desc: 'Unheard albums 10× more likely' },
                { key: 'excludeKeywords', label: '🚫 No Remixes',          desc: 'Filters live/remix/edit/version' },
                { key: 'avoidRecent',     label: '🕐 Not Recently Queued', desc: 'Skips albums queued in last 30 days' },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => toggleDraftToggle(key)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-card-raised border border-border-subtle active:opacity-70 transition-all duration-200"
                >
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-ink">{label}</p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{desc}</p>
                  </div>
                  {/* Toggle */}
                  <div
                    className={`w-11 h-6 rounded-full relative flex-shrink-0 border transition-all duration-300 ${
                      draftToggles[key] ? 'bg-accent border-accent' : 'bg-card border-border-subtle'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                        draftToggles[key] ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 pt-3 pb-4 flex-shrink-0 pb-safe border-t border-border-subtle space-y-2">
          {/* Save as Preset — only shown if filters active */}
          {draftCount > 0 && (
            showNameInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                  placeholder="Preset name…"
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-xl bg-card-raised border border-border-subtle text-ink text-[13px] outline-none focus:border-accent"
                />
                <button
                  onClick={handleSavePreset}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-accent text-accent transition-colors active:opacity-70"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={handleSavePreset}
                className="w-full py-3 rounded-xl text-[13px] font-semibold border border-border-subtle text-ink-secondary transition-colors active:opacity-70"
                style={{ background: 'transparent' }}
              >
                + Save as Preset
              </button>
            )
          )}

          {/* Apply */}
          <button
            onClick={onApply}
            className="w-full py-3.5 rounded-xl text-[15px] font-bold transition-all duration-200 active:scale-[0.98]"
            style={{ background: '#1ed760', color: '#000' }}
          >
            {draftCount > 0 ? `Apply ${draftCount} filter${draftCount > 1 ? 's' : ''} →` : 'Apply →'}
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update FilterModal call site in DiscoverTab**

The `FilterModal` is rendered near the bottom of `DiscoverTab`. Find where it's called (look for `filterModalOpen &&`) and add the two new props it now expects:

```jsx
{filterModalOpen && (
  <FilterModal
    draftFilters={draftFilters}
    draftToggles={draftToggles}
    setDraftFilters={setDraftFilters}
    setDraftToggles={setDraftToggles}
    onApply={applyFilters}
    onClose={closeFilterModal}
    customPresets={customPresets}
    onSavePreset={savePreset}
    activeFilterCount={activeFilterCount}
  />
)}
```

Then check that `savePreset` and `activeFilterCount` exist in the main component. If `savePreset` doesn't exist yet, add this function in the main `DiscoverTab` component body (after the existing state declarations):

```js
function savePreset(name, filters, toggleState) {
  const preset = {
    id: Date.now().toString(),
    icon: '⭐',
    label: name,
    filters: [...filters],
    toggles: { ...toggleState },
  }
  const next = [...customPresets, preset]
  setCustomPresets(next)
  localStorage.setItem('discover_presets', JSON.stringify(next))
}
```

- [ ] **Step 3: Verify in browser**

Open filter sheet (tap ⚙ button). Verify:
- Dark background (`#141414`)
- "×" close button top right
- Decade/Genre/History chips: inactive = dark surface, active = green fill
- Preference toggles: green when on, dark when off
- When any filter active: "+ Save as Preset" ghost button appears above Apply
- Apply button is green

- [ ] **Step 4: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "style: dark filter sheet, add Save as Preset button"
```

---

## Task 6: Preset Row + Filter Button + Discover Tab Header

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx` — `Chip` component + main `DiscoverTab` return JSX

This task updates the Chip component to dark styles, adds the ⚙ filter button with active count badge, and gives the Discover tab its own in-tab header (replacing the global header for Discover content).

- [ ] **Step 1: Update Chip component**

Find `function Chip` and replace:

```jsx
function Chip({ label, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full
                  text-[12px] font-medium transition-all duration-200 active:scale-[0.97] border
        ${active
          ? 'bg-accent border-accent text-black font-semibold'
          : 'bg-card-raised border-border-subtle text-ink-secondary hover:text-ink'
        }`}
    >
      {children || label}
    </button>
  )
}
```

- [ ] **Step 2: Update the main DiscoverTab return JSX**

Find the `return (` in `export default function DiscoverTab` and replace the outer wrapper + header + preset row section. Look for the section that renders the preset chips and filter button, and update it to match this structure:

```jsx
return (
  <div className="flex flex-col min-h-full">
    {/* In-tab header */}
    <div className="px-5 pt-6 pb-2">
      <h1 className="text-[26px] font-bold text-ink tracking-tight">Discover</h1>
      {/* subtitle shown by parent Header already — skip duplicate */}
    </div>

    {/* Preset row + filter button */}
    <div className="flex items-center gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide">
      {BUILTIN_PRESETS.map(p => (
        <Chip
          key={p.id}
          active={activePreset === p.id}
          onClick={() => applyPreset(p.id)}
        >
          {p.icon} {p.label}
        </Chip>
      ))}

      {/* ⚙ Filter button with badge */}
      <button
        onClick={openFilterModal}
        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border-subtle bg-card-raised text-ink-secondary text-[12px] font-medium transition-all duration-200 active:scale-[0.97] relative"
      >
        ⚙
        {activeFilterCount > 0 && (
          <span
            className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-black"
            style={{ background: '#1ed760' }}
          >
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Custom presets */}
      {customPresets.map(p => (
        <Chip
          key={p.id}
          active={activePreset === p.id}
          onClick={() => applyCustomPreset(p)}
        >
          {p.icon} {p.label}
        </Chip>
      ))}
    </div>

    {/* Count selector */}
    <div className="flex items-center gap-2 px-5 pb-4">
      <span className="text-[12px] text-ink-muted mr-1">Pick</span>
      {PICK_COUNTS.map(n => (
        <button
          key={n}
          onClick={() => setPickCount(n)}
          className={`w-9 h-9 rounded-full text-[13px] font-semibold border transition-all duration-200 active:scale-[0.95] ${
            pickCount === n
              ? 'bg-card-raised border-ink-muted text-ink'
              : 'bg-card border-border-subtle text-ink-muted'
          }`}
        >
          {n}
        </button>
      ))}
    </div>

    {/* Picker area */}
    <div className="px-5 flex-1">
      {/* Section label */}
      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-3">
        {pickedAlbums.length > 1 ? `Your Picks · ${pickedAlbums.length}` : 'Your Pick'}
      </p>

      {pickedAlbums.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-ink-muted text-sm">No albums match your filters</p>
          <button
            onClick={() => { setActiveFilters(new Set()); setToggles({ weightUnheard: false, excludeKeywords: false, avoidRecent: false }) }}
            className="text-accent text-sm font-medium"
          >
            Clear filters
          </button>
        </div>
      )}

      {pickedAlbums.length === 1 && (
        <FeaturedAlbumCard
          album={pickedAlbums[0]}
          stats={getAlbumStats(pickedAlbums[0])}
          onQueue={handleQueue}
          onSave={saveLater}
          onRemove={removeLater}
          saved={isSaved(pickedAlbums[0].id)}
          onTap={() => setSelectedAlbum(pickedAlbums[0])}
        />
      )}

      {pickedAlbums.length > 1 && (
        <MultiPickList
          albums={pickedAlbums}
          getAlbumStats={getAlbumStats}
          onQueue={handleQueue}
          onSave={saveLater}
          onRemove={removeLater}
          isSaved={isSaved}
          onTap={setSelectedAlbum}
          onQueueAll={handleQueueAll}
          onSaveAll={handleSaveAll}
        />
      )}

      {/* Re-pick button */}
      {pickedAlbums.length > 0 && (
        <button
          onClick={pickAlbums}
          className="w-full mt-4 py-3.5 rounded-xl text-[14px] font-semibold border border-border-subtle text-ink-secondary transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'transparent' }}
        >
          🎲 Show Another
        </button>
      )}
    </div>

    {/* Bottom padding for tab bar */}
    <div className="h-6" />

    {/* AlbumModal */}
    {selectedAlbum && (
      <AlbumModal
        album={selectedAlbum}
        stats={getAlbumStats(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
        onQueue={handleQueue}
        onSave={saveLater}
        onRemove={removeLater}
        saved={isSaved(selectedAlbum.id)}
      />
    )}

    {/* Filter sheet */}
    {filterModalOpen && (
      <FilterModal
        draftFilters={draftFilters}
        draftToggles={draftToggles}
        setDraftFilters={setDraftFilters}
        setDraftToggles={setDraftToggles}
        onApply={applyFilters}
        onClose={closeFilterModal}
        customPresets={customPresets}
        onSavePreset={savePreset}
        activeFilterCount={activeFilterCount}
      />
    )}

    {/* Toast */}
    {queueStatus && (
      <div
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                   px-4 py-2.5 rounded-2xl text-[12px] font-semibold text-black"
        style={{ background: '#1ed760', animation: 'toastIn 0.3s ease both' }}
      >
        {queueStatus}
      </div>
    )}
  </div>
)
```

**Note:** The existing `DiscoverTab` has additional helper functions (`applyPreset`, `applyCustomPreset`, `pickAlbums`, `handleQueue`, `handleQueueAll`, `handleSaveAll`, `openFilterModal`, `closeFilterModal`, `applyFilters`, `activeFilterCount`). These already exist in the component — do NOT remove them. Only replace the `return (...)` block.

- [ ] **Step 3: Verify in browser**

Full Discover Tab check:
- Dark in-tab "Discover" heading
- Preset chips: dark surface inactive, green active
- ⚙ button with green badge when filters active
- Count selector: circular chips
- Single pick: dark card with cover badges
- Multi pick: horizontal scroll row of cards
- "Show Another" button below pick
- Filter sheet opens on ⚙ tap

- [ ] **Step 4: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "style: Discover tab dark — preset row, filter badge, count selector, section header"
```

---

## Self-Review Checklist

After all tasks complete:

- [ ] Background is `#0a0a0a` everywhere (no white flash on load)
- [ ] All covers use `--color-card` (`#141414`) background, not white
- [ ] Accent green (`#1ed760`) used only for: active states, Queue button, filter badge
- [ ] No hardcoded light colors (`#fafafa`, `#ffffff`, `#f5f5f5`) remain in touched files
- [ ] Swipe left = skip, swipe right = queue (confirmed in SwipeableAlbumRow)
- [ ] "Save as Preset" only appears in filter sheet when ≥1 filter active
- [ ] App loads without console errors
- [ ] AlbumModal (not in scope) still opens correctly when tapping a card
