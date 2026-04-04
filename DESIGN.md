# Design System — Album Discovery React App

## Designrichtung
Minimal Light ("Design B") — clean, hell, viel Weißraum. Album-Cover sind die visuellen Anker. Eigenständiges Design, kein Spotify-Klon.

## Grundprinzipien
- Heller Hintergrund (#fafafa Basis, #fff Karten)
- Album-Cover als dominantes visuelles Element
- Farbige Badges/Pills für Daten (Listen Count, Genre, Trend)
- Abgerundete Karten (border-radius: 10-12px)
- Dezente Borders (1px solid #f0f0f0)
- iOS-artiges Feeling: bottom tab bar, smooth transitions
- Dark Mode als Option (Toggle in Settings, nicht Standard)

## Farben
- Primary Text: #1a1a1a
- Secondary Text: #888
- Muted Text: #aaa / #bbb
- Accent (Buttons, aktive States): #1a1a1a (schwarz, nicht Spotify-Grün)
- Listen Count Badge: Background #E1F5EE, Text #0F6E56 (Teal)
- Genre Badge: Background #EEEDFE, Text #534AB7 (Purple)
- Trend Rising: Background #EAF3DE, Text #639922 (Green)
- Trend Falling: Background #FCEBEB, Text #A32D2D (Red)
- Card Background: #fff
- Page Background: #fafafa
- Filter Chip Active: #1a1a1a mit weißem Text
- Filter Chip Inactive: #f5f5f5 mit #666 Text

## Typografie
- Font: System font stack (SF Pro / Inter fallback)
- Überschriften: 16-18px, font-weight 500
- Body: 13-14px, font-weight 400
- Badges/Pills: 10-11px
- Keine Großbuchstaben außer kurze Labels (z.B. "ALBUM OF THE DAY")

## Komponenten
- **Album Card (List):** Cover 38-48px, Titel + Artist rechts, Badge rechts
- **Album Card (Featured):** Cover 56px+, Titel + Artist + Badge-Row darunter
- **Filter Chips:** Horizontal scrollbar, rounded pills, active = schwarz
- **Carousel:** Horizontale Scroll-Row mit Cover-Art (42-64px)
- **Metric Card:** Helles Surface (#fff), Label oben (klein, grau), Zahl groß darunter
- **Bottom Tab Bar:** 4 Tabs (Discover, Library, Stats, Later), Punkt-Indikator für aktiv
- **Action Button:** Schwarz, rounded, weiße Schrift, volle Breite oder auto

## Tab-Struktur
1. **Discover** — Album of the Day, Random Picker, Filter, Quick Picks
2. **Library** — Search, Genre Filter, Album List mit Listen-Count
3. **Stats** — Metric Cards, Karussells (Most Played, Discoveries, Golden Oldies, Climbers, Fallers, On This Day, etc.)
4. **Listen Later** — Queue-Liste, sortierbar

## Tailwind Mapping
- bg-white, bg-gray-50 (fafafa), bg-gray-100 (f5f5f5)
- text-gray-900 (#1a1a1a), text-gray-500 (#888), text-gray-400 (#aaa)
- rounded-lg (8px), rounded-xl (12px)
- border border-gray-100
