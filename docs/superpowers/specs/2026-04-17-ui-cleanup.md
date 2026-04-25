# UI Cleanup — Spec
_2026-04-17_

## Scope

Six targeted UI changes across DiscoverTab, StatsTab, and AlbumModal. No new data dependencies, no backend changes.

---

## 1. Remove "Discover" heading (DiscoverTab)

Remove the `<div className="px-5 pt-6 pb-2">` block containing the `<h1>Discover</h1>`.  
The tab is identified by the TabBar — the heading is redundant.

---

## 2. Discovery Mode Selector (DiscoverTab)

Replace the horizontal chip-scroll row with two elements:

### Discovery Mode Row
- Full-width tappable card: `[Icon] DISCOVERY MODE (label) / [Active Preset Name] (value)  >`
- Style: `bg-card-raised border border-border-subtle rounded-2xl px-4 py-3`
- Tapping opens the **Preset Picker Sheet**

### Filter Button
- Square icon button with funnel icon `⊽`, sits right of the row
- Green badge showing `activeFilterCount` when > 0
- Tapping opens the existing **FilterModal** (unchanged)

### Preset Picker Sheet (new bottom sheet)
- Drag pill + "Discovery Mode" header + ✕ close button
- Scrollable list of all presets:
  - Built-ins first: icon + name (bold) + subtitle `SMART ALGORITHM`
  - Custom presets after: icon + name (bold) + subtitle `X FILTERS ACTIVE` (count of filters + toggles)
- Active preset: green left border or green checkmark on the right
- Custom presets: red `Delete` button on the right (built-ins have no delete)
- Tap on any preset row → `applyPreset(id)` + close sheet
- Delete button → `deleteCustomPreset(id)` (no confirmation needed, list updates inline)

---

## 3. Remove Track List from AlbumModal

Remove the "Tracks" section (heading + `tracks.map(...)` list) from `AlbumModal.jsx`.  
The `tracks` variable is kept — it's still used by `handleQueue`.

---

## 4. Strip Stats metrics and charts (StatsTab)

**Remove from render:**
- Summary metrics block (Scrobbles, Listens, Top Album, Since)
- Burn stats block (Burned, Most Burned, Last Burned, per-carousel breakdown) — conditional on `burnStats.totalBurned > 0`
- "Listening by decade" bar chart section
- "Listening by genre" bar chart section

**Remove now-dead code:**
- `MetricCard` component
- `CAROUSEL_NAMES` constant
- `totalScrobbles`, `totalListens`, `topAlbum`, `listeningSince`, `genreData`, `decadeData` useMemos
- `fmtCount` helper

**Keep:** all carousel logic, burn tracking hooks, `carouselBurnProps`, `fmtAgo`, `fmtDate`.

---

## 5. Fix black/missing covers in Most Played carousel

Root cause: some Spotify album image URLs may be expired or broken. The `<img>` has no error handler, so failures render as a black rectangle.

Fix: add `onError` state to `CarouselItem` — on image load error, fall back to the `💿` emoji placeholder.

```jsx
function CarouselItem({ entry, onTap, className }) {
  const [imgError, setImgError] = useState(false)
  const art = !imgError && entry.spotifyAlbum?.images?.[0]?.url
  // ...
  {art
    ? <img ... onError={() => setImgError(true)} />
    : <div ...>💿</div>
  }
}
```

---

## 6. Fix cover size in Most Played carousel

Root cause: Most Played wraps each `CarouselItem` in a `motion.div` with `w-[calc(50%-8px)]`. `CarouselItem`'s own outer `div` also sets `w-[calc(50%-8px)]`, so the image renders at ~25% width instead of ~50%.

Fix: add a `className` prop to `CarouselItem` (default: `'flex-shrink-0 w-[calc(50%-8px)]'`). In the Most Played `motion.div`, pass `className="w-full"` so `CarouselItem` fills its wrapper instead of setting its own width.

---

## Files Touched

| File | Changes |
|------|---------|
| `src/components/discover/DiscoverTab.jsx` | Items 1, 2 |
| `src/components/AlbumModal.jsx` | Item 3 |
| `src/components/stats/StatsTab.jsx` | Items 4, 5, 6 |
