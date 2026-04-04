# CLAUDE.md — Album Discovery React App

## Was dieses Projekt ist

Ein persönliches Music-Discovery-Tool. React-Rebuild der bestehenden monolithischen old-index.html.

* Spotify liefert die Album-Bibliothek und Playback
* Last.fm liefert 8 Jahre Listening History (76.540 Scrobbles, 2018–2026)
* Kein Backend, kein Server — rein clientseitig, gehostet auf GitHub Pages

## Tech Stack

* React (Vite) + Tailwind CSS v4
* IndexedDB via idb für lokale Daten
* Spotify PKCE OAuth (Client ID: ed48e32b12fd4b01ad0dbdf383cb3ff6)
* Kein Redux, kein Backend, keine Datenbank

## Projektstruktur

```
/src
  /components
    /discover/DiscoverTab.jsx   — Picker mit Presets, Toggles, AlbumModal
    /library/LibraryTab.jsx     — Bibliothek, Suche, Filter, AlbumModal
    /stats/StatsTab.jsx         — Carousels, Charts, AlbumModal
    /listen-later/ListenLaterTab.jsx
    /layout/Header.jsx, TabBar.jsx
    AlbumModal.jsx              — Bottom-sheet, Queue + Save, Last.fm Stats
  /hooks
    useLibrary.js               — Spotify-Library, 24h IndexedDB-Cache
    useLastfm.js                — lädt lastfm-data.json, "artist||album" Map
    useListenLater.js           — IndexedDB listen_later store
  /data/genre-clusters.js       — GENRE_CLUSTERS + clusterOf()
  /lib/spotify-api.js, auth.js, db.js
/public/lastfm-data.json        — Parser-Output (NIE im Browser generiert)
/parser                         — Node.js-Script, läuft lokal
/.github/workflows/deploy.yml   — gh-pages Deploy bei push auf main
/old-index.html                 — Alte monolithische App, nur als Referenz
```

## Build & Run

```
npm install && npm run dev       # React App
cd parser && npm install && node index.js  # Parser (lokal)
```

## Spotify API (Feb 2026 Changes!)

* GET /albums (batch) ENTFERNT — nur GET /albums/{id} einzeln
* GET /artists (batch) ENTFERNT — nur GET /artists/{id} einzeln
* Playlist: /tracks umbenannt zu /items

## Was gebaut ist (aktueller Stand)

### Alle 4 Tabs vollständig implementiert

**Discover Tab**
- Album of the Day (seeded daily hash)
- Random Picker mit gefiltertem Pool
- Tap auf Card → AlbumModal
- Preset-Chips: 🎲 Surprise Me, 💎 Forgotten Gems, 🕰 Deep Cuts
- Custom Presets speichern/löschen (localStorage: `discover_presets`)
- Toggles: ⚖ Weighted (nie gehörte Alben 10×), 🚫 No Remixes (filtert: live/remix/edit/instrumental/reprise/version), 🕐 Not Recently Queued (30 Tage, localStorage: `discover_queue_history`)
- Filter-Chips: Jahrzehnte, Genre-Cluster, Never heard, Not recently played

**Library Tab**
- Suche, Sort (recently added/most played/year/name), Type-Filter, Genre-Cluster
- Tap → AlbumModal

**Stats Tab**
- Summary Metrics, 6 Carousels (Most Played, Latest Discoveries, Golden Oldies, Climbers, Fallers, On This Day)
- Carousels: nur Alben aus der Spotify-Bibliothek (kein Platzhalter-Cover)
- Tap auf Carousel-Item → AlbumModal
- Decade + Genre Bar Charts
- Spotify↔Last.fm Matching: exakter Key + normalizeAlbumKey() (stripes Klammerzusätze)

**Listen Later Tab**
- Sort, Clear All, Tap → AlbumModal, Queue + Remove Buttons

**AlbumModal (überall)**
- Bottom Sheet, Cover, Metadata, Queue to Spotify, Save for Later / Unsave
- Last.fm Stats Grid (listens, background, first/last heard, peak month, scrobbles)
- Full Track List

### Infrastructure
- 24h IndexedDB Album-Cache
- ErrorBoundary per Tab (key={activeTab})
- PWA manifest + Icons (public/icons/)
- pb-safe/pt-safe für iOS Notch
- gh-pages Deploy Workflow

## Session-Algorithmus (Parser)

* Session-Gap: 20 Minuten
* Listen-Threshold: 50% unique Track Coverage
* Loop-Counting: Jeder Loop = 1 Listen
* Background-Sessions (avg gap >15min): Gewicht 0, separat gespeichert

## Offene Backlog-Items (nächste Session)

Siehe Roadmap.md für vollständige Liste. Priorität:
1. Artist Deep Dive modal (tap Künstlername → alle Alben des Künstlers)
2. Library Coverage Bar in Stats (X / Y Albums heard, Z%)
3. Animationen (Tab-Übergänge, Card-Slides)

## Architektur-Entscheidungen

* AlbumModal lokal in jedem Tab (nicht in App.jsx) — vermeidet Prop-Drilling
* StatsTab Carousels filtern auf `spotifyAlbum !== null` — nur Library-Alben, nie Platzhalter
* Weighted Pick: listenCount=0 → 10×, lastHeard >90 Tage → 5×, recent → 1×
* Queue History in localStorage (`discover_queue_history`), nicht IndexedDB
* Custom Presets in localStorage (`discover_presets`)
* handleRefresh: db.delete('library','albums') + window.location.reload()
* normalizeAlbumKey() strippt (Remastered 2011)/[Deluxe] für besseres Matching
