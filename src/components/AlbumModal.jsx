import { useState, useCallback, useEffect } from 'react'
import { addToQueue } from '../lib/spotify-api.js'

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

function fmtType(t) {
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ── Component ─────────────────────────────────────────────────────────

export default function AlbumModal({ album, stats, saved, onSave, onRemove, onClose }) {
  const [queueStatus, setQueueStatus] = useState(null)
  const [queuing,     setQueuing]     = useState(false)

  const art    = album.images?.[0]?.url
  const artist = (album.artists || []).map(a => a.name).join(', ')
  const year   = (album.release_date || '').substring(0, 4)
  const tracks = album.tracks?.items || []

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleQueue = useCallback(async () => {
    const uris = tracks.filter(t => t?.uri).map(t => t.uri)
    if (!uris.length) {
      setQueueStatus({ msg: 'No tracks found', error: true })
      setTimeout(() => setQueueStatus(null), 2500)
      return
    }
    setQueuing(true)
    try {
      for (const uri of uris) await addToQueue(uri)
      setQueueStatus({ msg: `"${album.name}" added to queue`, error: false })
    } catch (e) {
      setQueueStatus({ msg: e.message, error: true })
    }
    setQueuing(false)
    setTimeout(() => setQueueStatus(null), 2500)
  }, [tracks, album.name])

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="relative w-full bg-white rounded-t-2xl max-h-[90dvh] flex flex-col shadow-2xl">

        {/* Drag handle / close tap target */}
        <div
          className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-pointer"
          onClick={onClose}
        >
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-4 pb-8 scrollbar-hide">

          {/* Header: cover + info */}
          <div className="flex gap-4 pb-4">
            <div className="w-[96px] h-[96px] rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              {art
                ? <img src={art} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl">💿</div>
              }
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <p className="text-[17px] font-semibold text-ink leading-snug line-clamp-2">{album.name}</p>
              <p className="text-[13px] text-ink-secondary truncate">{artist}</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {[year, fmtType(album.album_type), tracks.length ? `${tracks.length} tracks` : null]
                  .filter(Boolean).join(' · ')}
              </p>
              {/* Listen count badge */}
              {stats?.listenCount > 0 && (
                <span className="inline-flex self-start items-center mt-1 px-2 py-0.5 rounded-full
                                 text-[10px] font-medium bg-badge-listen-bg text-badge-listen">
                  {stats.listenCount}× heard
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 py-4 border-t border-gray-50">
            {queueStatus && (
              <div className={`px-3 py-2 rounded-xl text-[12px] font-medium
                ${queueStatus.error ? 'bg-[#FCEBEB] text-[#A32D2D]' : 'bg-badge-listen-bg text-badge-listen'}`}>
                {queueStatus.msg}
              </div>
            )}
            <button
              onClick={handleQueue}
              disabled={queuing}
              className="w-full bg-ink text-white text-[13px] font-medium py-3 rounded-xl
                         active:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {queuing ? 'Queuing…' : 'Queue to Spotify'}
            </button>
            {onSave && (
              <button
                onClick={() => saved ? onRemove(album.id) : onSave(album)}
                className={`w-full text-[13px] font-medium py-3 rounded-xl transition-colors
                  ${saved
                    ? 'bg-gray-50 text-ink-muted'
                    : 'border border-ink bg-white text-ink active:bg-gray-50'
                  }`}
              >
                {saved ? 'Saved ✓' : 'Save for Later'}
              </button>
            )}
          </div>

          {/* Last.fm stats */}
          {stats && stats.listenCount > 0 && (
            <div className="py-4 border-t border-gray-50">
              <p className="text-[10px] font-medium text-ink-muted uppercase tracking-wide mb-2.5">
                Last.fm
              </p>
              <div className="grid grid-cols-2 gap-y-1.5">
                {[
                  ['Listens',    stats.listenCount ? `${stats.listenCount}×` : null],
                  ['Background', stats.backgroundCount ? `${stats.backgroundCount}×` : null],
                  ['First heard', fmtDate(stats.firstHeard)],
                  ['Last heard',  fmtDate(stats.lastHeard)],
                  ['Peak month',  stats.peakMonth],
                  ['Scrobbles',   stats.rawScrobbles ? String(stats.rawScrobbles) : null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-ink-muted">{label}</p>
                    <p className="text-[12px] font-medium text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Track list */}
          {tracks.length > 0 && (
            <div className="py-4 border-t border-gray-50">
              <p className="text-[10px] font-medium text-ink-muted uppercase tracking-wide mb-2.5">
                Tracks
              </p>
              <div>
                {tracks.map((track, i) => (
                  <div key={track.id || i}
                       className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-[11px] text-ink-muted w-5 text-right flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-[13px] text-ink truncate">{track.name}</span>
                    {track.duration_ms > 0 && (
                      <span className="text-[11px] text-ink-muted flex-shrink-0">
                        {fmtDuration(track.duration_ms)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
