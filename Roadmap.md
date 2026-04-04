# Roadmap — Album Discovery React App

## Phase 1 Core Tabs ✅ DONE

- [x] Parser (Last.fm CSV + API calls)
- [x] Auth + Spotify library sync
- [x] Library tab (search, filter, sort)
- [x] Stats tab (carousels, charts)
- [x] Listen Later tab

## Phase 2 Discover Tab ✅ DONE

- [x] FeaturedAlbumCard → tap opens AlbumModal
- [x] Random Picker UI (shuffle button)
- [x] Album of the Day (seeded daily hash)
- [x] Filter chips layout (decade, genre, never heard, not recent)
- [x] Queue album to Spotify
- [x] StatsTab carousels → tap opens AlbumModal (Queue + Save Later)
- [x] StatsTab album cover matching (normalized Spotify↔Last.fm lookup)
- [x] StatsTab carousels: library-only (no placeholder covers)
- [x] Weighted random toggle (prefer never-heard albums, 10× weight)
- [x] Keyword filter toggle (blocks: live, remix, edit, instrumental, reprise, version)
- [x] Avoid recently queued toggle (excludes albums queued in last 30 days)
- [x] Built-in presets (🎲 Surprise Me, 💎 Forgotten Gems, 🕰 Deep Cuts)
- [x] Save custom filter presets (localStorage, named, deletable)

## Phase 3 Polish & Deploy

- [ ] Animations (tab transitions, card slides)
- [x] PWA manifest + installable
- [x] Error boundary per-tab reset
- [x] GitHub Pages vite.config base path
- [x] gh-pages publish workflow

Time estimate remaining: 1–2 hours (animations only)

## Missing Features from old app (backlog)

- [ ] Artist Deep Dive modal (tap artist → all their albums in library)
- [ ] Library coverage bar (X / Y albums heard, Z%)
- [ ] Three-state decade filter (neutral / include / exclude)
- [ ] Listening streaks stat in StatsTab
- [ ] Seasonal favorites carousel

## Decided Decisions (Not Open)

- Session window 20 minutes ✅
- Listen threshold 50% unique tracks ✅
- Loop counting each full loop = 1 listen ✅
- Background sessions weight 0, separate stat ✅
- Scrobble minimum for API ≥3 scrobbles ✅

## Intentionally Deferred (v2+)

- Burn Mode
- Lens (album grid)
- Playlist import carousels
- MusicBrainz genre enrichment
- Auto Last.fm API sync (manual only in v1)
