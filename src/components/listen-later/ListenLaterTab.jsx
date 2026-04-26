import { useState, useMemo } from 'react'
import { cn } from '../../lib/utils.js'
import AlbumModal from '../AlbumModal.jsx'

const SORT_OPTIONS = [
  { id: 'added',  label: 'Added'  },
  { id: 'artist', label: 'Artist' },
  { id: 'year',   label: 'Year'   },
]

// ── Main ──────────────────────────────────────────────────────────────

export default function ListenLaterTab({ items, saveLater, removeLater, isSaved, getAlbumStats, albums = [], onBadgeClick }) {
  const [sort,          setSort]          = useState('added')
  const [selectedAlbum, setSelectedAlbum] = useState(null)

  const sorted = useMemo(() => {
    const list = [...items]
    if (sort === 'artist') {
      list.sort((a, b) =>
        (a.artists?.[0]?.name || '').localeCompare(b.artists?.[0]?.name || ''))
    } else if (sort === 'year') {
      list.sort((a, b) =>
        (b.release_date || '').localeCompare(a.release_date || ''))
    } else {
      list.sort((a, b) => (b._savedAt || 0) - (a._savedAt || 0))
    }
    return list
  }, [items, sort])

  function clearAll() {
    items.forEach(i => removeLater(i.id))
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Sort chips + Clear All ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-page">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors',
                sort === opt.id
                  ? 'bg-accent text-page'
                  : 'bg-card-raised text-ink-muted border border-border-subtle'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="flex-shrink-0 text-[11px] text-ink-muted active:text-ink transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Album count ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <p className="px-4 pb-2 text-[11px] text-ink-muted">{items.length} saved</p>
      )}

      {/* ── Grid / Empty state ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {items.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-card-raised rounded-full flex items-center justify-center mx-auto border border-border-subtle">
              <span className="text-2xl">🔖</span>
            </div>
            <p className="text-ink font-medium">No albums saved yet.</p>
            <p className="text-ink-muted text-sm">Save albums from Discover or Browse.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sorted.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedAlbum(item)}
                className="space-y-2 group cursor-pointer"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-border-subtle">
                  {item.images?.[0]?.url
                    ? (
                      <img
                        src={item.images[0].url}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                      />
                    )
                    : (
                      <div className="w-full h-full bg-card flex items-center justify-center text-3xl">💿</div>
                    )
                  }
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLater(item.id) }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-accent border border-white/10"
                    aria-label="Remove from Later"
                  >
                    🔖
                  </button>
                </div>
                <div>
                  <p className="font-bold text-sm truncate group-hover:text-accent transition-colors">{item.name}</p>
                  <p className="text-ink-muted text-xs truncate">{item.artists?.[0]?.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom padding for tab bar */}
        <div className="h-4" />
      </div>

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={getAlbumStats(selectedAlbum)}
          saved={isSaved?.(selectedAlbum.id)}
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
