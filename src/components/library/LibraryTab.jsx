import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'
import AlbumModal from '../AlbumModal.jsx'
import { cn } from '../../lib/utils.js'
import { getAlbumBadges } from '../../lib/badge-utils.js'

// ── Sub-components ────────────────────────────────────────────────────

function ListenBadge({ count }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium
                     bg-badge-listen-bg text-badge-listen flex-shrink-0">
      {count}×
    </span>
  )
}

function BookmarkIcon({ filled }) {
  return filled
    ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
        <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/>
      </svg>
    )
    : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted">
        <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/>
      </svg>
    )
}

function AlbumRow({ album, listenCount, saved, onSave, onRemove, onClick }) {
  const art = album.images?.[album.images.length - 1]?.url || album.images?.[0]?.url

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 active:bg-card-raised transition-colors cursor-pointer" onClick={onClick}>
      {/* Cover art */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-card flex-shrink-0">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : <div className="w-full h-full flex items-center justify-center text-xl">💿</div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-ink truncate leading-tight">{album.name}</p>
        <p className="text-[12px] text-ink-secondary truncate mt-0.5">
          {(album.artists || []).map(a => a.name).join(', ')}
        </p>
      </div>

      {/* Listen count badge */}
      <ListenBadge count={listenCount} />

      {/* Bookmark */}
      <button
        onClick={e => { e.stopPropagation(); saved ? onRemove(album.id) : onSave(album) }}
        className="flex-shrink-0 p-1 active:scale-90 transition-transform"
        aria-label={saved ? 'Remove from Later' : 'Save for Later'}
      >
        <BookmarkIcon filled={saved} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'recently_added', label: 'Recently Added' },
  { id: 'most_played',    label: 'Most Played'    },
  { id: 'year',           label: 'Year'           },
  { id: 'name',           label: 'Name'           },
]

const TYPE_OPTIONS = [
  { id: 'all',         label: 'All'          },
  { id: 'album',       label: 'Albums'       },
  { id: 'single',      label: 'Singles'      },
  { id: 'compilation', label: 'Compilations' },
]

export default function LibraryTab({ albums, getAlbumStats, genresLoading, saveLater, removeLater, isSaved, libraryFilter, onClearFilter = () => {}, onBadgeClick }) {
  const [search,        setSearch]        = useState('')
  const [activeCluster, setActiveCluster] = useState(null)
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [sort,          setSort]          = useState('recently_added')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [isFilterOpen,  setIsFilterOpen]  = useState(false)

  // Build cluster → album count map (only includes clusters with ≥1 album)
  const clusterCounts = useMemo(() => {
    const counts = new Map()
    for (const a of albums) {
      const seen = new Set()
      for (const g of (a._genres || [])) {
        const c = clusterOf(g)
        if (c !== 'other' && !seen.has(c)) {
          counts.set(c, (counts.get(c) || 0) + 1)
          seen.add(c)
        }
      }
    }
    return counts
  }, [albums])

  const visibleClusters = GENRE_CLUSTERS.filter(c => clusterCounts.has(c.id))

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...albums]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.artists || []).some(ar => ar.name.toLowerCase().includes(q))
      )
    }

    if (typeFilter !== 'all') {
      list = list.filter(a => a.album_type === typeFilter)
    }

    if (activeCluster) {
      list = list.filter(a => {
        const clusters = new Set((a._genres || []).map(clusterOf))
        return clusters.has(activeCluster)
      })
    }

    if (libraryFilter) {
      list = list.filter(album => {
        const stats = getAlbumStats(album)
        const badges = getAlbumBadges(album, stats)
        return badges.some(b => b.value === libraryFilter.value)
      })
    }

    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'year') {
      list.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
    } else if (sort === 'most_played') {
      list.sort((a, b) => {
        const aStats = getAlbumStats(a)
        const bStats = getAlbumStats(b)
        return (bStats?.listenCount || 0) - (aStats?.listenCount || 0)
      })
    } else {
      // recently_added
      list.sort((a, b) => (b._added_at || '').localeCompare(a._added_at || ''))
    }

    return list
  }, [albums, search, typeFilter, activeCluster, sort, getAlbumStats, libraryFilter])

  return (
    <div className="flex flex-col h-full">

      {/* Badge filter banner */}
      {libraryFilter && (
        <div className="flex items-center justify-between bg-accent/10 border border-accent/20 p-4 rounded-2xl mb-4 mx-4 mt-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-page text-base shadow-lg">
              {libraryFilter.icon || '🏷'}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent/60">Filtered by</p>
              <p className="font-bold text-sm text-ink">{libraryFilter.label}</p>
            </div>
          </div>
          <button
            onClick={onClearFilter}
            aria-label="Clear filter"
            className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center hover:bg-accent/30 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 bg-page">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">⌕</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search albums or artists…"
              className="w-full bg-white border border-border-subtle rounded-xl
                         pl-8 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-muted
                         outline-none focus:border-gray-300 transition-colors"
            />
          </div>
          <button
            onClick={() => setIsFilterOpen(prev => !prev)}
            className={cn(
              'w-11 h-11 rounded-2xl border flex items-center justify-center transition-all flex-shrink-0',
              isFilterOpen
                ? 'bg-accent text-page border-accent'
                : 'bg-card-raised text-ink-muted border-border-subtle'
            )}
            aria-label="Toggle filters"
          >
            ⊞
          </button>
        </div>
      </div>

      {/* Collapsible filter panel */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-card-raised border border-border-subtle rounded-2xl mx-4 mb-3 p-4 space-y-3">
              {/* Sort chips */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Sort</p>
                <div className="flex gap-2 flex-wrap">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSort(opt.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                        sort === opt.id ? 'bg-accent text-page' : 'bg-card text-ink-muted border border-border-subtle'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type filter chips */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Type</p>
                <div className="flex gap-2 flex-wrap">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTypeFilter(opt.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                        typeFilter === opt.id ? 'bg-accent text-page' : 'bg-card text-ink-muted border border-border-subtle'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre cluster chips */}
              {visibleClusters.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Genre</p>
                  <div className="flex gap-2 flex-wrap">
                    {activeCluster && (
                      <button
                        onClick={() => setActiveCluster(null)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-accent text-page"
                      >
                        ✕ All
                      </button>
                    )}
                    {visibleClusters.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setActiveCluster(activeCluster === c.id ? null : c.id)}
                        className={cn(
                          'flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                          activeCluster === c.id
                            ? 'bg-accent text-page'
                            : 'bg-card text-ink-muted border border-border-subtle'
                        )}
                      >
                        <span>{c.icon}</span>
                        <span>{c.label}</span>
                        <span className="opacity-50">{clusterCounts.get(c.id)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Genre loading indicator ────────────────────────────────── */}
      {genresLoading && visibleClusters.length === 0 && (
        <p className="px-4 pb-2 text-[11px] text-ink-muted">Loading genres…</p>
      )}

      {/* ── Album count ────────────────────────────────────────────── */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <p className="text-[11px] text-ink-muted">
          {filtered.length === albums.length
            ? `${albums.length} albums`
            : `${filtered.length} of ${albums.length}`}
        </p>
      </div>

      {/* ── Album list ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
        {filtered.map(album => (
          <AlbumRow
            key={album.id}
            album={album}
            listenCount={getAlbumStats(album)?.listenCount || 0}
            saved={isSaved(album.id)}
            onSave={saveLater}
            onRemove={removeLater}
            onClick={() => setSelectedAlbum(album)}
          />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-medium text-ink">No albums found</p>
            <p className="text-xs text-ink-muted mt-1">Try a different search or filter</p>
          </div>
        )}

        {/* Bottom padding for tab bar */}
        <div className="h-4" />
      </div>

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={getAlbumStats(selectedAlbum)}
          saved={isSaved(selectedAlbum.id)}
          onSave={saveLater}
          onRemove={removeLater}
          onClose={() => setSelectedAlbum(null)}
          library={albums}
          onBadgeClick={onBadgeClick}
        />
      )}
    </div>
  )
}
