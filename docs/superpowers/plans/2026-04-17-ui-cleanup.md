# UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted UI improvements — remove clutter, fix broken covers, redesign the Discover preset selector.

**Architecture:** All changes are isolated to three JSX files. No new data dependencies. The preset selector introduces one new bottom sheet component (`PresetSheet`) inside `DiscoverTab.jsx`, replacing the horizontal chip row.

**Tech Stack:** React (Vite), Tailwind CSS v4, `motion/react` v12 for animations.

---

### Task 1: Remove "Discover" heading

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx` (lines 755–758)

- [ ] **Step 1: Delete the heading block**

In `DiscoverTab.jsx`, remove this block (around line 755):

```jsx
{/* In-tab header */}
<div className="px-5 pt-6 pb-2">
  <h1 className="text-[26px] font-bold text-ink tracking-tight">Discover</h1>
</div>
```

The outer `<div className="flex flex-col min-h-full">` stays. The next element after removal is the preset row div.

- [ ] **Step 2: Verify in browser**

Run `npm run dev`, open Discover tab — no "Discover" heading should appear.

- [ ] **Step 3: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "feat: remove Discover heading from DiscoverTab"
```

---

### Task 2: Remove track list from AlbumModal

**Files:**
- Modify: `src/components/AlbumModal.jsx` (lines 274–291)

- [ ] **Step 1: Delete the Tracks section**

In `AlbumModal.jsx`, remove this entire block (starting around line 274):

```jsx
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
```

Keep `const tracks = currentAlbum.tracks?.items || []` (line 58) — it's still used by `handleQueue`.  
`fmtDuration` is now unused — remove it too (lines 9–12):

```jsx
function fmtDuration(ms) {
  if (!ms) return ''
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
```

- [ ] **Step 2: Verify in browser**

Open any AlbumModal — no "Tracks" section. Queue button still works.

- [ ] **Step 3: Commit**

```bash
git add src/components/AlbumModal.jsx
git commit -m "feat: remove track list from AlbumModal"
```

---

### Task 3: Strip Stats metrics and charts

**Files:**
- Modify: `src/components/stats/StatsTab.jsx`

- [ ] **Step 1: Remove dead helper code**

Remove the `MetricCard` component (lines 85–93):
```jsx
function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border-subtle flex-1 min-w-0">
      <p className="text-[10px] font-medium text-ink-muted">{label}</p>
      <p className="text-[22px] font-semibold text-ink mt-0.5 leading-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
```

Remove the `CAROUSEL_NAMES` constant (lines 21–28):
```jsx
const CAROUSEL_NAMES = {
  'most-played':        '👑 Most Played',
  'latest-discoveries': '🔭 Latest Discoveries',
  'golden-oldies':      '🕰️ Golden Oldies',
  'climbers':           '📈 Climbers',
  'fallers':            '📉 Fallers',
  'on-this-day':        '📅 On This Day',
}
```

Remove the `fmtCount` helper (lines 51–53):
```jsx
function fmtCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
```

- [ ] **Step 2: Remove dead useMemo hooks**

Remove all five of these blocks (roughly lines 206–224 and 343–380):

```jsx
const totalScrobbles = useMemo(() =>
  [...lastfmMap.values()].reduce((s, e) => s + (e.rawScrobbles || 0), 0)
, [lastfmMap])

const totalListens = useMemo(() =>
  enriched.reduce((s, e) => s + (e.listenCount || 0), 0)
, [enriched])

const topAlbum = useMemo(() =>
  enriched.reduce((best, e) => (!best || e.listenCount > best.listenCount) ? e : best, null)
, [enriched])

const listeningSince = useMemo(() => {
  let min = Infinity
  for (const e of lastfmMap.values()) {
    if (e.firstHeard && e.firstHeard < min) min = e.firstHeard
  }
  return min === Infinity ? null : new Date(min).getFullYear()
}, [lastfmMap])
```

```jsx
const genreData = useMemo(() => {
  // ... (full block, ~20 lines)
}, [enriched])

const decadeData = useMemo(() => {
  // ... (full block, ~15 lines)
}, [enriched])
```

- [ ] **Step 3: Remove render sections**

In the return JSX, remove:

**Summary metrics block** (starts with `{/* Summary metrics */}`, ~lines 413–428):
```jsx
{/* Summary metrics */}
<div className="space-y-2">
  <div className="flex gap-2">
    <MetricCard label="Scrobbles" value={fmtCount(totalScrobbles)} />
    <MetricCard label="Listens"   value={fmtCount(totalListens)}   />
  </div>
  <div className="flex gap-2">
    <MetricCard
      label="Top album"
      value={topAlbum ? `${topAlbum.listenCount}×` : '—'}
      sub={topAlbum?.name}
    />
    <MetricCard label="Since" value={listeningSince ?? '—'} />
  </div>
</div>
```

**Burn stats block** (~lines 430–468) — the entire `{burnStats.totalBurned > 0 && (...)}` expression.

**Decade breakdown section** (~lines 554–570):
```jsx
{decadeData.length > 0 && (
  <section>
    <h2 className="text-[13px] font-medium text-ink mb-3">Listening by decade</h2>
    ...
  </section>
)}
```

**Genre breakdown section** (~lines 572–588):
```jsx
{genreData.length > 0 && (
  <section>
    <h2 className="text-[13px] font-medium text-ink mb-3">Listening by genre</h2>
    ...
  </section>
)}
```

- [ ] **Step 4: Verify in browser**

Open Stats tab — only carousels visible. No metrics, no burn stats block, no bar charts. Carousel burn/reset still works.

- [ ] **Step 5: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "feat: remove stats metrics and charts, keep carousels only"
```

---

### Task 4: Fix CarouselItem covers (black spots + size mismatch)

**Files:**
- Modify: `src/components/stats/StatsTab.jsx`

This task fixes both issues in one component edit:
- **Item 5 (black spots):** Add `onError` state so broken image URLs fall back to the emoji placeholder.
- **Item 6 (size mismatch):** Add `className` prop to `CarouselItem` so the Most Played `motion.div` wrapper (which already sets `w-[calc(50%-8px)]`) doesn't double-apply that width.

- [ ] **Step 1: Update `CarouselItem` component**

Replace the existing `CarouselItem` function (lines 97–121) with:

```jsx
function CarouselItem({ entry, onTap, className }) {
  const [imgError, setImgError] = useState(false)
  const images = entry.spotifyAlbum?.images
  const art    = !imgError ? images?.[0]?.url : null
  const itemClass = className ?? 'flex-shrink-0 w-[calc(50%-8px)]'

  return (
    <div
      className={`${itemClass} ${onTap ? 'cursor-pointer active:opacity-80 transition-opacity' : ''}`}
      onClick={onTap ? () => onTap(entry) : undefined}
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-card mb-2">
        {art
          ? <img
              src={art}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          : <div className="w-full h-full flex items-center justify-center text-3xl">💿</div>
        }
      </div>
      <p className="text-[13px] font-semibold text-ink leading-tight line-clamp-2">{entry.name}</p>
      <p className="text-[11px] text-ink-muted mt-0.5 truncate">{entry.artist}</p>
      {entry._stat && (
        <span className="inline-block mt-1 text-[11px] font-medium text-accent">
          {entry._stat}
        </span>
      )}
    </div>
  )
}
```

Note: `useState` is already imported at the top of `StatsTab.jsx`.

- [ ] **Step 2: Pass `className="w-full"` in Most Played**

In the Most Played section, the `motion.div` already sets `w-[calc(50%-8px)]`. Pass `className="w-full"` to `CarouselItem` so it fills its wrapper:

Find this block (~line 516):
```jsx
<motion.div
  key={`${item.artist}||${item.name}`}
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
  className="flex-shrink-0 w-[calc(50%-8px)] cursor-pointer active:opacity-80 transition-opacity"
  onClick={() => handleCarouselTap(item)}
>
  <CarouselItem entry={item} />
</motion.div>
```

Change `<CarouselItem entry={item} />` to `<CarouselItem entry={item} className="w-full" />`.

- [ ] **Step 3: Verify in browser**

Open Stats → Most Played. Covers should be the same size as other carousels. For a broken cover (if any), the 💿 emoji should appear instead of a black square.

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/StatsTab.jsx
git commit -m "fix: carousel cover size and broken image fallback in Most Played"
```

---

### Task 5: Discovery Mode preset selector

**Files:**
- Modify: `src/components/discover/DiscoverTab.jsx`

Replace the horizontal chip-scroll row with a "Discovery Mode" card + filter button. Add a new `PresetSheet` bottom sheet.

- [ ] **Step 1: Add `PresetSheet` component**

Add this new component directly above the `// ── Main component ──` comment:

```jsx
// ── PresetSheet ───────────────────────────────────────────────────────

function PresetSheet({ builtins, customPresets, activePreset, onSelect, onDelete, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[1.75rem] border-t border-border-subtle max-h-[75vh] flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Drag pill */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-card-raised" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border-subtle">
          <span className="text-[15px] font-semibold text-ink">Discovery Mode</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-ink-secondary text-[18px] leading-none active:scale-[0.92] transition-transform duration-200"
          >
            ×
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {builtins.map(p => {
            const isActive = activePreset === p.id
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-card-raised border-border-subtle'
                }`}
              >
                <span className="text-2xl flex-shrink-0">{p.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <p className={`text-[14px] font-bold leading-tight ${isActive ? 'text-accent' : 'text-ink'}`}>{p.label}</p>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mt-0.5">Smart Algorithm</p>
                </div>
                {isActive && <span className="text-accent text-[18px] flex-shrink-0">✓</span>}
              </button>
            )
          })}

          {customPresets.length > 0 && (
            <>
              <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest px-1 pt-2">My Presets</p>
              {customPresets.map(p => {
                const isActive = activePreset === p.id
                const filterCount = (p.filters?.length ?? 0)
                  + (p.toggles?.weightUnheard   ? 1 : 0)
                  + (p.toggles?.excludeKeywords ? 1 : 0)
                  + (p.toggles?.avoidRecent     ? 1 : 0)
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all duration-200 ${
                      isActive
                        ? 'bg-accent/10 border-accent/40'
                        : 'bg-card-raised border-border-subtle'
                    }`}
                  >
                    <button
                      onClick={() => onSelect(p.id)}
                      className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    >
                      <span className="text-2xl flex-shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] font-bold leading-tight truncate ${isActive ? 'text-accent' : 'text-ink'}`}>{p.label}</p>
                        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mt-0.5">
                          {filterCount} Filter{filterCount !== 1 ? 's' : ''} Active
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isActive && <span className="text-accent text-[18px]">✓</span>}
                      <button
                        onClick={() => onDelete(p.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-400 border border-red-400/30 bg-red-400/10 active:opacity-70 transition-opacity"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
        {/* Safe-area spacing */}
        <div className="pb-safe h-4 flex-shrink-0" />
      </motion.div>
    </>
  )
}
```

- [ ] **Step 2: Add `presetSheetOpen` state**

In the main `DiscoverTab` component, add one new state variable alongside the others:

```jsx
const [presetSheetOpen, setPresetSheetOpen] = useState(false)
```

- [ ] **Step 3: Add helper to get active preset label**

Add this derived value after the `activeFilterCount` calculation:

```jsx
const activePresetLabel = activePreset
  ? ([...BUILTIN_PRESETS, ...customPresets].find(p => p.id === activePreset)?.label ?? 'Custom')
  : 'Surprise Me'

const activePresetIcon = activePreset
  ? ([...BUILTIN_PRESETS, ...customPresets].find(p => p.id === activePreset)?.icon ?? '🎲')
  : '🎲'
```

- [ ] **Step 4: Replace chip-scroll row with new UI**

Find and replace the entire `{/* Preset row + filter button */}` block (~lines 760–798):

```jsx
{/* OLD — remove this entire block:
<div className="flex items-center gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide">
  {BUILTIN_PRESETS.map(...)}
  <button onClick={openFilterModal}>⚙ ...</button>
  {customPresets.map(...)}
</div>
*/}
```

Replace with:

```jsx
{/* Discovery Mode selector */}
<div className="flex items-center gap-3 px-5 pb-3">
  <button
    onClick={() => setPresetSheetOpen(true)}
    className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-card-raised border border-border-subtle active:scale-[0.98] transition-all duration-200 text-left"
  >
    <span className="text-xl flex-shrink-0">{activePresetIcon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest leading-none mb-0.5">Discovery Mode</p>
      <p className="text-[14px] font-bold text-ink truncate">{activePresetLabel}</p>
    </div>
    <span className="text-ink-muted text-[14px] flex-shrink-0">›</span>
  </button>

  {/* Filter button */}
  <button
    onClick={openFilterModal}
    className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-card-raised border border-border-subtle relative active:scale-[0.97] transition-all duration-200"
  >
    <span className="text-ink-secondary text-[18px]">⊽</span>
    {activeFilterCount > 0 && (
      <span
        className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-black"
        style={{ background: '#1ed760' }}
      >
        {activeFilterCount}
      </span>
    )}
  </button>
</div>
```

- [ ] **Step 5: Add PresetSheet to the render**

In the return JSX, alongside the existing `{filterModalOpen && <FilterModal ...>}` inside `<AnimatePresence>`, add the PresetSheet:

```jsx
<AnimatePresence>
  {filterModalOpen && (
    <FilterModal
      draftFilters={draftFilters}
      draftToggles={draftToggles}
      setDraftFilters={setDraftFilters}
      setDraftToggles={setDraftToggles}
      onApply={applyFilters}
      onClose={() => setFilterModalOpen(false)}
      onSavePreset={savePreset}
      activeFilterCount={activeFilterCount}
    />
  )}
  {presetSheetOpen && (
    <PresetSheet
      builtins={BUILTIN_PRESETS}
      customPresets={customPresets}
      activePreset={activePreset}
      onSelect={(id) => { applyPreset(id); setPresetSheetOpen(false) }}
      onDelete={deleteCustomPreset}
      onClose={() => setPresetSheetOpen(false)}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 6: Verify in browser**

- Discover tab shows the "Discovery Mode" card (Surprise Me by default) + filter button
- Tapping the card opens the preset sheet with all presets listed
- Selecting a preset closes sheet and updates the card
- Filter button opens the existing filter sheet
- Custom presets show "X Filters Active" and a Delete button
- Delete removes the preset from the list (and localStorage)

- [ ] **Step 7: Commit**

```bash
git add src/components/discover/DiscoverTab.jsx
git commit -m "feat: replace preset chips with Discovery Mode selector sheet"
```

---

## Self-Review

**Spec coverage:**
- ✅ Item 1 — Task 1
- ✅ Item 2 — Task 5
- ✅ Item 3 — Task 2
- ✅ Item 4 — Task 3
- ✅ Item 5 — Task 4
- ✅ Item 6 — Task 4

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:**
- `PresetSheet` receives `builtins`, `customPresets`, `activePreset`, `onSelect`, `onDelete`, `onClose` — all passed correctly in Task 5 Step 5.
- `CarouselItem` `className` prop defaults to original value — no regressions in `Carousel` component.
- `activePresetLabel` / `activePresetIcon` read from `[...BUILTIN_PRESETS, ...customPresets]` — consistent with how `applyPreset` uses the same arrays.
