# Spec: Neue Carousels + Listening Streaks

**Datum:** 2026-06-07  
**Status:** Approved

## Übersicht

8 neue Features in StatsTab: 5 datenbasierte Carousels, 3 Recommendation-Carousels und 1 Streaks-Karte. Alle togglebar in den Settings wie bestehende Carousels. Kein Parser-Change, kein Backend.

---

## Features

### 1. ⏰ Überfällig (`overdue`)

**Quelle:** `enriched` (lastfm + spotify matched)  
**Filter:** `avgGapDays !== null && listenCount > 0 && (now - lastHeard) > avgGapDays × 1.5 × 86400000`  
**Sort:** Overdue-Ratio `(now - lastHeard) / (avgGapDays × 86400000)` absteigend  
**Stat:** `Alle ${round(avgGapDays)}d — seit ${round((now-lastHeard)/86400000)}d`  
**Limit:** 20

---

### 2. 📅 Peak Nostalgie (`peak-nostalgie`)

**Quelle:** `enriched`  
**Filter:** Monatsteil von `peakMonth` (Format: `"2022-06"`) === aktueller Kalendermonat  
**Sort:** `listenCount` absteigend  
**Stat:** `Peak ${peakYear}` (z.B. `Peak 2022`)  
**Limit:** 20

---

### 3. 🎯 Artist-Lücken (`artist-gaps`)

**Quelle:** `albums` (Spotify Library) + `enriched`  
**Logik:**
1. Aus `enriched`: Sammle alle Künstlernamen wo mind. 1 Album `listenCount >= 3` → `lovedArtists` Set
2. Aus `albums`: Finde alle Library-Alben deren `artists[0].name` in `lovedArtists` ist
3. Schlage ihr lastfm-Gegenstück nach (via `spotifyLookup` rückwärts oder direkter lastfmMap-Lookup)
4. Zeige nur Alben mit `listenCount === 0` (oder kein lastfm-Eintrag)

**Stat:** `${artist} • Noch nicht gehört`  
**Sort:** Artist-Name alphabetisch (gruppiert nach Künstler)  
**Limit:** 20

---

### 4. 📦 Lange Wartend (`long-waiting`)

**Quelle:** `albums` (Spotify Library direkt)  
**Logik:**
1. Für jedes Library-Album: lookup in `lastfmMap` via normalisierten Key
2. Wenn kein Eintrag ODER `listenCount === 0` → einschließen
3. Nur Alben mit `_added_at` (für Datums-Stat)

**Sort:** `_added_at` aufsteigend (älteste zuerst)  
**Stat:** `Seit ${days}d in Library`  
**Limit:** 20

---

### 5. 💔 Frühere Liebe (`former-love`)

**Quelle:** `enriched`  
**Filter:** `listenCount >= 5 && trend === 'falling' && (now - lastHeard) > 180 × 86400000`  
**Sort:** `listenCount` absteigend  
**Stat:** `${listenCount}× — vor ${round((now-lastHeard)/86400000/30)}M`  
**Limit:** 20

---

### 6. 🎸 Genre Deep Dive (`genre-dive`)

**Quelle:** `enriched` (für recent plays) + `albums` (für ungehörte)  
**Logik:**
1. Importiere `clusterOf` aus `../../data/genre-clusters.js`
2. Sammle alle `sessionDates` der letzten 30 Tage aus `enriched`, gruppiert nach `clusterOf(artist, name)`
3. Top-Genre = Cluster mit meisten Sessions in 30-Tage-Fenster
4. Finde Library-Alben (`albums`) im Top-Genre mit `listenCount === 0` (oder nicht in lastfmMap)
5. Fallback: wenn kein Top-Genre ermittelbar → Carousel leer / nicht anzeigen

**Sort:** `_added_at` absteigend (neueste Library-Zugänge zuerst)  
**Stat:** `Weil du ${topCluster} liebst`  
**Limit:** 20

---

### 7. 🚪 Gateway-Logik (`gateway`)

**Quelle:** `enriched` (für recent discoveries) + `albums` (für ungehörte)  
**Logik:**
1. Recent discoveries: `enriched` wo `firstHeard > now - 90 × 86400000`
2. Sammle deren Genre-Cluster via `clusterOf(artist, name)` → `discoveryGenres` Set
3. Finde Library-Alben im selben Genre-Cluster mit `listenCount === 0`
4. Ausschluss: bereits in Genre-Deep-Dive gezeigt (kein striktes Deduplizieren nötig — Genres überlappen selten exakt)

**Sort:** Zufällig geseedet (wie Album of the Day — täglicher Hash), damit sich die Liste täglich leicht ändert  
**Stat:** `Frisch entdecktes Genre`  
**Limit:** 20

---

### 8. 🔥 Listening Streaks (`streaks`) — Karte, kein Carousel

**Quelle:** Alle `sessionDates` aus `lastfmMap` (nicht nur `enriched`)  
**Berechnung:**
1. Union aller `sessionDates` aller Alben → Set von Datums-Strings (`"YYYY-MM-DD"`)
2. **Aktueller Streak:** Rückwärts von heute zählen solange Tag im Set; wenn heute fehlt, von gestern starten
3. **Längster Streak:** Sortierte Tage → max. consecutive run
4. **Gesamt-Tage:** `listeningDays.size`

**Render:** Kompakte 3-Spalten-Karte (kein Scroll), kein Burn-Button, kein Reset:
```
🔥 Listening Streaks
[Aktuell: 4T] [Längste: 23T] [Gesamt: 847T]
Progress-Bar: aktueller Streak / längster Streak
```

**Verhalten bei leerem Streak:** Karte zeigt "Kein aktiver Streak" mit letztem Hörtag.

---

## Settings-Integration

### `Header.jsx` — CAROUSEL_LABELS

```js
'overdue':        '⏰ Überfällig',
'peak-nostalgie': '📅 Peak Nostalgie',
'artist-gaps':    '🎯 Artist-Lücken',
'long-waiting':   '📦 Lange Wartend',
'former-love':    '💔 Frühere Liebe',
'genre-dive':     '🎸 Genre Deep Dive',
'gateway':        '🚪 Gateway',
'streaks':        '🔥 Listening Streaks',
```

Für `streaks`: Sort-Dropdown wird übersprungen (kein `sort`-Feld, Karte hat keine sortierbare Liste). In der Settings-UI: nur On/Off-Toggle, kein Sort-Dropdown. Implementierung: `if (id === 'streaks') skip sort UI`.

### `App.jsx` — defaultCarouselSettings

- `_order`: 8 neue IDs ans Ende der bestehenden Liste
- Je `{ visible: true, sort: 'original' }` außer `streaks`: `{ visible: true }`
- Initial alle `visible: true` (opt-out statt opt-in)

### `StatsTab.jsx` — DEFAULT_CAROUSEL_ORDER

Gleiche 8 IDs ans Ende von `DEFAULT_CAROUSEL_ORDER`.

---

## Dateien die sich ändern

| Datei | Änderung |
|---|---|
| `src/components/layout/Header.jsx` | `CAROUSEL_LABELS` + streaks Sort-Ausnahme |
| `src/App.jsx` | `defaultCarouselSettings()` |
| `src/components/stats/StatsTab.jsx` | 8 neue `useMemo`s + `blocks` Einträge + `clusterOf` Import |

Keine neuen Dateien. Kein Parser-Change. Kein neuer Hook.

---

## Daten-Lookup für Artist-Lücken und Lange Wartend

Beide Carousels brauchen den Abgleich Spotify-Album → lastfm-Eintrag in die andere Richtung (Spotify als Quelle, nicht lastfm). Implementierung via bestehenden `spotifyLookup` rückwärts funktioniert nicht direkt. Stattdessen: baue `lastfmByKey` Map aus `lastfmMap`:

```js
const lastfmByKey = useMemo(() => {
  const m = new Map()
  for (const [key, entry] of lastfmMap.entries()) {
    m.set(key, entry)
  }
  return m
}, [lastfmMap])
```

Lookup für ein Spotify-Album:
```js
const key = `${artist}||${albumName}`.toLowerCase()
const entry = lastfmByKey.get(key) ?? lastfmByKey.get(normalizeAlbumKey(artist, albumName))
const listenCount = entry?.listenCount ?? 0
```
