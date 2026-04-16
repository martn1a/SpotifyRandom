import { useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { X, Play, Bookmark, BookmarkCheck, RefreshCw } from 'lucide-react'
import { cn, formatDuration, getAlbumCover, getAlbumYear, getAlbumBadges, getSimilarAlbums } from '../lib/utils'
import type { SpotifyAlbum, LastfmStats } from '../lib/types'

interface AlbumModalProps {
  album: SpotifyAlbum | null
  onClose: () => void
  lastfmMap: Map<string, LastfmStats>
  library: SpotifyAlbum[]
  isSaved: boolean
  onToggleSave: (album: SpotifyAlbum) => void
  onQueue: (album: SpotifyAlbum) => void
  showRemove?: boolean
}

export default function AlbumModal({
  album, onClose, lastfmMap, library,
  isSaved, onToggleSave, onQueue, showRemove = false
}: AlbumModalProps) {
  const dragY = useMotionValue(0)
  const opacity = useTransform(dragY, [0, 200], [1, 0])
  const [burnEffect, setBurnEffect] = useState(false)

  if (!album) return null

  const artistName = album.artists[0]?.name ?? ''
  const lfKey = `${artistName}||${album.name}`
  const stats = lastfmMap.get(lfKey)
  const similar = getSimilarAlbums(album, library, lastfmMap)
  const badges = getAlbumBadges(album)
  const cover = getAlbumCover(album)

  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 150 || info.velocity.y > 500) onClose()
    else dragY.set(0)
  }

  function handleQueue() {
    setBurnEffect(true)
    onQueue(album)
    setTimeout(() => setBurnEffect(false), 600)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />

        {/* Sheet */}
        <motion.div
          className="relative w-full bg-card rounded-t-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          style={{ y: dragY, opacity }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          <div className="overflow-y-auto flex-1 pb-safe">
            {/* Badges row */}
            <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
              {badges.map(b => (
                <span key={b} className="shrink-0 text-[10px] font-semibold tracking-wider bg-card-raised border border-border rounded-full px-2.5 py-1 text-ink-muted">
                  {b}
                </span>
              ))}
              {stats && (
                <span className="shrink-0 text-[10px] font-semibold tracking-wider bg-accent-dim border border-accent-border rounded-full px-2.5 py-1 text-accent">
                  {stats.listenCount}× HEARD
                </span>
              )}
            </div>

            {/* Header */}
            <div className="flex gap-3 px-4 pb-4">
              <img
                src={cover}
                alt={album.name}
                className="w-20 h-20 rounded-xl shrink-0 object-cover"
                decoding="async"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-ink leading-tight truncate">{album.name}</p>
                <p className="text-sm text-ink-muted mt-0.5 truncate">{artistName}</p>
                <p className="text-xs text-ink-subtle mt-1">
                  {getAlbumYear(album)} · {album.album_type} · {album.tracks?.items?.length ?? 0} tracks
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-4 pb-4">
              <motion.button
                onClick={handleQueue}
                animate={burnEffect ? { scale: 0.92, filter: 'blur(1px)' } : { scale: 1, filter: 'blur(0px)' }}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-black font-semibold text-sm rounded-xl py-3"
              >
                {burnEffect ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Queue to Spotify
              </motion.button>
              <button
                onClick={() => onToggleSave(album)}
                className={cn(
                  'flex items-center justify-center gap-2 font-semibold text-sm rounded-xl py-3 px-4 border',
                  isSaved
                    ? 'bg-accent-dim border-accent-border text-accent'
                    : 'bg-card-raised border-border text-ink'
                )}
              >
                {isSaved
                  ? <><BookmarkCheck size={16} /> {showRemove ? 'Remove' : 'Saved'}</>
                  : <><Bookmark size={16} /> Save</>
                }
              </button>
            </div>

            {/* Last.fm insights */}
            {stats && stats.listenCount > 0 && (
              <div className="mx-4 mb-4 bg-card-raised rounded-xl p-3 border border-border">
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-2">LAST.FM INSIGHTS</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['LISTENS', stats.listenCount],
                    ['BACKGROUND', stats.backgroundCount],
                    ['SCROBBLES', stats.rawScrobbles],
                    ['FIRST HEARD', stats.firstHeard],
                    ['LAST HEARD', stats.lastHeard],
                    ['PEAK MONTH', stats.peakMonth],
                  ].map(([label, val]) => (
                    <div key={label as string} className="text-center">
                      <p className="text-[10px] text-ink-subtle tracking-wider">{label}</p>
                      <p className="text-sm font-bold text-ink mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar */}
            {similar.length > 0 && (
              <div className="px-4 pb-6">
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-2">SIMILAR IN LIBRARY</p>
                <div className="grid grid-cols-2 gap-2">
                  {similar.map(a => {
                    const aKey = `${a.artists[0]?.name}||${a.name}`
                    const aStats = lastfmMap.get(aKey)
                    const maxListens = Math.max(...similar.map(s => lastfmMap.get(`${s.artists[0]?.name}||${s.name}`)?.listenCount ?? 0), 1)
                    const pct = Math.round(((aStats?.listenCount ?? 0) / maxListens) * 100)
                    return (
                      <div key={a.id} className="bg-card-raised rounded-xl p-2 border border-border">
                        <img src={getAlbumCover(a)} alt={a.name} className="w-full aspect-square rounded-lg object-cover mb-1.5" decoding="async" />
                        <p className="text-xs font-semibold text-ink truncate">{a.name}</p>
                        <p className="text-[10px] text-ink-muted truncate">{a.artists[0]?.name}</p>
                        <div className="mt-1.5 h-0.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Track list */}
            {album.tracks?.items?.length > 0 && (
              <div className="px-4 pb-8">
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-2">TRACKS</p>
                {album.tracks.items.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                    <span className="text-[11px] text-ink-subtle w-4 text-right">{t.track_number}</span>
                    <span className="flex-1 text-sm text-ink truncate">{t.name}</span>
                    <span className="text-[11px] text-ink-subtle">{formatDuration(t.duration_ms)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
