import { useState, useMemo } from 'react'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'

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

function AlbumRow({ album, listenCount }) {
  const art = album.images?.[album.images.length - 1]?.url || album.images?.[0]?.url

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 active:bg-gray-50 transition-colors">
      {/* Cover art */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" />
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
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'recently_added', label: 'Recently Added' },
  { id: 'most_played',    label: 'Most Played'    },
  { id: 'name',           label: 'Name'           },
]

export default function LibraryTab({ albums, getAlbumStats, genresLoading }) {
  const [search,        setSearch]        = useState('')
  const [activeCluster, setActiveCluster] = useState(null)
  const [sort,          setSort]          = useState('recently_added')

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

    if (activeCluster) {
      list = list.filter(a => {
        const clusters = new Set((a._genres || []).map(clusterOf))
        return clusters.has(activeCluster)
      })
    }

    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
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
  }, [albums, search, activeCluster, sort, getAlbumStats])

  return (
    <div className="flex flex-col h-full">

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 bg-page">
        <div className="relative">
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
      </div>

      {/* ── Sort chips ─────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSort(opt.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors
              ${sort === opt.id
                ? 'bg-chip-active text-white'
                : 'bg-chip-inactive text-gray-600'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Genre cluster chips ────────────────────────────────────── */}
      {visibleClusters.length > 0 && (
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {activeCluster && (
            <button
              onClick={() => setActiveCluster(null)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium
                         bg-chip-active text-white"
            >
              ✕ All
            </button>
          )}
          {visibleClusters.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCluster(activeCluster === c.id ? null : c.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full
                          text-[11px] font-medium transition-colors
                ${activeCluster === c.id
                  ? 'bg-chip-active text-white'
                  : 'bg-chip-inactive text-gray-600'
                }`}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
              <span className="opacity-50">{clusterCounts.get(c.id)}</span>
            </button>
          ))}
        </div>
      )}

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
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {filtered.map(album => (
          <AlbumRow
            key={album.id}
            album={album}
            listenCount={getAlbumStats(album)?.listenCount || 0}
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
    </div>
  )
}
