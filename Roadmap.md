# Roadmap — Album Discovery React App

## ✅ Fertig

- **Core App** — 4 Tabs (Discover, Library, Stats, Listen Later), AlbumModal, IndexedDB Cache, PWA, gh-pages Deploy
- **Discover: Presets & Toggles** — Surprise Me / Forgotten Gems / Deep Cuts, Custom Presets, Weighted Pick, No Remixes, Not Recently Queued
- **Discover: Filter** — Jahrzehnte, Genre-Cluster (mit Drill-Down), Never Heard, Not Recently Played, Not Yet Finished
- **Discover: Multi-Pick** — Selektor [1][3][5][10], Swipe Left = Queue, Swipe Right = Skip, Batch Queue/Save
- **Burn Tracking** — Burn bei Queue/Save, Reset pro Carousel, Badge, Per-Carousel-Metriken in StatsTab
- **Carousel Empty-State** — Styled Card mit 🔥 + inline Reset-CTA wenn alle Alben geburnt
- **Parser v2.0** — Per-Album: `uniqueListeningDays`, `sessionDates[]`, `avgGapDays`, `releaseYear`, `albumAgeAtFirstListen`. Per-Artist: `coveragePercent`, `topAlbums[]`, `mostRediscoveredAlbum`
- **8 neue StatsTab-Carousels** — ⏰ Überfällig, 📅 Peak Nostalgie, 📦 Lange Wartend, 🎯 Artist-Lücken, 💔 Frühere Liebe, 🎸 Genre Deep Dive, 🚪 Gateway — alle über Settings togglebar
- **Listening Streaks** — Stats-Karte mit Aktuell/Längste/Gesamt Streak

---

## 📋 Geplant

- **"Zuletzt durchgehört" Carousel** (StatsTab)
  - Die 20 zuletzt vollständig durchgehörten Alben, chronologisch nach letzter Session
  - ⚠ Benötigt Parser-Fix: Jeder vollständige Album-Loop soll als eigene Listen zählen, auch ohne 20-Min-Gap

- **"Pick for Me"-Modus** (DiscoverTab)
  - Automatische Preset-Auswahl basierend auf Tageszeit / Wochentag
  - Beispiel: Montag morgens → Deep Cuts, Freitag abends → Surprise Me

---

## 🗑 Gestrichen

- V2 Redesign Branch — eingefroren
- Burn Mode als separater Modus — ersetzt durch Standardverhalten
- Lens / Album Grid
- Auto Last.fm API Sync
- Artist Deep Dive Sheet — revertiert
- Tab-Animationen — revertiert
