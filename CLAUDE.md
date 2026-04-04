# CLAUDE.md — Album Discovery React Rebuild

## Was dieses Projekt ist
Ein persönliches Music-Discovery-Tool. React-Rebuild der bestehenden monolithischen index.html.
- Spotify liefert die Album-Bibliothek und Playback
- Last.fm liefert 8 Jahre Listening History (76.540 Scrobbles, 2018-2026)
- Kein Backend, kein Server — rein clientseitig, gehostet auf GitHub Pages

## Architektur-Referenz
Die ARCHITECTURE.md ist das zentrale Planungsdokument. Lies sie IMMER zuerst, bevor du Entscheidungen triffst.

## Tech Stack
- React (Vite) + Tailwind CSS
- IndexedDB via idb für lokale Daten
- Spotify PKCE OAuth (Client ID: ed48e32b12fd4b01ad0dbdf383cb3ff6)
- Kein Redux, kein Backend, keine Datenbank

## Projektstruktur
- /parser — Node.js-Script, läuft lokal, NIE im Browser
- /src — React-App
- /public/lastfm-data.json — Parser-Output, wird von der App geladen
- /index.html (root) — alte monolithische App, nur als Referenz

## Spotify API (Feb 2026 Changes beachten!)
- GET /albums (batch) wurde ENTFERNT — nur GET /albums/{id} einzeln
- GET /artists (batch) wurde ENTFERNT — nur GET /artists/{id} einzeln  
- Playlist: /tracks wurde umbenannt zu /items
- Siehe Spotify_API_Changes.md für Details

## Parser
- Bereits fertig gebaut in /parser
- Liest 4 Last.fm CSVs, fetcht Track Counts, berechnet Sessions
- Output: lastfm-data.json

## Session-Algorithmus Entscheidungen
- Session-Gap: 20 Minuten
- Listen-Threshold: 50% unique Track Coverage
- Loop-Counting: Jeder Loop zählt als eigener Listen (3x geloopt = 3 Listens)
- Background-Sessions (avg gap >15min): Gewicht 0, separat gespeichert

## Build & Run
npm install && npm run dev  (React App)
cd parser && npm install && node index.js  (Parser)
