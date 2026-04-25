# Skin System Design

**Date:** 2026-04-25
**Branch:** ui-cleanup
**Status:** Approved

## Overview

Add a multi-skin system to SONAR. The current OLED skin stays unchanged as default. Two new skins (Solar, Daylight) are added for outdoor readability. A skin picker in Settings lets the user switch instantly. The architecture is designed for easy future skin additions via collaborative design sessions.

## Skins

| ID | Name | Description |
|----|------|-------------|
| `oled` | OLED | Current skin. Pure black (#0a0a0a), default. |
| `solar` | Solar | Dark grey (#111827). Retains dark feel, better outdoor contrast. Spotify green accent unchanged. |
| `daylight` | Daylight | Light (#f8fafc). Maximum outdoor readability. Accent shifts to #16a34a (darker green for white backgrounds). |

## Architecture

### CSS (`src/skins.css`)

New file, imported in `src/index.css`. OLED default stays in `@theme {}` — untouched. Each non-default skin is a `[data-skin="id"]` block that overrides only the variables it changes.

```css
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

Additionally, `index.css` currently hardcodes `background: #0a0a0a` and `color-scheme: dark` on `html, body, #root`. These must be replaced with CSS-variable-driven values so Daylight renders correctly (native scrollbars, inputs, selection color). The fix: move `background` to `var(--color-page)` and toggle `color-scheme` via a `[data-skin="daylight"]` override (`color-scheme: light`).

Adding a future skin = one new `[data-skin="name"] { ... }` block in this file. No other files need to change except registering the skin in the hook's `SKINS` array.

### Hook (`src/hooks/useSkin.js`)

Reads `localStorage` key `sonar_skin` on mount, applies `document.documentElement.setAttribute('data-skin', skin)`, and returns `[skin, setSkin]`. `setSkin` writes to localStorage and updates the attribute.

```js
const SKINS = [
  { id: 'oled',     label: 'OLED',     description: 'Pure black, battery saving' },
  { id: 'solar',    label: 'Solar',    description: 'Dark grey, outdoor readable' },
  { id: 'daylight', label: 'Daylight', description: 'Light, maximum visibility' },
]
```

Default: `'oled'`. No context provider needed — the hook is used only in `App.jsx`.

### App.jsx

Imports `useSkin`, passes `skin` and `setSkin` as props to `Header`.

### Header.jsx / SettingsModal

New "Appearance" accordion section — first section (above Data Synchronization). Contains a radio list: each skin as a row with name + description. Active skin has accent border. Selection takes effect immediately (no save button). Props: `skin`, `onSkinChange`.

## Persistence

`localStorage` key `sonar_skin`. No backend, no sync across devices.

## Future Skin Workflow

New skins are always designed collaboratively (AI Studio / Stitch as inspiration → discuss → implement as CSS block). No import mechanism in the app.

## Out of Scope

- Per-component skin overrides
- User-created/custom skins
- Skin import/export UI
- System dark/light mode auto-switching
