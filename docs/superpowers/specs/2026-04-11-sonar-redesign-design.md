# SONAR Redesign — Design Spec

**Date:** 2026-04-11
**Branch:** `feature/sonar-redesign`
**Source:** AI Studio export — "Major Redesign Design Name Flow"
**Approach:** Port design component-by-component into existing app. Real data layer untouched.

---

## Summary

Major visual and structural redesign of the Album Discovery app. New app name: **SONAR**. The 4-tab navigation collapses to 3 tabs. framer-motion is added for animations. All existing hooks and data infrastructure remain unchanged.

---

## Tab Structure

| Tab | Sub-tabs | Notes |
|---|---|---|
| Discover | — | Unchanged scope, visual refresh |
| Browse | Library / Insights / Explore | Replaces Library + Stats as top-level tabs |
| Later | — | Grid view (2 cols) instead of list |

**Browse sub-tab state:** `browseSubTab` in `App.jsx` → `'library' | 'insights' | 'explore'`

**Explore:** Stub/placeholder only in this version. "Coming Soon" screen in SONAR design. To be implemented in a future session.

---

## Infrastructure Changes

### New branch
`feature/sonar-redesign` branched from `main`.

### New dependencies
- `motion` (framer-motion v11, `motion/react` import style)
- `clsx`
- `tailwind-merge`

### New utility files
- `src/lib/utils.js` — exports `cn(...inputs)` using clsx + tailwind-merge
- `src/lib/badge-utils.js` — exports `getAlbumBadges(album, lastfmStats)` and `getSimilarAlbums(album, library, count=4)`

### Unchanged files
- `src/hooks/useLibrary.js`
- `src/hooks/useLastfm.js`
- `src/hooks/useListenLater.js`
- `src/lib/spotify-api.js`
- `src/lib/auth.js`
- `src/lib/db.js`
- `src/data/genre-clusters.js`
- `public/lastfm-data.json`

---

## Component Changes

Port order (Shell → Shared → Browse → Discover → Later):

### 1. `src/lib/utils.js` — new
`cn()` utility combining clsx + tailwind-merge. Used everywhere.

### 2. `src/lib/badge-utils.js` — new
**`getAlbumBadges(album, lastfmStats)`**
Returns `Array<{ value, label, icon, color }>` based on:
- Listen count: Masterpiece (>100×), Heavy Rotation (>50×), Hidden Gem (<5×, >0), Unheard (=0)
- Release year: Vintage (<1970), Golden Oldie (<1980), Brand New (≥2024), Recent (≥2020)
- Track count: Epic LP (≥15 tracks), EP (≤6 tracks)
- Genre cluster: Late Night (electronic), Focus (jazz/classical)

**`getSimilarAlbums(album, library, count=4)`**
Filters real Spotify library by same genre cluster, excludes current album, returns up to `count` albums. No external API call.

### 3. `src/components/layout/Header.jsx` — rewrite
- Left: Hamburger button → opens Sidebar
- Center: Compass icon + "SONAR" wordmark
- Right: User avatar circle
- Sidebar component (framer-motion `x` slide) lives here
- Settings Modal (framer-motion scale) lives here

**Sidebar contents:** Settings link, BurnAnalytics widget (existing logic), Sign Out (existing `handleSignOut`)

**Settings Modal sections (collapsible):**
- Sync: Spotify refresh (`handleRefresh`), Last.fm info
- Carousels: visibility toggle + sort per carousel (state in App.jsx via localStorage)
- Explore: placeholder text "Playlists kommen bald"

### 4. `src/components/layout/TabBar.jsx` — rewrite
- 3 tabs: Discover / Browse / Later
- When Browse is active: second row with sub-tabs Library / Insights / Explore

### 5. `src/components/AlbumModal.jsx` — major update
- framer-motion Bottom Sheet with drag-to-close (`offset.y > 150` or `velocity.y > 500`)
- Badge row at top (scrollable, tappable → `onBadgeClick(badge)`)
- "Burn" animation on Queue/Save: cover scales down + blur + rotate, spinner shows, modal closes (~400ms)
- "Similar To" section: `getSimilarAlbums()` from real library, tap → opens that album in same modal
- `onBadgeClick` prop: navigates to Browse > Library with badge as active filter

### 6. `src/components/browse/BrowseTab.jsx` — new container
- Receives `libraryFilter` + `onClearFilter` as props from App.jsx (filter state lives in App.jsx because badge clicks can originate from any tab)
- Renders sub-tab content: LibraryTab / InsightsTab / ExploreTab
- Passes `libraryFilter` + `onClearFilter` down to LibraryTab

### 7. `src/components/library/LibraryTab.jsx` — visual update
- Inline expandable filter panel (framer-motion height animation) instead of modal
- Badge-based filter support: when `libraryFilter` prop is set, shows active filter banner
- Updated chip/button styles to match SONAR design

### 8. `src/components/stats/InsightsTab.jsx` — rename + update
- File renamed from `StatsTab.jsx` to `InsightsTab.jsx`
- Most Played carousel gets time-range filter: 7D / 3M / 6M / 1Y / ALL
- Carousel burn animation: `AnimatePresence mode="popLayout"` — items collapse with scale+blur when burned
- Carousel visibility/sort controlled by Settings Modal (state from App.jsx)

### 9. `src/components/explore/ExploreTab.jsx` — new stub
- "Coming Soon" placeholder in full SONAR design language
- No functionality, just visual placeholder

### 10. `src/components/listen-later/LaterTab.jsx` — visual update
- 2-column grid layout instead of list
- Same hooks and logic, only layout changes

---

## New Features Detail

### Album Badges
- Appear in: AlbumModal (top scrollable row), Discover multi-pick cards (max 2)
- Tappable in AlbumModal → triggers `onBadgeClick(badge)` → App.jsx sets `activeTab = 'browse'`, `browseSubTab = 'library'`, `libraryFilter = badge`
- Colors: each badge type has its own bg/text/border color via Tailwind utility classes

### Similar To (AlbumModal)
- Section heading: "Similar To" with "AI Matching" label (decorative)
- 2×2 grid of album cards with cover, name, artist
- Tap navigates to that album within the same open modal (replaces current album state)
- Data: purely from local library cache, no API calls

### Burn Animation
- Triggered when user taps "Queue to Spotify" or "Save for Later" in AlbumModal
- Cover: `scale: 0.5, opacity: 0, rotate: -10`
- Spinner: RefreshCw icon, accent color, `animate-spin`
- Duration: 400ms, then modal closes and action is recorded

### BurnAnalytics Widget (Sidebar)
- Shows: total burned count, total resets, most-burned carousel name
- Reads from existing `burnedItems` + `carouselResets` state in App.jsx
- Passed as props from App.jsx into Sidebar

---

## Animation Strategy (framer-motion)

| Element | Animation |
|---|---|
| Bottom sheets (Modal, Filter) | `y: '100%'` → `0`, spring `damping:30 stiffness:300`, drag-to-close |
| Sidebar | `x: '-100%'` → `0`, tween `duration: 0.25` |
| Settings Modal | `scale: 0.9, opacity: 0` → `scale: 1, opacity: 1`, spring |
| Carousel item burn | `scale: 0.5, filter: blur(10px)`, `AnimatePresence mode="popLayout"` |
| Library filter panel | `height: 0` → `auto`, opacity fade |
| Tab content | No cross-fade (state complexity). Sub-tab switch: instant. |
| Discover swipe cards | Port to framer-motion `drag` (replaces current touch events) |
| Backdrop overlays | `opacity: 0` → `1`, `backdrop-blur-sm` |

---

## App.jsx State Changes

New state added to App.jsx:

```js
const [activeTab, setActiveTab] = useState('discover') // 'discover' | 'browse' | 'later'
const [browseSubTab, setBrowseSubTab] = useState('library') // 'library' | 'insights' | 'explore'
const [isSidebarOpen, setIsSidebarOpen] = useState(false)
const [isSettingsOpen, setIsSettingsOpen] = useState(false)
const [libraryFilter, setLibraryFilter] = useState(null) // { value, label, icon } | null
const [carouselSettings, setCarouselSettings] = useState({
  most: { visible: true, sort: 'original' },
  latest: { visible: true, sort: 'original' },
  oldies: { visible: true, sort: 'original' },
  climbers: { visible: true, sort: 'original' },
  fallers: { visible: true, sort: 'original' },
  today: { visible: true, sort: 'original' },
}) // persisted to localStorage
```

Badge click handler:
```js
const handleBadgeClick = (badge) => {
  setLibraryFilter(badge)
  setActiveTab('browse')
  setBrowseSubTab('library')
}
```

---

## Design Tokens

Unchanged from current Obsidian Design System (`DESIGN.md`). Same CSS vars in `index.css`:
- `--color-page: #0a0a0a`
- `--color-accent: #1ed760`
- `--color-card`, `--color-card-raised`, `--color-border-subtle`, etc.

---

## Out of Scope (this version)

- TypeScript migration
- Explore tab implementation (real playlists)
- Artist Deep Dive Modal
- Library Coverage Bar
- Any backend or server changes
