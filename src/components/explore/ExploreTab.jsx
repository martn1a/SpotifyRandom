import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AlbumModal from '../AlbumModal.jsx'
import { useBurnTracking } from '../../hooks/useBurnTracking.js'
import { cn } from '../../lib/utils.js'

function fmtAgo(ts) {
  if (!ts) return null
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(days / 7)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  return new Date(ts).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

function ExploreCarouselItem({ album, onTap, inLibrary }) {
  const [imgError, setImgError] = useState(false)
  const art = !imgError ? album.images?.[0]?.url : null

  return (
    <div
      className="flex-shrink-0 w-[calc(50%-8px)] cursor-pointer active:opacity-80 transition-opacity"
      onClick={() => onTap(album, inLibrary)}
    >
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-card mb-2">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={() => setImgError(true)} />
          : <div className="w-full h-full flex items-center justify-center text-3xl">💿</div>
        }
      </div>
      <p className="text-[13px] font-semibold text-ink leading-tight line-clamp-2">{album.name}</p>
      <p className="text-[11px] text-ink-muted mt-0.5 truncate">{album.artists?.[0]?.name}</p>
      <span className={cn(
        'inline-block mt-1 text-[11px] font-medium',
        inLibrary ? 'text-accent' : 'text-[#a0a0ff]'
      )}>
        {inLibrary ? '★ Library' : '+ New'}
      </span>
    </div>
  )
}

export default function ExploreTab({
  albums = [],
  getAlbumStats,
  selectedPlaylists = [],
  playlistAlbums = new Map(),
  playlistsLoading = false,
  playlists = [],
  saveLater,
  removeLater,
  isSaved,
}) {
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedInLibrary, setSelectedInLibrary] = useState(true)
  const [selectedCarouselId, setSelectedCarouselId] = useState(null)
  const { isBurned, burnAlbum, resetCarousel, burnStats, burnedMap } = useBurnTracking()

  const libraryIdSet = useMemo(() => new Set(albums.map(a => a.id)), [albums])
  const libraryMap = useMemo(() => {
    const m = new Map()
    for (const a of albums) m.set(a.id, a)
    return m
  }, [albums])

  if (selectedPlaylists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4">
        <span className="text-4xl">🎵</span>
        <p className="text-sm font-medium text-ink">No playlists selected</p>
        <p className="text-xs text-ink-muted max-w-xs">
          Open Settings → Explore Playlists to pick up to 5 of your Spotify playlists.
        </p>
      </div>
    )
  }

  function handleTap(album, inLibrary) {
    const albumToOpen = inLibrary ? (libraryMap.get(album.id) ?? album) : album
    setSelectedAlbum(albumToOpen)
    setSelectedInLibrary(inLibrary)
  }

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {selectedPlaylists.map(playlistId => {
        const carouselId = `explore_${playlistId}`
        const rawAlbums = playlistAlbums.get(playlistId)
        const playlistName = playlists.find(p => p.id === playlistId)?.name ?? playlistId

        if (rawAlbums === undefined) {
          return (
            <section key={playlistId}>
              <div className="h-4 w-32 bg-card-raised rounded animate-pulse mb-3" />
              <div className="flex gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex-shrink-0 w-[calc(50%-8px)] aspect-square bg-card-raised rounded-xl animate-pulse" />
                ))}
              </div>
            </section>
          )
        }

        if (rawAlbums.length === 0) {
          return (
            <section key={playlistId}>
              <h2 className="text-[13px] font-medium text-ink mb-1">{playlistName}</h2>
              <p className="text-[12px] text-ink-muted py-2">No albums found in this playlist.</p>
            </section>
          )
        }

        const enriched = rawAlbums.map(a => ({
          ...a,
          _inLibrary: libraryIdSet.has(a.id),
        }))

        const burned = burnedMap.get(carouselId)
        const visible = enriched.filter(a => !isBurned(a.id, carouselId))
        const burnedCount = burned?.size ?? 0
        const completionPct = enriched.length > 0
          ? Math.round((burnedCount / enriched.length) * 100)
          : 0
        const bpStats = burnStats.perCarousel.get(carouselId)
        const lastBurnedAt = bpStats?.lastBurnedAt ?? null

        return (
          <section key={playlistId}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[13px] font-medium text-ink truncate flex-1 mr-2">
                {playlistName}
              </h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lastBurnedAt != null && (
                  <span className="text-[10px] text-ink-muted">{fmtAgo(lastBurnedAt)}</span>
                )}
                <button
                  onClick={() => resetCarousel(carouselId)}
                  className="text-[11px] text-ink-muted active:text-ink flex items-center gap-1"
                >
                  {burnedCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-card-raised text-[9px] font-semibold text-ink-muted">{burnedCount}</span>
                  )}
                  Reset
                </button>
              </div>
            </div>
            {completionPct > 0 && (
              <div className="h-[2px] bg-card-raised rounded-full overflow-hidden mb-2.5">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
            )}
            {!completionPct && <div className="mb-2.5" />}
            {visible.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                <AnimatePresence>
                  {visible.map(album => (
                    <motion.div
                      key={album.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5, filter: 'blur(8px)' }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className="flex-shrink-0 w-[calc(50%-8px)]"
                    >
                      <ExploreCarouselItem
                        album={album}
                        onTap={(a, inLib) => {
                          setSelectedCarouselId(carouselId)
                          handleTap(a, inLib)
                        }}
                        inLibrary={album._inLibrary}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <p className="text-[12px] text-ink-muted py-2">All burned — tap Reset to restore.</p>
            )}
          </section>
        )
      })}

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={selectedInLibrary ? getAlbumStats?.(selectedAlbum) : null}
          saved={isSaved?.(selectedAlbum.id) ?? false}
          onSave={(album) => { saveLater(album); burnAlbum(album, selectedCarouselId, 'save') }}
          onRemove={removeLater}
          onClose={() => { setSelectedAlbum(null); setSelectedCarouselId(null) }}
          onQueue={(album) => burnAlbum(album, selectedCarouselId, 'queue')}
          library={albums}
          inLibrary={selectedInLibrary}
        />
      )}
    </div>
  )
}
