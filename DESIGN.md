# Design System: Album Discovery App

## 1. Visual Theme & Atmosphere

A cover-first music discovery interface. Album artwork glows out of deep OLED black — generous negative space, nothing competing with the music. The mood is focused and cinematic, like scrolling through a premium streaming app at night. Density is low (4/10): each screen breathes. Motion is fluid but purposeful (6/10): spring physics, no theatrical animations. Variance is moderate (6/10): slight asymmetry in layout, structured enough for a data-heavy app.

Primary: dark theme. Light theme uses the same token names with swapped values — no layout changes needed.

## 2. Color Palette & Roles

**Dark Theme (primary):**
- **Deep Void** (`#0a0a0a`) — App background, OLED-optimized
- **Surface Dark** (`#141414`) — Card and container fill
- **Surface Raised** (`#1e1e1e`) — Hover states, active chips, pressed states
- **Ink Primary** (`#f0f0f0`) — Main text, album titles, headings
- **Ink Secondary** (`#8a8a8a`) — Artist names, labels, metadata, subtitles
- **Ink Muted** (`#4a4a4a`) — Disabled states, hints, placeholder text
- **Accent Green** (`#1ed760`) — Single accent: Queue action, active presets, focus rings (Spotify DNA)
- **Border Subtle** (`#2a2a2a`) — Card borders, section dividers, 1px structural lines

**On-cover badge colors (always with backdrop-filter blur):**
- Listens: `rgba(30,215,96,0.2)` background, `#1ed760` text — green glow, readable on any cover
- Year: `rgba(255,255,255,0.12)` background, `#f0f0f0` text — neutral, unobtrusive
- Genre tag: `rgba(138,138,255,0.15)` background, `#a0a0ff` text — cool blue-violet

**Light Theme (planned, same token names):**
- Deep Void → `#fafafa`, Surface Dark → `#ffffff`, Surface Raised → `#f5f5f5`
- Ink Primary → `#1a1a1a`, Ink Secondary → `#888888`, Ink Muted → `#aaaaaa`
- Accent Green unchanged, Border Subtle → `#f0f0f0`

## 3. Typography Rules

- **Display (headers):** System stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`. 28px / weight 700 / letter-spacing -0.5px. Hierarchy through weight and color, not enormous size.
- **Section labels:** 11px / weight 600 / uppercase / letter-spacing 0.08em / Ink Secondary. Used sparingly.
- **Album titles:** 16px / weight 700 (single-pick), 13px / weight 600 (multi-pick row)
- **Artist / metadata:** 13px / weight 400 / Ink Secondary
- **Buttons:** 15px / weight 700 (primary), 600 (secondary)
- **Badges:** 11px / weight 600 / monospace numbers preferred
- **Body / descriptions:** 13–14px / relaxed leading / max 60 characters per line
- **Banned:** `Inter` for premium contexts. Pure black (`#000000`) anywhere. Generic serif fonts.

## 4. Component Stylings

- **Album Cards:** Surface Dark background. 16px radius. 1px Border Subtle edge. Cover fills full card width at 1:1 aspect ratio. Metadata (title, artist, tags) below cover with 14px padding. On-cover badges use blur backdrop — never opaque overlays. Shadow: `0 8px 24px rgba(0,0,0,0.4)`.
- **Preset Chips:** Pill shape (20px radius). Active state: Surface Raised bg, Ink Primary text, Ink Muted border. Inactive: Surface Dark bg, Ink Primary text, Border Subtle border. No neon glows.
- **Count Selector Chips:** 36×36px circles. Active: Surface Raised bg. Inactive: Surface Dark bg, Ink Secondary text.
- **Primary Button (Queue):** Accent Green background, `#000000` text, 12px radius, full width, 14px vertical padding. Tactile -1px translate on active press. No outer glow.
- **Secondary Button (Save):** Transparent background, Ink Primary text, 1px Border Subtle border. Same radius and padding as primary.
- **Filter Sheet:** Slides up from bottom (spring, 0.3s). Overlay: `rgba(0,0,0,0.7)` with `backdrop-filter: blur(4px)`. Sheet background: Surface Dark. Section headers: 11px uppercase Ink Secondary. Filter chips: same style as preset chips. Toggle switches: native-style, accent green when active.
- **Swipe Hints:** Positioned at cover bottom. `blur(8px)` backdrop. Left = "← Skip" (Ink Secondary tinted), Right = "Queue →" (Accent Green tinted). Subtle, not distracting.
- **Badges on Covers:** Always `backdrop-filter: blur(8px)`. Top-left corner. Gap between badges: 6px. Never block artist face or key artwork.
- **Bottom Tab Bar:** `rgba(10,10,10,0.92)` background + `backdrop-filter: blur(20px)`. 1px Border Subtle top edge. Active tab icon tinted Accent Green.
- **Loading States:** Skeletal shimmer matching exact card dimensions. No circular spinners. Shimmer color: Surface Raised → Surface Dark → Surface Raised.
- **Empty States:** Descriptive illustration or icon + short sentence. Never just "No data".

## 5. Layout Principles

Mobile-first, single-column. Maximum content width: 100% (this is a phone app). Horizontal padding: 20px page-level. Component gaps: 12–16px. Section gaps: 20–24px vertical. Card radius: 16px. Button radius: 12px.

Horizontal scroll rows (presets, multi-pick): `overflow-x: auto`, `scrollbar-width: none`. Peek effect for off-screen content: third card visible at ~30% width.

No overlapping elements. Every element occupies its own clear spatial zone. No absolute-positioned content stacking over other content (exception: on-cover badges and swipe hints are explicitly decorative overlays on the cover image only).

Tab bar is always sticky at bottom. Content scrolls behind it. Bottom padding on scroll content accounts for tab bar height + safe area inset.

## 6. Motion & Interaction

Spring physics for all interactive elements: `stiffness: 100, damping: 20`. Weighted, premium feel — not bouncy.

- **Card swipe:** Pointer-event driven (no library). Follow finger during drag, snap back or fly out on release. Left = skip (flies left + fade), right = queue (flies right + green flash).
- **New album load:** Card fades in from slight scale (0.96 → 1.0) over 200ms.
- **Filter sheet:** Slides up with spring, overlay fades in simultaneously.
- **Preset chip tap:** Instant state switch + subtle scale pulse (1.0 → 0.97 → 1.0, 120ms).
- **Button press:** -1px translate on active, no scale change.
- **Tab switch:** Content fades (opacity 0 → 1, 150ms). No slide animations between tabs.

Animate exclusively via `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`.

## 7. Anti-Patterns (Banned)

- No pure black `#000000` anywhere (use Deep Void `#0a0a0a`)
- No neon outer glows on buttons or badges
- No oversaturated accents (single Accent Green only, no additional neon colors)
- No gradient text on headers
- No 3-column equal card grid layouts
- No custom mouse cursors
- No overlapping text elements
- No `Inter` font in premium UI contexts
- No generic serif fonts (`Times New Roman`, `Georgia`, `Garamond`)
- No circular loading spinners — skeletal loaders only
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen")
- No filler UI text ("Scroll to explore", scroll arrows, bouncing chevrons)
- No emojis in UI text (emoji in preset chips are user-facing labels, exception allowed)
- No fake round numbers in stats display
- No broken image links — all album covers come from Spotify CDN (already in library data)
