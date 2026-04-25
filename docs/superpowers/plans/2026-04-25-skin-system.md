# Skin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OLED / Solar / Daylight skin support with a radio-list picker in Settings > Appearance.

**Architecture:** All skin tokens live as CSS variable overrides under `[data-skin="id"]` on `<html>`. A `useSkin` hook reads/writes `localStorage` and applies the attribute. `SettingsModal` gets a new "Appearance" accordion section (first, above Data Sync) with a radio list.

**Tech Stack:** React (Vite), Tailwind CSS v4 (`@theme` + CSS custom properties), `motion/react` v12, localStorage.

**Spec:** `docs/superpowers/specs/2026-04-25-skin-system-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/skins.css` | CSS variable overrides for Solar and Daylight skins |
| Create | `src/hooks/useSkin.js` | Read/write `localStorage`, apply `data-skin` to `<html>`, export `SKINS` array |
| Modify | `src/index.css` lines 42–47 | Import `skins.css`; replace hardcoded `background: #0a0a0a` with `var(--color-page)`; move `color-scheme` to `html` only |
| Modify | `src/App.jsx` lines 1–10, 89–101, 264–288 | Import `useSkin`, wire `skin`/`onSkinChange` props into `Header` |
| Modify | `src/components/layout/Header.jsx` lines 137–156, 197–198 | Add `skin`/`onSkinChange` props to `SettingsModal` + `Header`; add Appearance accordion section |

---

## Task 1: Create `src/skins.css`

**Files:**
- Create: `src/skins.css`

- [ ] **Step 1: Create the file**

```css
/* src/skins.css */

[data-skin="solar"] {
  --color-page:          #111827;
  --color-card:          #1f2937;
  --color-card-raised:   #374151;
  --color-border-subtle: #4b5563;
  --color-ink:           #f9fafb;
  --color-ink-secondary: #9ca3af;
  --color-ink-muted:     #6b7280;
}

[data-skin="daylight"] {
  color-scheme: light;
  --color-page:          #f8fafc;
  --color-card:          #ffffff;
  --color-card-raised:   #f1f5f9;
  --color-border-subtle: #e2e8f0;
  --color-ink:           #0f172a;
  --color-ink-secondary: #475569;
  --color-ink-muted:     #94a3b8;
  --color-accent:        #16a34a;
  --color-accent-dim:    rgba(22,163,74,0.12);
  --color-accent-text:   #16a34a;
  --color-badge-listen-bg: rgba(22,163,74,0.12);
  --color-badge-listen:    #16a34a;
  --color-chip-active:   #16a34a;
  --color-chip-inactive: #e2e8f0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/skins.css
git commit -m "feat: add Solar and Daylight skin CSS variable blocks"
```

---

## Task 2: Create `src/hooks/useSkin.js`

**Files:**
- Create: `src/hooks/useSkin.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useSkin.js
import { useState, useEffect } from 'react'

export const SKINS = [
  { id: 'oled',     label: 'OLED',     description: 'Pure black, battery saving' },
  { id: 'solar',    label: 'Solar',    description: 'Dark grey, outdoor readable' },
  { id: 'daylight', label: 'Daylight', description: 'Light, maximum visibility' },
]

const STORAGE_KEY = 'sonar_skin'
const DEFAULT_SKIN = 'oled'

function applyDataSkin(id) {
  if (id === DEFAULT_SKIN) {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', id)
  }
}

export function useSkin() {
  const [skin, setSkinState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SKINS.find(s => s.id === stored) ? stored : DEFAULT_SKIN
  })

  useEffect(() => {
    applyDataSkin(skin)
  }, [skin])

  function setSkin(id) {
    localStorage.setItem(STORAGE_KEY, id)
    setSkinState(id)
  }

  return [skin, setSkin]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSkin.js
git commit -m "feat: add useSkin hook with localStorage persistence"
```

---

## Task 3: Update `src/index.css`

**Files:**
- Modify: `src/index.css` lines 42–47

Current block (lines 42–47):
```css
html, body, #root {
  height: 100%;
  overscroll-behavior: none;
  background: #0a0a0a;
  color-scheme: dark;
}
```

- [ ] **Step 1: Replace the html/body/#root block**

Replace the block above with:
```css
html {
  color-scheme: dark;
}

html, body, #root {
  height: 100%;
  overscroll-behavior: none;
  background: var(--color-page);
}
```

- [ ] **Step 2: Add skins import after the tailwindcss import (line 1)**

Change:
```css
@import "tailwindcss";
```

To:
```css
@import "tailwindcss";
@import "./skins.css";
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: wire color-page variable into html background, import skins.css"
```

---

## Task 4: Wire `useSkin` in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import useSkin at the top of the file**

After the existing hook imports (around line 6), add:
```js
import { useSkin } from './hooks/useSkin.js'
```

- [ ] **Step 2: Call the hook inside `MainApp`**

After the existing `useState` calls inside `MainApp` (around line 94), add:
```js
const [skin, setSkin] = useSkin()
```

- [ ] **Step 3: Pass skin props to `Header`**

In the `<Header ... />` JSX block (around line 264), add two new props:
```jsx
skin={skin}
onSkinChange={setSkin}
```

The full `<Header>` call will look like:
```jsx
<Header
  onLogout={onLogout}
  albumCount={albums.length}
  lastfmMeta={lastfmMeta}
  onRefresh={handleRefresh}
  onRefreshLastfm={refreshLastfm}
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
  hideLibraryAlbums={hideLibraryAlbums}
  onUpdateHideLibraryAlbums={updateHideLibraryAlbums}
  onExportLibrary={handleExportLibrary}
  skin={skin}
  onSkinChange={setSkin}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire useSkin into App, pass skin props to Header"
```

---

## Task 5: Add Appearance section to `Header.jsx`

**Files:**
- Modify: `src/components/layout/Header.jsx`

- [ ] **Step 1: Import `SKINS` at the top of the file**

After the existing imports (line 3), add:
```js
import { SKINS } from '../../hooks/useSkin.js'
```

- [ ] **Step 2: Add `skin` and `onSkinChange` to `SettingsModal` props destructure**

Current `SettingsModal` signature (line 137):
```js
function SettingsModal({
  isOpen,
  onClose,
  albumCount,
  ...
  onExportLibrary,
}) {
```

Add `skin` and `onSkinChange` to the destructure:
```js
function SettingsModal({
  isOpen,
  onClose,
  albumCount,
  lastfmMeta,
  onRefresh,
  onRefreshLastfm,
  carouselSettings,
  onUpdateCarouselSettings,
  onUpdateCarouselOrder,
  playlists,
  playlistsLoading,
  playlistsError,
  selectedPlaylists,
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
  hideLibraryAlbums,
  onUpdateHideLibraryAlbums,
  onExportLibrary,
  skin,
  onSkinChange,
}) {
```

- [ ] **Step 3: Add the Appearance accordion section**

Inside `SettingsModal`, in the scrollable content `<div className="flex-1 overflow-y-auto p-6 space-y-2">` (line 197), insert this block **before** the existing sync section `{/* Sync section */}`:

```jsx
{/* Appearance section */}
<div>
  <button
    onClick={() => toggle('appearance')}
    className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
  >
    <span>Appearance</span>
    <span className="text-ink-muted">{expandedSection === 'appearance' ? '▲' : '▼'}</span>
  </button>
  <AnimatePresence>
    {expandedSection === 'appearance' && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="pb-4 space-y-2">
          {SKINS.map(s => (
            <button
              key={s.id}
              onClick={() => onSkinChange(s.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left',
                skin === s.id
                  ? 'bg-accent-dim border-accent'
                  : 'bg-card-raised border-border-subtle'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex-shrink-0',
                skin === s.id ? 'border-accent bg-accent' : 'border-ink-muted'
              )} />
              <div>
                <p className={cn('text-sm font-bold', skin === s.id ? 'text-accent' : 'text-ink')}>
                  {s.label}
                </p>
                <p className="text-xs text-ink-muted">{s.description}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

- [ ] **Step 4: Add `skin` and `onSkinChange` to the `Header` function's prop destructure**

Current `Header` signature (line 481):
```js
export default function Header({
  onLogout,
  albumCount,
  ...
  onExportLibrary,
}) {
```

Add `skin` and `onSkinChange`:
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
  playlists,
  playlistsLoading,
  playlistsError,
  selectedPlaylists,
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
  onRefreshLastfm,
  hideLibraryAlbums,
  onUpdateHideLibraryAlbums,
  onExportLibrary,
  skin,
  onSkinChange,
}) {
```

- [ ] **Step 5: Pass `skin` and `onSkinChange` to `<SettingsModal>`**

In the `return` of `Header`, add the two new props to `<SettingsModal>`:
```jsx
<SettingsModal
  isOpen={isSettingsOpen}
  onClose={onSettingsClose}
  albumCount={albumCount}
  lastfmMeta={lastfmMeta}
  onRefresh={onRefresh}
  onRefreshLastfm={onRefreshLastfm}
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
  onExportLibrary={onExportLibrary}
  skin={skin}
  onSkinChange={onSkinChange}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Header.jsx
git commit -m "feat: add Appearance skin picker to SettingsModal"
```

---

## Task 6: Browser Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app and test OLED (default)**

- Open Settings → Appearance → verify OLED is selected with accent border
- Background should be `#0a0a0a`, cards `#141414`

- [ ] **Step 3: Switch to Solar**

- Tap Solar → verify instant change to dark-grey background (`#111827`)
- Accent stays Spotify green
- Close and reopen Settings → Solar still selected
- Reload page → Solar persists (localStorage)

- [ ] **Step 4: Switch to Daylight**

- Tap Daylight → verify light background (`#f8fafc`), dark text, green accent is darker (`#16a34a`)
- Check that native scrollbars and inputs look correct (should render in light mode)
- Reload page → Daylight persists

- [ ] **Step 5: Switch back to OLED**

- Tap OLED → verify `data-skin` attribute is removed from `<html>` (check DevTools)
- Background returns to `#0a0a0a`

- [ ] **Step 6: Final commit (if any fixups were made)**

```bash
git add -p
git commit -m "fix: skin system browser fixups"
```
