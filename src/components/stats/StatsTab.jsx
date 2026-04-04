import { useState, useMemo } from 'react'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'
import AlbumModal from '../AlbumModal.jsx'

// ── Constants ─────────────────────────────────────────────────────────

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000
const ONE_YEAR_MS  = 365.25 * 24 * 60 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────

function fmtCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function decadeOf(peakMonth) {
  if (!peakMonth) return null
  const year = parseInt(peakMonth.substring(0, 4))
  if (isNaN(year)) return null
  const d = Math.floor(year / 10) * 10
  return { decade: d, label: d % 100 === 0 ? '00s' : `${d % 100}s` }
}

// Normalize artist/album names for fuzzy matching:
// strips (Remastered 2011) / [Deluxe Edition] suffixes, collapses punctuation
function normalizeAlbumKey(artist, album) {
  const norm = s => s
    .toLowerCase()
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '') // strip (parenthetical) and [bracketed] notes
    .replace(/[^\w\s]/g, ' ')                // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
  return `${norm(artist)}||${norm(album)}`
}

// ── Metric card ───────────────────────────────────────────────────────

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-border-subtle flex-1 min-w-0">
      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-wide">{label}</p>
      <p className="text-[22px] font-semibold text-ink mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ── Carousel ──────────────────────────────────────────────────────────

function CarouselItem({ entry, onTap }) {
  const images = entry.spotifyAlbum?.images
  const art    = images?.[images.length - 1]?.url

  return (
    <div
      className={`flex-shrink-0 w-[84px] ${onTap ? 'cursor-pointer active:opacity-70 transition-opacity' : ''}`}
      onClick={onTap ? () => onTap(entry) : undefined}
    >
      <div className="w-[72px] h-[72px] rounded-lg overflow-hidden bg-gray-100 mb-1.5">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-xl">💿</div>
        }
      </div>
      <p className="text-[11px] font-medium text-ink leading-tight line-clamp-2">{entry.name}</p>
      <p className="text-[10px] text-ink-muted mt-0.5 truncate">{entry.artist}</p>
      {entry._stat && (
        <span className="inline-block mt-1 text-[9px] font-medium text-badge-listen">
          {entry._stat}
        </span>
      )}
    </div>
  )
}

function Carousel({ title, items, onTap }) {
  if (!items.length) return null
  return (
    <section>
      <h2 className="text-[13px] font-medium text-ink mb-2.5">{title}</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {items.map((item, i) => (
          <CarouselItem
            key={`${item.artist}||${item.name}||${i}`}
            entry={item}
            onTap={item.spotifyAlbum ? onTap : undefined}
          />
        ))}
      </div>
    </section>
  )
}

// ── Main ──────────────────────────────────────────────────────────────

export default function StatsTab({ albums, getAlbumStats, lastfmMap, lastfmLoaded, onThisDay = [], saveLater, removeLater, isSaved }) {
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const now = Date.now()

  // Spotify reverse lookup: "artist||name" → album object (exact + normalized keys)
  const spotifyLookup = useMemo(() => {
    const m = new Map()
    for (const a of albums) {
      const artist = a.artists?.[0]?.name || ''
      const exact  = `${artist}||${a.name}`.toLowerCase()
      const norm   = normalizeAlbumKey(artist, a.name)
      m.set(exact, a)
      if (norm !== exact) m.set(norm, a)
    }
    return m
  }, [albums])

  // All lastfm entries with listenCount > 0, enriched with Spotify album ref
  // Only include entries that match a library album (so carousels never show placeholder covers)
  const enriched = useMemo(() =>
    [...lastfmMap.values()]
      .filter(e => (e.listenCount ?? 0) > 0)
      .map(e => ({
        ...e,
        spotifyAlbum:
          spotifyLookup.get(`${e.artist}||${e.name}`.toLowerCase()) ??
          spotifyLookup.get(normalizeAlbumKey(e.artist, e.name))    ??
          null,
      }))
      .filter(e => e.spotifyAlbum !== null)
  , [lastfmMap, spotifyLookup])

  // ── Summary metrics ──────────────────────────────────────────────────

  const totalScrobbles = useMemo(() =>
    [...lastfmMap.values()].reduce((s, e) => s + (e.rawScrobbles || 0), 0)
  , [lastfmMap])

  const totalListens = useMemo(() =>
    enriched.reduce((s, e) => s + (e.listenCount || 0), 0)
  , [enriched])

  const topAlbum = useMemo(() =>
    enriched.reduce((best, e) => (!best || e.listenCount > best.listenCount) ? e : best, null)
  , [enriched])

  const listeningSince = useMemo(() => {
    let min = Infinity
    for (const e of lastfmMap.values()) {
      if (e.firstHeard && e.firstHeard < min) min = e.firstHeard
    }
    return min === Infinity ? null : new Date(min).getFullYear()
  }, [lastfmMap])

  // ── Carousels ────────────────────────────────────────────────────────

  const mostPlayed = useMemo(() =>
    [...enriched]
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({ ...e, _stat: `${e.listenCount}×` }))
  , [enriched])

  const latestDiscoveries = useMemo(() =>
    [...enriched]
      .sort((a, b) => (b.firstHeard || 0) - (a.firstHeard || 0))
      .slice(0, 20)
      .map(e => ({ ...e, _stat: e.firstHeard ? String(new Date(e.firstHeard).getFullYear()) : null }))
  , [enriched])

  const goldenOldies = useMemo(() =>
    enriched
      .filter(e =>
        e.firstHeard && (now - e.firstHeard) > TWO_YEARS_MS &&
        e.lastHeard  && (now - e.lastHeard)  < ONE_YEAR_MS
      )
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({ ...e, _stat: `${e.listenCount}×` }))
  , [enriched, now])

  const climbers = useMemo(() =>
    enriched
      .filter(e => e.trend === 'rising')
      .sort((a, b) => (b.recentPlays || 0) - (a.recentPlays || 0))
      .slice(0, 20)
      .map(e => ({ ...e, _stat: e.recentPlays ? `↑ ${e.recentPlays}` : '↑' }))
  , [enriched])

  const fallers = useMemo(() =>
    enriched
      .filter(e => e.trend === 'falling')
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({ ...e, _stat: '↓' }))
  , [enriched])

  // ── On This Day ───────────────────────────────────────────────────────

  const onThisDayItems = useMemo(() =>
    onThisDay
      .map(e => ({
        ...e,
        name:        e.album,
        spotifyAlbum: spotifyLookup.get(`${e.artist}||${e.album}`.toLowerCase()) ??
                      spotifyLookup.get(normalizeAlbumKey(e.artist, e.album))    ??
                      null,
        _stat:       String(e.year),
      }))
      .slice(0, 20)
  , [onThisDay, spotifyLookup])

  // ── Genre breakdown ───────────────────────────────────────────────────

  const genreData = useMemo(() => {
    const counts = new Map()
    for (const e of enriched) {
      if (!e.spotifyAlbum) continue
      const seen = new Set()
      for (const g of (e.spotifyAlbum._genres || [])) {
        const id = clusterOf(g)
        if (id === 'other' || seen.has(id)) continue
        seen.add(id)
        const cluster = GENRE_CLUSTERS.find(c => c.id === id)
        if (!cluster) continue
        counts.set(id, {
          label: `${cluster.icon} ${cluster.label}`,
          count: (counts.get(id)?.count || 0) + e.listenCount,
        })
      }
    }
    const entries = [...counts.values()].sort((a, b) => b.count - a.count)
    const max = Math.max(...entries.map(e => e.count), 1)
    return entries.map(e => ({ ...e, pct: Math.round((e.count / max) * 100) }))
  }, [enriched])

  // ── Decade breakdown ──────────────────────────────────────────────────

  const decadeData = useMemo(() => {
    const counts = new Map()
    for (const e of enriched) {
      const d = decadeOf(e.peakMonth)
      if (!d) continue
      const prev = counts.get(d.decade)
      counts.set(d.decade, { label: d.label, count: (prev?.count || 0) + e.listenCount })
    }
    const entries = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v)
    const max = Math.max(...entries.map(v => v.count), 1)
    return entries.map(v => ({ ...v, pct: Math.round((v.count / max) * 100) }))
  }, [enriched])

  // ── Loading / empty ───────────────────────────────────────────────────

  if (!lastfmLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-ink-muted">Loading Last.fm data…</p>
      </div>
    )
  }

  if (lastfmMap.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-2">
        <p className="text-2xl">📊</p>
        <p className="text-sm font-medium text-ink">No Last.fm data</p>
        <p className="text-xs text-ink-muted">Run the parser and place lastfm-data.json in /public</p>
      </div>
    )
  }

  function handleCarouselTap(entry) {
    if (entry.spotifyAlbum) setSelectedAlbum(entry.spotifyAlbum)
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">

      {/* Summary metrics */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <MetricCard label="Scrobbles" value={fmtCount(totalScrobbles)} />
          <MetricCard label="Listens"   value={fmtCount(totalListens)}   />
        </div>
        <div className="flex gap-2">
          <MetricCard
            label="Top album"
            value={topAlbum ? `${topAlbum.listenCount}×` : '—'}
            sub={topAlbum?.name}
          />
          <MetricCard label="Since" value={listeningSince ?? '—'} />
        </div>
      </div>

      {/* Carousels */}
      <Carousel title="👑 Most Played"       items={mostPlayed}        onTap={handleCarouselTap} />
      <Carousel title="🔭 Latest Discoveries" items={latestDiscoveries} onTap={handleCarouselTap} />
      <Carousel title="🕰️ Golden Oldies"      items={goldenOldies}      onTap={handleCarouselTap} />
      <Carousel title="📈 Climbers"           items={climbers}          onTap={handleCarouselTap} />
      <Carousel title="📉 Fallers"            items={fallers}           onTap={handleCarouselTap} />
      <Carousel title="📅 On This Day"        items={onThisDayItems}    onTap={handleCarouselTap} />

      {/* Decade breakdown */}
      {decadeData.length > 0 && (
        <section>
          <h2 className="text-[13px] font-medium text-ink mb-3">Listening by decade</h2>
          <div className="space-y-2">
            {decadeData.map(({ label, count, pct }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[11px] text-ink-muted w-7 flex-shrink-0 text-right">{label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-ink-muted w-8 text-right flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Genre breakdown */}
      {genreData.length > 0 && (
        <section>
          <h2 className="text-[13px] font-medium text-ink mb-3">Listening by genre</h2>
          <div className="space-y-2">
            {genreData.map(({ label, count, pct }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[11px] text-ink-muted w-24 flex-shrink-0 truncate">{label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#534AB7] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-ink-muted w-8 text-right flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={getAlbumStats(selectedAlbum)}
          saved={isSaved?.(selectedAlbum.id) ?? false}
          onSave={saveLater}
          onRemove={removeLater}
          onClose={() => setSelectedAlbum(null)}
        />
      )}

    </div>
  )
}
