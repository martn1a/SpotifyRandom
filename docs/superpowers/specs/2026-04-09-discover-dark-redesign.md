# Design Spec: Discover Tab — Dark Theme Redesign

**Date:** 2026-04-09  
**Scope:** Discover Tab (reference implementation for full app redesign)  
**Theme:** Dark primary, light variant planned for later  
**Status:** Approved, ready for implementation

---

## Vision

Spotify-meets-Roon aesthetic. Album covers are the hero — everything else supports discovery. Dark OLED background makes covers glow. Clean, generous whitespace. Premium without being flashy.

---

## Color System

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0a0a0a` | App background (OLED) |
| `--surface` | `#141414` | Cards, picker container |
| `--surface-raised` | `#1e1e1e` | Hover states, active chips |
| `--ink` | `#f0f0f0` | Primary text |
| `--ink-2` | `#8a8a8a` | Labels, metadata, subtitles |
| `--ink-3` | `#4a4a4a` | Disabled, hints, muted |
| `--accent` | `#1ed760` | Queue action, active states (Spotify green) |
| `--border` | `#2a2a2a` | Card borders, dividers |

**Badge colors (on covers, always with backdrop-filter: blur):**
- Listens badge: `rgba(30,215,96,0.2)` bg, `#1ed760` text, `rgba(30,215,96,0.3)` border
- Year badge: `rgba(255,255,255,0.12)` bg, `#f0f0f0` text, `rgba(255,255,255,0.1)` border
- Genre tag (below cover): `rgba(138,138,255,0.15)` bg, `#a0a0ff` text

**Light mode:** Same token names, swap values — `#fafafa` bg, `#ffffff` cards, accent unchanged.

---

## Typography

- Font: System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`)
- Header title: 28px / weight 700 / letter-spacing -0.5px
- Section label: 11px / weight 600 / uppercase / letter-spacing 0.08em / `--ink-2`
- Album title: 16px / weight 700 (single), 13px (multi-row)
- Artist: 13px / weight 400 / `--ink-2`
- Button: 15px / weight 700 (primary), 600 (secondary)
- Badge: 11px / weight 600

---

## Discover Tab Structure

### Header
```
Discover                          ← 28px/700
1.172 Alben · Last.fm: Apr 9     ← 13px, --ink-2
```

### Preset Row (horizontal scroll, no wrap)
```
[🎲 Surprise Me] [💎 Forgotten Gems] [🕰 Deep Cuts] [⚙ 2] [Custom Preset…]
```
- Built-in presets always first (3 fixed)
- `⚙` button with active filter count badge — opens Filter Sheet
- Custom presets after built-ins (user-created via Filter Sheet)
- Active preset: `--surface-raised` background, `--ink` text, `--ink-3` border
- Inactive: `--surface` background, `--ink` text, `--border` border

### Count Selector
```
Pick  [1]  [3]  [5]  [10]
```
- Circular chips, 36×36px
- Active: `--surface-raised`, `--ink` text, `--ink-3` border
- Inactive: `--surface`, `--ink-2` text, `--border` border
- Default: 1

### Picker — 1 Album Mode

Full-width card (`--surface` bg, `--border` border, 16px radius):

```
┌────────────────────────────┐
│  [Cover 1:1, full width]   │  ← backdrop badges top-left
│  [22×]  [1994]             │  ← listens + year badges
│  [← Skip]      [Queue →]  │  ← swipe hints, bottom, blur bg
├────────────────────────────┤
│  Album Title (16px/700)    │
│  Artist Name (13px/--ink-2)│
│  [Industrial] [90s]        │  ← genre + decade tags
└────────────────────────────┘
```

### Picker — Multi Mode (3 / 5 / 10)

Horizontal scroll row, `overflow-x: auto`, no scrollbar visible:
- Each card: `min-width: calc(50% - 6px)` → 2 visible + partial peek of 3rd
- Same card structure as single, slightly smaller typography (13px title)
- Third+ cards: visible as peek (~30% width, 50% opacity)

### Action Buttons (below picker)
```
[▶ Queue to Spotify]   ← --accent bg, #000 text, full width, 14px padding
[⏰ Save for Later]    ← transparent bg, --ink text, --border border
```
Multi mode: "Queue All" / "Save All for Later"

### Swipe Interactions
- **Swipe left** → skip album, load new random pick
- **Swipe right** → queue to Spotify
- Each album in multi-row is individually swipeable
- Swipe hints visible on cover (blur backdrop, subtle)

### App Start Behavior
- Immediately loads random pick on open (no tap required)
- Default count: 1
- Default preset: Surprise Me

---

## Filter Sheet (Bottom Sheet)

Slides up from bottom (0.3s spring animation). Overlay behind blurs.

```
┌──────────────────────────┐
│ Filters              [×] │
├──────────────────────────┤
│ DECADES                  │
│ [60s][70s][80s✓][90s]…  │
│                          │
│ GENRES                   │
│ [⚡ Electronic✓][🎸 Rock]│
│                          │
│ LISTENING HISTORY        │
│ [Never heard][Not recent]│
│                          │
│ PREFERENCES              │
│ ⚖ Weighted        [tog] │
│ 🚫 No Remixes     [tog] │
│ 🕐 Not Recently Q [tog] │
├──────────────────────────┤
│ [Save as Preset]         │  ← ghost button, only if filters active
│ [Apply Filters →]        │  ← --accent green, full width
└──────────────────────────┘
```

Active filter count shown as badge on `⚙` button in preset row.  
Tap overlay or `[×]` to close without saving.

---

## Radius & Spacing

- Card radius: 16px
- Button radius: 12px  
- Badge/chip radius: 6–20px (badges small, presets pill)
- Page padding: 20px horizontal
- Component gap: 12–16px
- Section gap: 20–24px

---

## What's NOT in scope (this spec)

- Library, Stats, Listen Later tabs — same token system, separate spec
- Badge data from stats (placeholder structure ready, data TBD)
- Light theme implementation (token-swap, no layout changes needed)
- Artist Deep Dive modal
- Stitch MCP integration

---

## Implementation Notes

- Tailwind v4: define tokens as CSS custom properties in `index.css`
- Swipe: pointer events (no library), existing `SwipeableAlbumRow` can be adapted
- Filter Sheet: new `FilterSheet.jsx` component, controlled by `DiscoverTab`
- Preset storage: `localStorage` key `discover_presets` (already exists)
- Active filter count: derived from filter state, passed as badge prop to preset row
