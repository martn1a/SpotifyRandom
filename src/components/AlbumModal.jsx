import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { addToQueue } from '../lib/spotify-api.js'
import { cn } from '../lib/utils.js'
import { getAlbumBadges, getSimilarAlbums } from '../lib/badge-utils.js'

// ── Helpers ───────────────────────────────────────────────────────────

function fmtDuration(ms) {
  if (!ms) return ''
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function fmtDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────

export default function AlbumModal({
  album,
  stats,
  saved,
  onSave,
  onRemove,
  onClose,
  onQueue,
  library = [],
  onBadgeClick,
}) {
  const [queueStatus, setQueueStatus] = useState(null)
  const [isBurning,   setIsBurning]   = useState(false)
  const [currentAlbum, setCurrentAlbum] = useState(album)

  // Sync current album when prop changes (new modal open)
  useEffect(() => {
    setCurrentAlbum(album)
    setIsBurning(false)
  }, [album])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const art     = currentAlbum.images?.[0]?.url
  const artist  = (currentAlbum.artists || []).map(a => a.name).join(', ')
  const year    = (currentAlbum.release_date || '').substring(0, 4)
  const tracks  = currentAlbum.tracks?.items || []
  const badges  = getAlbumBadges(currentAlbum, stats)
  const similar = getSimilarAlbums(currentAlbum, library, 4)

  const triggerBurn = useCallback(async (action) => {
    setIsBurning(true)
    await new Promise(r => setTimeout(r, 400))
    action()
    onClose()
  }, [onClose])

  const handleQueue = useCallback(async () => {
    const uris = tracks.filter(t => t?.uri).map(t => t.uri)
    if (!uris.length) {
      setQueueStatus({ msg: 'No tracks found', error: true })
      setTimeout(() => setQueueStatus(null), 2500)
      return
    }
    await triggerBurn(async () => {
      try {
        for (const uri of uris) await addToQueue(uri)
        onQueue?.(currentAlbum)
        setQueueStatus({ msg: `"${currentAlbum.name}" added to queue`, error: false })
      } catch (e) {
        setQueueStatus({ msg: e.message, error: true })
      }
    })
  }, [tracks, currentAlbum, onQueue, triggerBurn])

  const handleSave = useCallback(() => {
    triggerBurn(() => {
      if (saved) onRemove(currentAlbum)
      else onSave(currentAlbum)
    })
  }, [saved, currentAlbum, onSave, onRemove, triggerBurn])

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
      />
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{
          y: isBurning ? '20%' : 0,
          opacity: isBurning ? 0 : 1,
          scale: isBurning ? 0.92 : 1,
          filter: isBurning ? 'blur(8px)' : 'blur(0px)',
        }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag={isBurning ? false : 'y'}
        dragConstraints={{ top: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.y > 150 || info.velocity.y > 500) onClose()
        }}
        className="fixed bottom-0 left-0 right-0 max-h-[92vh] bg-card border-t border-border-subtle z-50 rounded-t-[2rem] overflow-hidden flex flex-col touch-none"
        style={{ boxShadow: '0 -20px 50px rgba(0,0,0,0.5)' }}
      >
        {/* Drag handle */}
        <div className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1.5 bg-border-subtle rounded-full" />
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-12">
          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
              {badges.map(badge => (
                <button
                  key={badge.value}
                  onClick={() => onBadgeClick?.(badge)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95',
                    badge.color
                  )}
                >
                  <span>{badge.icon}</span>
                  <span>{badge.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="flex gap-5 mb-6">
            <motion.div
              animate={{
                scale: isBurning ? 0.5 : 1,
                opacity: isBurning ? 0 : 1,
                rotate: isBurning ? -10 : 0,
              }}
              className="relative flex-shrink-0"
            >
              {art && (
                <img
                  src={art}
                  alt={currentAlbum.name}
                  className="w-24 h-24 rounded-xl shadow-2xl object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold leading-tight mb-0.5 line-clamp-2">{currentAlbum.name}</h2>
              <p className="text-ink-secondary truncate">{artist}</p>
              <p className="text-ink-muted text-sm mt-1">
                {year} · {currentAlbum.album_type} · {tracks.length} tracks
              </p>
              {stats?.listenCount > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full bg-accent/15 text-accent text-xs font-bold">
                  {stats.listenCount}× heard
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleQueue}
              disabled={isBurning}
              className="flex items-center justify-center gap-2 bg-accent text-page py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              ▶ Queue
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={isBurning}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl font-bold border transition-all disabled:opacity-50',
                saved
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-transparent border-border-subtle text-ink hover:bg-card-raised'
              )}
            >
              {saved ? '✓ Saved' : '+ Save for Later'}
            </motion.button>
          </div>

          {/* Queue status toast */}
          {queueStatus && (
            <p className={cn(
              'text-xs text-center mb-4 font-medium',
              queueStatus.error ? 'text-red-400' : 'text-accent'
            )}>
              {queueStatus.msg}
            </p>
          )}

          {/* Last.fm stats */}
          {stats?.listenCount > 0 && (
            <div className="mb-6">
              <h3 className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-3">Last.fm Insights</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Listens',     value: stats.listenCount },
                  { label: 'Background',  value: stats.backgroundCount ?? 0 },
                  { label: 'First heard', value: fmtDate(stats.firstHeard) },
                  { label: 'Last heard',  value: fmtDate(stats.lastHeard) },
                  { label: 'Peak month',  value: stats.peakMonth ?? '—' },
                  { label: 'Scrobbles',   value: stats.rawScrobbles ?? '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-card-raised p-3 rounded-xl border border-border-subtle">
                    <p className="text-ink-muted text-[9px] font-bold uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-ink text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar To */}
          {similar.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-ink-muted text-[10px] font-bold uppercase tracking-widest">Similar To</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Genre Match</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {similar.map(sim => (
                  <button
                    key={sim.id}
                    onClick={() => setCurrentAlbum(sim)}
                    className="bg-card-raised rounded-xl p-3 border border-border-subtle text-left hover:border-accent/30 transition-all flex gap-3 items-center group"
                  >
                    {sim.images?.[0]?.url && (
                      <img
                        src={sim.images[0].url}
                        alt={sim.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate group-hover:text-accent transition-colors">{sim.name}</p>
                      <p className="text-ink-muted text-[10px] truncate">{sim.artists?.[0]?.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Track list */}
          <div>
            <h3 className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-3">Tracks</h3>
            <div className="space-y-1">
              {tracks.map((t, i) => (
                <div
                  key={t.id || i}
                  className="flex items-center gap-3 py-2 border-b border-border-subtle/50 last:border-0"
                >
                  <span className="w-5 text-ink-muted text-xs text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{t.name}</span>
                  {t.duration_ms && (
                    <span className="text-ink-muted text-xs flex-shrink-0">{fmtDuration(t.duration_ms)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
