import { useState, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import AlbumModal from '../AlbumModal.jsx'
import { useBurnTracking } from '../../hooks/useBurnTracking.js'
import { cn } from '../../lib/utils.js'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'

// ── Constants ─────────────────────────────────────────────────────────

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000
const ONE_YEAR_MS  = 365.25 * 24 * 60 * 60 * 1000

const TIME_RANGES = [
  { id: '7d',  label: '7D',  ms: 7   * 24 * 60 * 60 * 1000 },
  { id: '3m',  label: '3M',  ms: 90  * 24 * 60 * 60 * 1000 },
  { id: '6m',  label: '6M',  ms: 180 * 24 * 60 * 60 * 1000 },
  { id: '1y',  label: '1Y',  ms: 365 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'ALL', ms: null },
]

const DEFAULT_CAROUSEL_ORDER = [
  'most-played', 'latest-discoveries', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'recently-added',
  'overdue', 'peak-nostalgie', 'long-waiting', 'artist-gaps', 'former-love', 'genre-dive', 'gateway', 'streaks',
]

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

// ── Sort helper ───────────────────────────────────────────────────────

function applySortToItems(items, sort, getAlbumStats) {
  if (sort === 'added')     return [...items].sort((a, b) => new Date(b.spotifyAlbum?._added_at || 0) - new Date(a.spotifyAlbum?._added_at || 0))
  if (sort === 'relevance') return [...items].sort((a, b) => (b.listenCount || 0) - (a.listenCount || 0))
  return items // 'original' — keep existing sort
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

// ── Carousel ──────────────────────────────────────────────────────────

function CarouselItem({ entry, onTap, className }) {
  const [imgError, setImgError] = useState(false)
  const images = entry.spotifyAlbum?.images
  const art = !imgError ? (images?.[0]?.url ?? null) : null
  const itemClass = className ?? 'flex-shrink-0 w-[calc(50%-8px)]'

  return (
    <div
      className={`${itemClass} ${onTap ? 'cursor-pointer active:opacity-80 transition-opacity' : ''}`}
      onClick={onTap ? () => onTap(entry) : undefined}
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-card mb-2">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"
                 onError={() => setImgError(true)} />
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
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-card-raised text-[9px] font-semibold text-ink-muted">{burnedCount}</span>
              )}
              Reset
            </button>
          )}
        </div>
      </div>
      {completionPct > 0 && (
        <div className="h-[2px] bg-card-raised rounded-full overflow-hidden mb-2.5">
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
        : (
          <div className="flex flex-col items-center gap-3 py-6 px-4 bg-card-raised rounded-2xl border border-border-subtle text-center">
            <span className="text-2xl">🔥</span>
            <p className="text-[13px] font-medium text-ink">All caught up</p>
            <p className="text-[11px] text-ink-muted">You've burned every album in this list.</p>
            {onReset && (
              <button
                onClick={onReset}
                className="mt-1 px-4 py-2 rounded-full text-[12px] font-semibold bg-card border border-border-subtle text-ink-secondary active:opacity-70 transition-opacity"
              >
                ↺ Restore list
              </button>
            )}
          </div>
        )
      }
    </section>
  )
}

// ── Main ──────────────────────────────────────────────────────────────

export default function StatsTab({ albums, getAlbumStats, lastfmMap, lastfmLoaded, onThisDay = [], saveLater, removeLater, isSaved, onBadgeClick, carouselSettings, onUpdateCarouselSettings }) {
  const [selectedAlbum,     setSelectedAlbum]     = useState(null)
  const [selectedCarouselId, setSelectedCarouselId] = useState(null)
  const [mostPlayedRange, setMostPlayedRange] = useState('all')
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

  // Reverse lookup: normalized key → lastfm entry (for Spotify-sourced carousels)
  const lastfmByKey = useMemo(() => {
    const m = new Map()
    for (const [key, entry] of lastfmMap.entries()) {
      m.set(key, entry)
    }
    return m
  }, [lastfmMap])

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

  // ── Carousels ────────────────────────────────────────────────────────

  const mostPlayed = useMemo(() => {
    const range = TIME_RANGES.find(r => r.id === mostPlayedRange)
    const cutoff = range?.ms ? Date.now() - range.ms : null

    return [...enriched]
      .map(e => {
        const periodListens = cutoff
          ? (e.sessionDates || []).filter(d => d > cutoff).length
          : e.listenCount
        return { ...e, _periodListens: periodListens }
      })
      .filter(e => e._periodListens > 0)
      .sort((a, b) => b._periodListens - a._periodListens)
      .slice(0, 20)
      .map(e => ({ ...e, _stat: `${e._periodListens}×`, _carouselId: 'most-played' }))
  }, [enriched, mostPlayedRange])

  const latestDiscoveries = useMemo(() =>
    [...enriched]
      .sort((a, b) => (b.firstHeard || 0) - (a.firstHeard || 0))
      .slice(0, 20)
      .map(e => ({ ...e, _stat: e.firstHeard ? String(new Date(e.firstHeard).getFullYear()) : null, _carouselId: 'latest-discoveries' }))
  , [enriched])

  const recentlyAdded = useMemo(() =>
    [...albums]
      .filter(a => a._added_at)
      .sort((a, b) => new Date(b._added_at) - new Date(a._added_at))
      .slice(0, 20)
      .map(a => ({
        name:         a.name,
        artist:       a.artists?.[0]?.name || '',
        spotifyAlbum: a,
        _stat:        fmtAgo(new Date(a._added_at).getTime()),
        _carouselId:  'recently-added',
      }))
  , [albums])

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
    'recently-added':     recentlyAdded.length,
  }), [mostPlayed, latestDiscoveries, goldenOldies, climbers, fallers, onThisDayItems, recentlyAdded])

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
  const filteredRecentlyAdded = useMemo(
    () => recentlyAdded.filter(e => !isBurned(e.spotifyAlbum?.id, 'recently-added')),
    [recentlyAdded, burnedMap]
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

  const order = carouselSettings?._order ?? DEFAULT_CAROUSEL_ORDER

  const blocks = {
    'most-played': (carouselSettings?.['most-played']?.visible ?? true) && (() => {
      const bp = carouselBurnProps('most-played')
      return (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[13px] font-medium text-ink">👑 Most Played</h2>
            <div className="flex items-center gap-2">
              {bp.lastBurnedAt != null && (
                <span className="text-[10px] text-ink-muted">{fmtAgo(bp.lastBurnedAt)}</span>
              )}
              <button onClick={() => resetCarousel('most-played')} className="text-[11px] text-ink-muted active:text-ink flex items-center gap-1">
                {bp.burnedCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-card-raised text-[9px] font-semibold text-ink-muted">{bp.burnedCount}</span>
                )}
                Reset
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-1 mb-2">
            {TIME_RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setMostPlayedRange(r.id)}
                className={cn(
                  'text-[10px] font-bold px-2.5 py-1 rounded-full transition-all',
                  mostPlayedRange === r.id
                    ? 'bg-accent text-page'
                    : 'bg-card-raised text-ink-muted hover:text-ink'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {bp.completionPct > 0 && (
            <div className="h-[2px] bg-card-raised rounded-full overflow-hidden mb-2.5">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${bp.completionPct}%` }} />
            </div>
          )}
          {filteredMostPlayed.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
              <AnimatePresence>
                {applySortToItems(filteredMostPlayed, carouselSettings?.['most-played']?.sort || 'original', getAlbumStats).map((item) => (
                  <motion.div
                    key={`${item.artist}||${item.name}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="flex-shrink-0 w-[calc(50%-8px)]"
                  >
                    <CarouselItem entry={item} onTap={handleCarouselTap} className="w-full" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 px-4 bg-card-raised rounded-2xl border border-border-subtle text-center">
              <span className="text-2xl">{mostPlayedRange === '7d' ? '🎵' : '🔥'}</span>
              <p className="text-[13px] font-medium text-ink">
                {mostPlayedRange === '7d' ? 'Nothing heard this week' : 'All caught up'}
              </p>
              <p className="text-[11px] text-ink-muted">
                {mostPlayedRange === '7d'
                  ? 'No Last.fm scrobbles found in the last 7 days.'
                  : "You've burned every album in this list."}
              </p>
              {mostPlayedRange !== '7d' && (
                <button
                  onClick={() => resetCarousel('most-played')}
                  className="mt-1 px-4 py-2 rounded-full text-[12px] font-semibold bg-card border border-border-subtle text-ink-secondary active:opacity-70 transition-opacity"
                >
                  ↺ Restore list
                </button>
              )}
            </div>
          )}
        </section>
      )
    })(),
    'latest-discoveries': (carouselSettings?.['latest-discoveries']?.visible ?? true) && (
      <Carousel title="🔭 Latest Discoveries" items={filteredLatestDiscoveries} onTap={handleCarouselTap} onReset={() => resetCarousel('latest-discoveries')} {...carouselBurnProps('latest-discoveries')} />
    ),
    'golden-oldies': (carouselSettings?.['golden-oldies']?.visible ?? true) && (
      <Carousel title="🕰️ Golden Oldies" items={filteredGoldenOldies} onTap={handleCarouselTap} onReset={() => resetCarousel('golden-oldies')} {...carouselBurnProps('golden-oldies')} />
    ),
    'climbers': (carouselSettings?.['climbers']?.visible ?? true) && (
      <Carousel title="📈 Climbers" items={filteredClimbers} onTap={handleCarouselTap} onReset={() => resetCarousel('climbers')} {...carouselBurnProps('climbers')} />
    ),
    'fallers': (carouselSettings?.['fallers']?.visible ?? true) && (
      <Carousel title="📉 Fallers" items={filteredFallers} onTap={handleCarouselTap} onReset={() => resetCarousel('fallers')} {...carouselBurnProps('fallers')} />
    ),
    'on-this-day': (carouselSettings?.['on-this-day']?.visible ?? true) && (
      <Carousel title="📅 On This Day" items={filteredOnThisDayItems} onTap={handleCarouselTap} onReset={() => resetCarousel('on-this-day')} {...carouselBurnProps('on-this-day')} />
    ),
    'recently-added': (carouselSettings?.['recently-added']?.visible ?? true) && (
      <Carousel title="🔔 Recently Added" items={filteredRecentlyAdded} onTap={handleCarouselTap} onReset={() => resetCarousel('recently-added')} {...carouselBurnProps('recently-added')} />
    ),
  }

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {order.map(id => blocks[id]
        ? <Fragment key={id}>{blocks[id]}</Fragment>
        : null
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
          library={albums}
          onBadgeClick={onBadgeClick}
        />
      )}
    </div>
  )
}
