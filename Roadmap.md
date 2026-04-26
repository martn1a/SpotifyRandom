# Roadmap — Album Discovery React App

## Phase 1 Core Tabs ✅ DONE
## Phase 2 Discover Tab ✅ DONE
## Phase 3 Redesign ✅ ABGEBROCHEN — Features zuerst

---

## Phase 4 — Aktiv (V1 Feature-Complete)

- [x] **Burn Tracking** ✅ 2026-04-06
  - Queue / Save for Later entfernt Album aus Carousel (Standardverhalten, kein Modus)
  - Burn-Event in IndexedDB (`burn_events` + `burn_resets`, DB v2)
  - Reset pro Carousel (Sichtbarkeit zurück, Historie bleibt)
  - Burned Count Badge neben Reset-Button
  - Per-Carousel Metriken: Completion-Bar (2px), lastBurnedAt (relativ, "2h ago"), resetCount (↺ Nx)
  - burnStats erweitert: `perCarousel` Map + `resetCounts` aus IndexedDB
  - Burn-Sektion in StatsTab: per-Carousel-Tabelle mit Mini-Progressbar + Count + Resets

- [x] **Multi-Pick Album Selector** ✅ 2026-04-06
  - Discover Tab: Count-Selektor [1][3][5][10] über Pick-Button
  - Default 1 = bisheriges Verhalten (FeaturedAlbumCard) unverändert
  - Multi-Pick: SwipeableAlbumRow mit Pointer-Events (kein externe Library)
  - Swipe Left (>80px) = Queue + aus Liste entfernen
  - Swipe Right (>80px) = Skip (nur entfernen)
  - Tap = AlbumModal (Queue/Save entfernt Album aus Pick-Liste)
  - Batch: "Queue All" / "Save All"
  - Weighted Pick funktioniert mit Multi-Pick (sampling without replacement)

- [ ] **Empty-State bei geleerten Carousels**
  - Feedback wenn alle Alben eines Carousels geburnt wurden
  - Ggf. "Reset"-CTA direkt im leeren Carousel

---

## Phase 5 — Parser-Erweiterung ✅ TIER 1 DONE 2026-04-06

### TIER 1 ✅ Done (Parser v2.0.0)
**Per Album (neu):** `uniqueListeningDays`, `peakYear`, `listeningSpanDays`, `sessionDates[]`, `avgGapDays`, `releaseYear`, `albumAgeAtFirstListen`  
**Per Artist (neu):** `albumCount`, `heardAlbumCount`, `coveragePercent`, `topAlbums[]`, `mostRecentAlbum`, `mostRediscoveredAlbum`

- [x] **Unique listening days** pro Album — `uniqueListeningDays`
- [x] **Top albums pro Artist** — `topAlbums[{key, name, listenCount, firstHeard, lastHeard}]` (top 5)
- [x] **Album coverage % pro Artist** — `coveragePercent` (heardAlbumCount / albumCount)
- [x] **Most rediscovered album** pro Artist — `{key, name, gapVarianceDays, sessionCount}`
- [x] **Session dates** pro Album — `sessionDates[]` + `avgGapDays`
- [x] **Release year** — `releaseYear` (Last.fm fetch, gecacht). Befüllen: `node index.js --fill-release-years`
- [x] **Album age at first listen** — `albumAgeAtFirstListen` (nach --fill-release-years)

### TIER 2 (Backlog)
- Total listening time pro Album (requires Spotify track duration — kein CSV-Feld)
- Listening streaks

### TIER 3 (Backlog)
- Session-chain patterns
- Listening streaks
- Behavior models

---

## Backlog (kein aktiver Plan)

- **"Zuletzt durchgehört" Carousel** (StatsTab)
  - Die 20 zuletzt vollständig durchgehörten Alben, sortiert nach `sessionDates` (letztes Datum desc)
  - Abgrenzung zu "Most Played": Most Played = Häufigkeit, dieses Carousel = Chronologie der letzten vollständigen Sessions
  - **⚠ Loop-Counting überdenken (Parser):** Aktuell zählt ein Album-Loop innerhalb einer Session nur als 1 Listen, auch wenn das Album zweimal komplett durchlief. Gewünschtes Verhalten: Jeder vollständige Durchlauf (≥50% unique Coverage) = eigene Listen — auch wenn ohne 20-Min-Gap. Beispiel: Universal Beings 06.04.2026, 08:27–11:22 = sollte 2 Listens zählen, nicht 1.

- Playlist Import Carousels
- MusicBrainz Genre Enrichment
- Drei-Zustands-Dekaden-Filter
- Listening Streaks
- Seasonal Favorites Carousel

---

## Gestrichen

- V2 Redesign Branch (design-2) — eingefroren
- Burn Mode als separater Modus — ersetzt durch Standardverhalten
- Lens / Album Grid
- Auto Last.fm API Sync
