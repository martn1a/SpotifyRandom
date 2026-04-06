import { useState, useMemo } from 'react'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'
import AlbumModal from '../AlbumModal.jsx'
import { useBurnTracking } from '../../hooks/useBurnTracking.js'

// ── Constants ─────────────────────────────────────────────────────────

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000
const ONE_YEAR_MS  = 365.25 * 24 * 60 * 60 * 1000

const CAROUSEL_NAMES = {
  'most-played':        '👑 Most Played',
  'latest-discoveries': '🔭 Latest Discoveries',
  'golden-oldies':      '🕰️ Golden Oldies',
  'climbers':           '📈 Climbers',
  'fallers':            '📉 Fallers',
  'on-this-day':        '📅 On This Day',
}

// ── Helpers ───────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

function fmtAgo(ts) {
  if (!ts) return null
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  const weeks = Math.floor(days / 7)
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 7)   return `${days}d ago`
  if (weeks < 5)   return `${weeks}w ago`
  return fmtDate(ts)
}

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
      <p className="text-[10px] font-medium text-ink-muted">{label}</p>
      <p className="text-[22px] font-semibold text-ink mt-0.5 leading-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ── Carousel ──────────────────────────────────────────────────────────

function CarouselItem({ entry, onTap }) {
  const images = entry.spotifyAlbum?.images
  const art    = images?.[0]?.url

  return (
    <div
      className={`flex-shrink-0 w-[calc(50%-8px)] ${onTap ? 'cursor-pointer active:opacity-80 transition-opacity' : ''}`}
      onClick={onTap ? () => onTap(entry) : undefined}
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">💿</div>
        }
      </div>
      <p className="text-[13px] font-semibold text-ink leading-tight line-clamp-2">{entry.name}</p>
      <p className="text-[11px] text-ink-muted mt-0.5 truncate">{entry.artist}</p>
      {entry._stat && (
        <span className="inline-block mt-1 text-[11px] font-medium text-accent">
          {entry._stat}
        </span>
      )}
    </div>
  )
}

function Carousel({ title, items, onTap, onReset, burnedCount, lastBurnedAt, completionPct }) {
  if (!items.length && !onReset) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[13px] font-medium text-ink">{title}</h2>
        <div className="flex items-center gap-2">
          {lastBurnedAt != null && (
            <span className="text-[10px] text-ink-muted">{fmtAgo(lastBurnedAt)}</span>
          )}
          {onReset && (
            <button onClick={onReset} className="text-[11px] text-ink-muted active:text-ink flex items-center gap-1">
              {burnedCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-[9px] font-semibold text-ink-muted">{burnedCount}</span>
              )}
              Reset
            </button>
          )}
        </div>
      </div>
      {completionPct > 0 && (
        <div className="h-[2px] bg-gray-100 rounded-full overflow-hidden mb-2.5">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${completionPct}%` }} />
        </div>
      )}
      {!completionPct && <div className="mb-2.5" />}
      {items.length > 0
        ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {items.map((item, i) => (
              <CarouselItem
                key={`${item.artist}||${item.name}||${i}`}
                entry={item}
                onTap={item.spotifyAlbum ? onTap : undefined}
              />
            ))}
          </div>
        )
        : <p className="text-[12px] text-ink-muted py-2">All burned — tap Reset to restore.</p>
      }
    </section>
  )
}

// ── Main ──────────────────────────────────────────────────────────────

export default function StatsTab({ albums, getAlbumStats, lastfmMap, lastfmLoaded, onThisDay = [], saveLater, removeLater, isSaved }) {
  const [selectedAlbum,     setSelectedAlbum]     = useState(null)
  const [selectedCarouselId, setSelectedCarouselId] = useState(null)
  const { isBurned, burnAlbum, resetCarousel, burnStats, burnedMap } = useBurnTracking()
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
      .map(e => ({ ...e, _stat: `${e.listenCount}×`, _carouselId: 'most-played' }))
  , [enriched])

  const latestDiscoveries = useMemo(() =>
    [...enriched]
      .sort((a, b) => (b.firstHeard || 0) - (a.firstHeard || 0))
      .slice(0, 20)
      .map(e => ({ ...e, _stat: e.firstHeard ? String(new Date(e.firstHeard).getFullYear()) : null, _carouselId: 'latest-discoveries' }))
  , [enriched])

  const goldenOldies = useMemo(() =>
    enriched
      .filter(e =>
        e.firstHeard && (now - e.firstHeard) > TWO_YEARS_MS &&
        e.lastHeard  && (now - e.lastHeard)  < ONE_YEAR_MS
      )
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({ ...e, _stat: `${e.listenCount}×`, _carouselId: 'golden-oldies' }))
  , [enriched, now])

  const climbers = useMemo(() =>
    enriched
      .filter(e => e.trend === 'rising')
      .sort((a, b) => (b.recentPlays || 0) - (a.recentPlays || 0))
      .slice(0, 20)
      .map(e => ({ ...e, _stat: e.recentPlays ? `↑ ${e.recentPlays}` : '↑', _carouselId: 'climbers' }))
  , [enriched])

  const fallers = useMemo(() =>
    enriched
      .filter(e => e.trend === 'falling')
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 20)
      .map(e => ({ ...e, _stat: '↓', _carouselId: 'fallers' }))
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
        _carouselId: 'on-this-day',
      }))
      .slice(0, 20)
  , [onThisDay, spotifyLookup])

  // ── Original carousel lengths (before burn filter, for completion %) ──

  const originalLengths = useMemo(() => ({
    'most-played':        mostPlayed.length,
    'latest-discoveries': latestDiscoveries.length,
    'golden-oldies':      goldenOldies.length,
    'climbers':           climbers.length,
    'fallers':            fallers.length,
    'on-this-day':        onThisDayItems.length,
  }), [mostPlayed, latestDiscoveries, goldenOldies, climbers, fallers, onThisDayItems])

  // ── Burn-filtered carousels ───────────────────────────────────────────

  const filteredMostPlayed = useMemo(
    () => mostPlayed.filter(e => !isBurned(e.spotifyAlbum?.id, 'most-played')),
    [mostPlayed, burnedMap]
  )
  const filteredLatestDiscoveries = useMemo(
    () => latestDiscoveries.filter(e => !isBurned(e.spotifyAlbum?.id, 'latest-discoveries')),
    [latestDiscoveries, burnedMap]
  )
  const filteredGoldenOldies = useMemo(
    () => goldenOldies.filter(e => !isBurned(e.spotifyAlbum?.id, 'golden-oldies')),
    [goldenOldies, burnedMap]
  )
  const filteredClimbers = useMemo(
    () => climbers.filter(e => !isBurned(e.spotifyAlbum?.id, 'climbers')),
    [climbers, burnedMap]
  )
  const filteredFallers = useMemo(
    () => fallers.filter(e => !isBurned(e.spotifyAlbum?.id, 'fallers')),
    [fallers, burnedMap]
  )
  const filteredOnThisDayItems = useMemo(
    () => onThisDayItems.filter(e => !isBurned(e.spotifyAlbum?.id, 'on-this-day')),
    [onThisDayItems, burnedMap]
  )

  // ── Per-carousel burn helpers ──────────────────────────────────────────

  function carouselBurnProps(carouselId) {
    const stats   = burnStats.perCarousel.get(carouselId)
    const burned  = burnedMap.get(carouselId)?.size ?? 0
    const origLen = originalLengths[carouselId] ?? 0
    return {
      burnedCount:  burned,
      lastBurnedAt: stats?.lastBurnedAt ?? null,
      completionPct: origLen > 0 ? Math.round((burned / origLen) * 100) : 0,
    }
  }

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
    if (entry.spotifyAlbum) {
      setSelectedAlbum(entry.spotifyAlbum)
      setSelectedCarouselId(entry._carouselId ?? null)
    }
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

      {/* Burn stats */}
      {burnStats.totalBurned > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <MetricCard label="Burned" value={burnStats.totalBurned} />
            <MetricCard
              label="Most burned"
              value={burnStats.mostBurnedCarouselId ? CAROUSEL_NAMES[burnStats.mostBurnedCarouselId] : '—'}
            />
          </div>
          {burnStats.lastBurnedAt && (
            <MetricCard label="Last burned" value={fmtAgo(burnStats.lastBurnedAt)} />
          )}
          {/* Per-carousel breakdown */}
          {burnStats.perCarousel.size > 0 && (
            <div className="bg-white rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              {Object.entries(CAROUSEL_NAMES).map(([id, label]) => {
                const stats = burnStats.perCarousel.get(id)
                if (!stats) return null
                const origLen = originalLengths[id] ?? 0
                const burned  = burnedMap.get(id)?.size ?? 0
                const pct     = origLen > 0 ? Math.round((burned / origLen) * 100) : 0
                return (
                  <div key={id} className="px-3 py-2.5 flex items-center gap-2">
                    <span className="text-[11px] text-ink flex-1 truncate">{label}</span>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-ink-muted w-5 text-right flex-shrink-0">{stats.burnedCount}</span>
                    {stats.resetCount > 0 && (
                      <span className="text-[10px] text-ink-muted flex-shrink-0">↺{stats.resetCount}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Carousels */}
      <Carousel title="👑 Most Played"        items={filteredMostPlayed}        onTap={handleCarouselTap} onReset={() => resetCarousel('most-played')}        {...carouselBurnProps('most-played')} />
      <Carousel title="🔭 Latest Discoveries" items={filteredLatestDiscoveries} onTap={handleCarouselTap} onReset={() => resetCarousel('latest-discoveries')} {...carouselBurnProps('latest-discoveries')} />
      <Carousel title="🕰️ Golden Oldies"      items={filteredGoldenOldies}      onTap={handleCarouselTap} onReset={() => resetCarousel('golden-oldies')}      {...carouselBurnProps('golden-oldies')} />
      <Carousel title="📈 Climbers"           items={filteredClimbers}          onTap={handleCarouselTap} onReset={() => resetCarousel('climbers')}            {...carouselBurnProps('climbers')} />
      <Carousel title="📉 Fallers"            items={filteredFallers}           onTap={handleCarouselTap} onReset={() => resetCarousel('fallers')}             {...carouselBurnProps('fallers')} />
      <Carousel title="📅 On This Day"        items={filteredOnThisDayItems}    onTap={handleCarouselTap} onReset={() => resetCarousel('on-this-day')}         {...carouselBurnProps('on-this-day')} />

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
          onSave={(album) => { saveLater(album); burnAlbum(album, selectedCarouselId, 'save') }}
          onRemove={removeLater}
          onClose={() => { setSelectedAlbum(null); setSelectedCarouselId(null) }}
          onQueue={(album) => burnAlbum(album, selectedCarouselId, 'queue')}
        />
      )}

    </div>
  )
}
