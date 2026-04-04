import { useState, useMemo, useCallback } from 'react'
import { addToQueue } from '../../lib/spotify-api.js'
import AlbumModal from '../AlbumModal.jsx'

const SORT_OPTIONS = [
  { id: 'added',  label: 'Added'  },
  { id: 'artist', label: 'Artist' },
  { id: 'year',   label: 'Year'   },
]

// ── Album row ─────────────────────────────────────────────────────────

function AlbumRow({ album, listenCount, onQueue, onRemove, onClick }) {
  const art    = album.images?.[album.images.length - 1]?.url || album.images?.[0]?.url
  const artist = (album.artists || []).map(a => a.name).join(', ')
  const year   = (album.release_date || '').substring(0, 4)

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 active:bg-gray-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
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
          {artist}{year ? ` · ${year}` : ''}
        </p>
      </div>

      {/* Listen badge */}
      {listenCount > 0 && (
        <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full
                         text-[10px] font-medium bg-badge-listen-bg text-badge-listen">
          {listenCount}×
        </span>
      )}

      {/* Queue button */}
      <button
        onClick={e => { e.stopPropagation(); onQueue(album) }}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                   bg-chip-inactive text-ink text-[14px] active:bg-gray-200 transition-colors"
        aria-label="Queue to Spotify"
      >
        ▶
      </button>

      {/* Remove button */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(album.id) }}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                   text-ink-muted text-[16px] active:bg-gray-100 transition-colors"
        aria-label="Remove"
      >
        ×
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────

export default function ListenLaterTab({ items, saveLater, removeLater, isSaved, getAlbumStats }) {
  const [sort,          setSort]          = useState('added')
  const [queueStatus,   setQueueStatus]   = useState(null)
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

  const handleQueue = useCallback(async (album) => {
    const tracks = (album.tracks?.items || []).filter(t => t?.uri)
    if (!tracks.length) {
      setQueueStatus({ msg: 'No tracks found', error: true })
      setTimeout(() => setQueueStatus(null), 2500)
      return
    }
    try {
      for (const track of tracks) {
        await addToQueue(track.uri)
      }
      setQueueStatus({ msg: `"${album.name}" added to queue`, error: false })
    } catch (e) {
      setQueueStatus({ msg: e.message, error: true })
    }
    setTimeout(() => setQueueStatus(null), 2500)
  }, [])

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
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="flex-shrink-0 text-[11px] text-ink-muted active:text-ink transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Queue status toast ──────────────────────────────────────── */}
      {queueStatus && (
        <div className={`mx-4 mb-1 px-3 py-2 rounded-xl text-[12px] font-medium
          ${queueStatus.error
            ? 'bg-[#FCEBEB] text-[#A32D2D]'
            : 'bg-badge-listen-bg text-badge-listen'
          }`}>
          {queueStatus.msg}
        </div>
      )}

      {/* ── Album count ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <p className="px-4 pb-2 text-[11px] text-ink-muted">{items.length} saved</p>
      )}

      {/* ── List ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {sorted.map(album => (
          <AlbumRow
            key={album.id}
            album={album}
            listenCount={getAlbumStats(album)?.listenCount || 0}
            onQueue={handleQueue}
            onRemove={removeLater}
            onClick={() => setSelectedAlbum(album)}
          />
        ))}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <p className="text-2xl mb-2">🔖</p>
            <p className="text-sm font-medium text-ink">Nothing saved yet</p>
            <p className="text-xs text-ink-muted mt-1">
              Tap the bookmark icon in Library or "Save for Later" in Discover
            </p>
          </div>
        )}

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
        />
      )}
    </div>
  )
}
