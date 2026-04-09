import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'
import { addToQueue } from '../../lib/spotify-api.js'
import AlbumModal from '../AlbumModal.jsx'

// ── Constants ─────────────────────────────────────────────────────────

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const DECADE_STARTS = { '60s': 1960, '70s': 1970, '80s': 1980, '90s': 1990, '00s': 2000, '10s': 2010, '20s': 2020 }
const NINETY_DAYS_MS  = 90 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS  = 30 * 24 * 60 * 60 * 1000
const BLOCKLIST_KW    = ['instrumental', 'remix', 'edit', 'live', 'reprise', 'version']
const PICK_COUNTS     = [1, 3, 5, 10]

const BUILTIN_PRESETS = [
  { id: 'surprise',  icon: '🎲', label: 'Surprise Me'    },
  { id: 'forgotten', icon: '💎', label: 'Forgotten Gems' },
  { id: 'deepcuts',  icon: '🕰', label: 'Deep Cuts'      },
]

// ── Helpers ───────────────────────────────────────────────────────────

function seededIndex(str, max) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h) % max
}

function albumDecade(album) {
  const year = parseInt((album.release_date || '').substring(0, 4))
  if (isNaN(year)) return null
  return Object.entries(DECADE_STARTS).find(([, s]) => year >= s && year < s + 10)?.[0] ?? null
}

function getGenreCluster(album) {
  for (const g of (album._genres || [])) {
    const id = clusterOf(g)
    if (id !== 'other') return GENRE_CLUSTERS.find(c => c.id === id) ?? null
  }
  return null
}

// Weighted random — returns index into the passed array
function weightedPickIndex(albums, getAlbumStats) {
  if (!albums.length) return -1
  const now = Date.now()
  const weighted = albums.map(a => {
    const stats = getAlbumStats(a)
    const listenCount = stats?.listenCount ?? 0
    const lastHeard   = stats?.lastHeard ?? null
    const w = listenCount === 0             ? 10
            : !lastHeard                    ? 5
            : now - lastHeard > NINETY_DAYS_MS ? 5
            : 1
    return w
  })
  const total = weighted.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < weighted.length; i++) {
    r -= weighted[i]
    if (r <= 0) return i
  }
  return weighted.length - 1
}

// ── Sub-components ────────────────────────────────────────────────────

function useScrollReveal(threshold = 0.1) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, visible]
}

function Chip({ label, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
      className={`flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full
                  text-[11px] font-medium transition-all duration-700 active:scale-[0.97]
        ${active
          ? 'bg-chip-active text-white ring-1 ring-accent/30 shadow-[0_0_10px_rgba(29,185,84,0.2)]'
          : 'bg-chip-inactive text-gray-600 ring-1 ring-black/5 hover:ring-black/10'
        }`}
    >
      {children || label}
    </button>
  )
}

function FeaturedAlbumCard({ album, stats, onQueue, onSave, onRemove, saved, onTap }) {
  const art     = album.images?.[0]?.url
  const artist  = (album.artists || []).map(a => a.name).join(', ')
  const cluster = getGenreCluster(album)
  const count   = stats?.listenCount ?? 0
  const year    = (album.release_date || '').substring(0, 4)
  const [revealRef, revealed] = useScrollReveal()

  return (
    <div
      ref={revealRef}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)',
        animation: revealed ? 'cardIn 0.4s cubic-bezier(0.32,0.72,0,1) both' : 'none',
      }}
      className="bg-card rounded-2xl border border-border-subtle overflow-hidden"
    >
      {/* Cover with badges overlay */}
      <div
        className="relative w-full aspect-square cursor-pointer active:opacity-90 transition-opacity duration-200"
        onClick={onTap}
      >
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover block" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-5xl bg-card-raised">💿</div>
        }

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {count > 0 && (
            <span
              className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{
                background: 'rgba(30,215,96,0.2)',
                color: '#1ed760',
                border: '1px solid rgba(30,215,96,0.3)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {count}×
            </span>
          )}
          {year && (
            <span
              className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#f0f0f0',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {year}
            </span>
          )}
        </div>

        {/* Swipe hints — bottom */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between pointer-events-none">
          <span
            className="px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#8a8a8a',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            ← Skip
          </span>
          <span
            className="px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{
              background: 'rgba(30,215,96,0.2)',
              color: '#1ed760',
              border: '1px solid rgba(30,215,96,0.3)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            Queue →
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 pt-3 pb-1 cursor-pointer" onClick={onTap}>
        <p className="text-[17px] font-bold text-ink leading-snug line-clamp-2">{album.name}</p>
        <p className="text-[13px] text-ink-secondary mt-1 truncate">{artist}</p>
        {cluster && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: 'rgba(138,138,255,0.15)', color: '#a0a0ff' }}
            >
              {cluster.icon} {cluster.label}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); onQueue(album) }}
          className="w-full py-3.5 rounded-xl text-[15px] font-bold transition-all duration-200 active:scale-[0.98]"
          style={{ background: '#1ed760', color: '#000' }}
        >
          ▶ Queue to Spotify
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); saved ? onRemove(album.id) : onSave(album) }}
          className="w-full py-3.5 rounded-xl text-[14px] font-semibold border border-border-subtle text-ink transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'transparent' }}
        >
          {saved ? 'Saved ✓' : '⏰ Save for Later'}
        </button>
      </div>
    </div>
  )
}

// ── SwipeableAlbumRow ─────────────────────────────────────────────────

function SwipeableAlbumRow({ album, stats, onQueue, onSave, onRemove, saved, onTap }) {
  const art    = album.images?.[album.images.length - 1]?.url
  const artist = (album.artists || []).map(a => a.name).join(', ')
  const count  = stats?.listenCount ?? 0

  const [offsetX, setOffsetX]   = useState(0)
  const [swiping, setSwiping]   = useState(false)
  const [done,    setDone]      = useState(false)
  const startXRef               = useRef(null)
  const pointerIdRef            = useRef(null)

  const THRESHOLD = 80
  const MAX_DRAG  = 120

  function onPointerDown(e) {
    startXRef.current   = e.clientX
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    setSwiping(true)
  }

  function onPointerMove(e) {
    if (startXRef.current === null) return
    const dx = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, e.clientX - startXRef.current))
    setOffsetX(dx)
  }

  function onPointerUp() {
    if (startXRef.current === null) return
    const dx = offsetX
    startXRef.current = null
    setSwiping(false)

    if (dx < -THRESHOLD) {
      // Left swipe → Queue
      setDone(true)
      onQueue(album)
    } else if (dx > THRESHOLD) {
      // Right swipe → Skip
      setDone(true)
    } else {
      setOffsetX(0)
    }
  }

  const [revealRef, revealed] = useScrollReveal()
  if (done) return null

  const progress = Math.abs(offsetX) / THRESHOLD // 0 → 1 as user drags to threshold
  const isLeft   = offsetX < -8
  const isRight  = offsetX > 8
  const leftOpacity  = isLeft  ? Math.min(1, progress) : 0
  const rightOpacity = isRight ? Math.min(1, progress) : 0

  const bgStyle = isLeft  ? `rgba(15, 110, 86, ${Math.min(0.15, progress * 0.15)})` :
                  isRight ? `rgba(180, 30, 30, ${Math.min(0.15, progress * 0.15)})`  : 'transparent'

  return (
    <div
      ref={revealRef}
      style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
      className={`relative overflow-hidden rounded-2xl ring-1 ring-black/[0.08] bg-white shadow-sm
                  transition-all duration-500
                  ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      {/* Hint overlays */}
      <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
        <span className="text-[11px] font-semibold text-[#0F6E56]" style={{ opacity: leftOpacity }}>🎵 Queue</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-end px-4 pointer-events-none">
        <span className="text-[11px] font-semibold text-[#A32D2D]" style={{ opacity: rightOpacity }}>✕ Skip</span>
      </div>

      {/* Row content */}
      <div
        className={`flex items-center gap-3 p-3 select-none ${swiping ? '' : 'transition-transform duration-150'}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          background: bgStyle,
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => { if (Math.abs(offsetX) < 5) onTap(album) }}
      >
        {/* Cover */}
        <div className="w-[56px] h-[56px] rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {art
            ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center text-lg">💿</div>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink leading-tight line-clamp-1">{album.name}</p>
          <p className="text-[11px] text-ink-muted mt-0.5 truncate">{artist}</p>
          {count > 0 && (
            <span className="inline-block mt-1 text-[9px] font-medium text-badge-listen">{count}× heard</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onQueue(album) }}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            className="px-3 py-1.5 bg-ink text-white text-[10px] font-semibold rounded-xl
                       active:opacity-70 transition-all duration-500"
          >
            Queue
          </button>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); saved ? onRemove(album.id) : onSave(album) }}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-xl active:opacity-70 transition-all duration-500
              ${saved ? 'bg-gray-100 text-ink-muted' : 'ring-1 ring-black/10 bg-white text-ink'}`}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MultiPickList ─────────────────────────────────────────────────────

function MultiPickList({ albums, getAlbumStats, onQueue, onSave, onRemove, isSaved, onTap, onQueueAll, onSaveAll }) {
  if (!albums.length) return null
  return (
    <div className="space-y-2">
      {albums.map(album => (
        <SwipeableAlbumRow
          key={album.id}
          album={album}
          stats={getAlbumStats(album)}
          onQueue={onQueue}
          onSave={onSave}
          onRemove={onRemove}
          saved={isSaved(album.id)}
          onTap={onTap}
        />
      ))}
      {albums.length > 1 && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={onQueueAll}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            className="flex-1 bg-ink text-white text-[12px] font-semibold py-3 rounded-2xl
                       transition-all duration-700 active:scale-[0.98]
                       hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
          >
            Queue All
          </button>
          <button
            onClick={onSaveAll}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            className="flex-1 ring-1 ring-black/10 bg-white text-ink text-[12px] font-medium py-3 rounded-2xl
                       transition-all duration-700 active:scale-[0.98]"
          >
            Save All
          </button>
        </div>
      )}
    </div>
  )
}

// ── FilterModal ───────────────────────────────────────────────────────

function FilterModal({ draftFilters, draftToggles, setDraftFilters, setDraftToggles, onApply, onClose, activeFilterCount }) {
  function toggleDraftFilter(f) {
    setDraftFilters(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  function toggleDraftToggle(key) {
    setDraftToggles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const draftCount = draftFilters.size
    + (draftToggles.weightUnheard ? 1 : 0)
    + (draftToggles.excludeKeywords ? 1 : 0)
    + (draftToggles.avoidRecent ? 1 : 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        style={{ animation: 'toastIn 0.4s cubic-bezier(0.32,0.72,0,1) both' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50
                   bg-page rounded-t-[2rem]
                   ring-1 ring-black/[0.08]
                   shadow-[0_-8px_40px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,1)]
                   max-h-[88vh] flex flex-col"
        style={{ animation: 'sheetUp 0.55s cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* Drag pill */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-black/10" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                             bg-accent-dim ring-1 ring-accent/20 text-accent-text
                             text-[9px] font-bold uppercase tracking-widest">
              FILTERS
            </span>
            {draftCount > 0 && (
              <span className="text-[11px] text-ink-muted">{draftCount} active</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-chip-inactive ring-1 ring-black/5
                       flex items-center justify-center text-ink-muted text-[18px] leading-none
                       active:scale-[0.92] transition-transform duration-300"
          >
            ×
          </button>
        </div>

        {/* Scrollable content — staggered sections */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-5">

          {/* Decades */}
          <div style={{ animation: 'sheetUp 0.55s cubic-bezier(0.32,0.72,0,1) 0.05s both' }}>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Decades</p>
            <div className="flex flex-wrap gap-2">
              {DECADES.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDraftFilter(d)}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-700 active:scale-[0.96]
                    ${draftFilters.has(d)
                      ? 'bg-chip-active text-white ring-1 ring-accent/30 shadow-[0_0_8px_rgba(29,185,84,0.15)]'
                      : 'bg-chip-inactive text-gray-600 ring-1 ring-black/5 hover:ring-black/10'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Genres */}
          <div style={{ animation: 'sheetUp 0.55s cubic-bezier(0.32,0.72,0,1) 0.10s both' }}>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Genres</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_CLUSTERS.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleDraftFilter(c.id)}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] font-medium
                              transition-all duration-700 active:scale-[0.96]
                    ${draftFilters.has(c.id)
                      ? 'bg-chip-active text-white ring-1 ring-accent/30 shadow-[0_0_8px_rgba(29,185,84,0.15)]'
                      : 'bg-chip-inactive text-gray-600 ring-1 ring-black/5 hover:ring-black/10'}`}
                >
                  <span>{c.icon}</span><span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Heard status */}
          <div style={{ animation: 'sheetUp 0.55s cubic-bezier(0.32,0.72,0,1) 0.15s both' }}>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Listening history</p>
            <div className="flex flex-wrap gap-2">
              {['Never heard', 'Not recently played'].map(label => (
                <button
                  key={label}
                  onClick={() => toggleDraftFilter(label)}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-700 active:scale-[0.96]
                    ${draftFilters.has(label)
                      ? 'bg-chip-active text-white ring-1 ring-accent/30 shadow-[0_0_8px_rgba(29,185,84,0.15)]'
                      : 'bg-chip-inactive text-gray-600 ring-1 ring-black/5 hover:ring-black/10'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div style={{ animation: 'sheetUp 0.55s cubic-bezier(0.32,0.72,0,1) 0.20s both' }}>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Preferences</p>
            <div className="space-y-2">
              {[
                { key: 'weightUnheard',   label: '⚖ Weighted',            desc: 'Unheard albums 10× more likely' },
                { key: 'excludeKeywords', label: '🚫 No Remixes',          desc: 'Filters live/remix/edit/version' },
                { key: 'avoidRecent',     label: '🕐 Not Recently Queued', desc: 'Skips albums queued in last 30 days' },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => toggleDraftToggle(key)}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl
                             bg-white ring-1 ring-black/[0.06] active:opacity-70 transition-all duration-500"
                >
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-ink">{label}</p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{desc}</p>
                  </div>
                  {/* Sliding pill toggle */}
                  <div
                    style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                    className={`w-11 h-6 rounded-full relative flex-shrink-0 ring-1 transition-all duration-500
                      ${draftToggles[key] ? 'bg-chip-active ring-accent/30' : 'bg-chip-inactive ring-black/10'}`}
                  >
                    <div
                      style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-500
                        ${draftToggles[key] ? 'left-[22px]' : 'left-0.5'}`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Apply — Button-in-Button */}
        <div className="px-4 py-4 flex-shrink-0 pb-safe border-t border-border-subtle">
          <button
            onClick={onApply}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            className="group w-full flex items-center justify-between
                       bg-ink text-white font-semibold
                       pl-5 pr-2 py-2 rounded-2xl
                       transition-all duration-700 active:scale-[0.98]
                       hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
          >
            <span className="text-[15px]">
              {draftCount > 0 ? `Apply ${draftCount} filter${draftCount > 1 ? 's' : ''}` : 'Apply'}
            </span>
            <span
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/15
                         transition-transform duration-700
                         group-hover:translate-x-1 group-hover:-translate-y-[1px]"
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────

export default function DiscoverTab({ albums, getAlbumStats, saveLater, removeLater, isSaved }) {
  const [activeFilters,   setActiveFilters]  = useState(new Set())
  const [toggles,         setToggles]        = useState({ weightUnheard: false, excludeKeywords: false, avoidRecent: false })
  const [activePreset,    setActivePreset]   = useState(null)
  const [customPresets,   setCustomPresets]  = useState(
    () => JSON.parse(localStorage.getItem('discover_presets') || '[]')
  )
  const [queueHistory,    setQueueHistory]   = useState(
    () => JSON.parse(localStorage.getItem('discover_queue_history') || '{}')
  )
  const [showSavePreset,  setShowSavePreset] = useState(false)
  const [presetName,      setPresetName]     = useState('')
  const [pickCount,       setPickCount]      = useState(1)
  const [pickedAlbums,    setPickedAlbums]   = useState([])
  const [selectedAlbum,   setSelectedAlbum]  = useState(null)
  const [queueStatus,     setQueueStatus]    = useState(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [draftFilters,    setDraftFilters]   = useState(new Set())
  const [draftToggles,    setDraftToggles]   = useState({ weightUnheard: false, excludeKeywords: false, avoidRecent: false })

  // ── Filter helpers ─────────────────────────────────────────────────

  function toggleFilter(f) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
    setActivePreset(null)
    setPickedAlbums([])
  }

  function setToggle(key, val) {
    setToggles(prev => ({ ...prev, [key]: val }))
    setActivePreset(null)
    setPickedAlbums([])
  }

  // ── Presets ────────────────────────────────────────────────────────

  function applyPreset(id) {
    if (id === 'surprise') {
      setActiveFilters(new Set())
      setToggles({ weightUnheard: false, excludeKeywords: false, avoidRecent: false })
    } else if (id === 'forgotten') {
      setActiveFilters(new Set(['Never heard']))
      setToggles({ weightUnheard: true, excludeKeywords: true, avoidRecent: false })
    } else if (id === 'deepcuts') {
      setActiveFilters(new Set(['70s', '80s', '90s', '00s']))
      setToggles({ weightUnheard: false, excludeKeywords: true, avoidRecent: true })
    } else {
      const cp = customPresets.find(p => p.id === id)
      if (cp) {
        setActiveFilters(new Set(cp.savedFilters))
        setToggles(cp.savedToggles)
      }
    }
    setActivePreset(id)
    setPickedAlbums([])
  }

  function savePreset() {
    const name = presetName.trim()
    if (!name) return
    const preset = {
      id: 'c_' + Date.now(),
      name,
      savedFilters: [...activeFilters],
      savedToggles: { ...toggles },
    }
    const updated = [...customPresets, preset]
    setCustomPresets(updated)
    localStorage.setItem('discover_presets', JSON.stringify(updated))
    setActivePreset(preset.id)
    setShowSavePreset(false)
    setPresetName('')
  }

  function deleteCustomPreset(id) {
    const updated = customPresets.filter(p => p.id !== id)
    setCustomPresets(updated)
    localStorage.setItem('discover_presets', JSON.stringify(updated))
    if (activePreset === id) setActivePreset(null)
  }

  const activeFilterCount = activeFilters.size
    + (toggles.weightUnheard ? 1 : 0)
    + (toggles.excludeKeywords ? 1 : 0)
    + (toggles.avoidRecent ? 1 : 0)

  function openFilterModal() {
    setDraftFilters(new Set(activeFilters))
    setDraftToggles({ ...toggles })
    setFilterModalOpen(true)
  }

  function applyFilters() {
    setActiveFilters(draftFilters)
    setToggles(draftToggles)
    setActivePreset(null)
    setPickedAlbums([])
    setFilterModalOpen(false)
  }

  function removeActiveFilter(f) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.delete(f)
      return next
    })
    setActivePreset(null)
    setPickedAlbums([])
  }

  function removeActiveToggle(key) {
    setToggles(prev => ({ ...prev, [key]: false }))
    setActivePreset(null)
    setPickedAlbums([])
  }

  // ── Filtered album pool ────────────────────────────────────────────

  const filteredAlbums = useMemo(() => {
    const activeDecades       = DECADES.filter(d => activeFilters.has(d))
    const activeGenreClusters = GENRE_CLUSTERS.filter(c => activeFilters.has(c.id))
    const now = Date.now()

    return albums.filter(a => {
      if (activeDecades.length && !activeDecades.includes(albumDecade(a))) return false
      if (activeGenreClusters.length) {
        const albumClusters = new Set((a._genres || []).map(clusterOf))
        if (!activeGenreClusters.some(c => albumClusters.has(c.id))) return false
      }
      const stats = getAlbumStats(a)
      if (activeFilters.has('Never heard') && (stats?.listenCount ?? 0) > 0) return false
      if (activeFilters.has('Not recently played')) {
        const lh = stats?.lastHeard
        if (lh && now - lh <= NINETY_DAYS_MS) return false
      }
      if (toggles.excludeKeywords) {
        const l = (a.name || '').toLowerCase()
        if (BLOCKLIST_KW.some(k => l.includes(k))) return false
      }
      if (toggles.avoidRecent && queueHistory[a.id]) {
        if (now - queueHistory[a.id] < THIRTY_DAYS_MS) return false
      }
      return true
    })
  }, [albums, activeFilters, toggles, queueHistory, getAlbumStats])

  // ── Actions ────────────────────────────────────────────────────────

  function pickRandom() {
    if (!filteredAlbums.length) return
    const pool = [...filteredAlbums]
    const picks = []
    const n = Math.min(pickCount, pool.length)
    for (let i = 0; i < n; i++) {
      const idx = toggles.weightUnheard
        ? weightedPickIndex(pool, getAlbumStats)
        : Math.floor(Math.random() * pool.length)
      if (idx < 0) break
      picks.push(pool[idx])
      pool.splice(idx, 1)
    }
    setPickedAlbums(picks)
  }

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
      setQueueHistory(prev => {
        const next = { ...prev, [album.id]: Date.now() }
        localStorage.setItem('discover_queue_history', JSON.stringify(next))
        return next
      })
      setQueueStatus({ msg: `"${album.name}" added to queue`, error: false })
    } catch (e) {
      setQueueStatus({ msg: e.message, error: true })
    }
    setTimeout(() => setQueueStatus(null), 2500)
    // Remove from multi-pick list
    setPickedAlbums(prev => prev.filter(a => a.id !== album.id))
  }, [])

  function handleSave(album) {
    saveLater(album)
    setPickedAlbums(prev => prev.filter(a => a.id !== album.id))
  }

  function handleRemove(albumId) {
    removeLater(albumId)
  }

  async function handleQueueAll() {
    for (const album of [...pickedAlbums]) {
      await handleQueue(album)
    }
  }

  function handleSaveAll() {
    for (const album of [...pickedAlbums]) {
      saveLater(album)
    }
    setPickedAlbums([])
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Filter section ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-page/95 px-4 pt-3 pb-2 space-y-1.5 border-b border-border-subtle">

        {/* Row A: Presets */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {BUILTIN_PRESETS.map(p => (
            <Chip key={p.id} active={activePreset === p.id} onClick={() => applyPreset(p.id)}>
              {p.icon} {p.label}
            </Chip>
          ))}
          {customPresets.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
              className={`flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] font-medium
                          transition-all duration-700 active:scale-[0.97]
                ${activePreset === p.id
                  ? 'bg-chip-active text-white ring-1 ring-accent/30 shadow-[0_0_10px_rgba(29,185,84,0.2)]'
                  : 'bg-accent-dim text-accent-text ring-1 ring-accent/20'}`}
            >
              ⭐ {p.name}
              <span
                onClick={e => { e.stopPropagation(); deleteCustomPreset(p.id) }}
                className="ml-0.5 opacity-50 hover:opacity-100 text-[10px] leading-none"
              >
                ✕
              </span>
            </button>
          ))}
        </div>

        {/* Row B: Filter button + active chips */}
        <div className="flex gap-2 items-center overflow-x-auto scrollbar-hide">
          {/* Filter trigger */}
          <button
            onClick={openFilterModal}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium
                        transition-all duration-700 active:scale-[0.97]
              ${activeFilterCount > 0
                ? 'bg-ink text-white ring-1 ring-black/20'
                : 'bg-chip-inactive text-gray-600 ring-1 ring-black/5 hover:ring-black/10'}`}
          >
            ⚙ Filters
            {activeFilterCount > 0 && (
              <span className="bg-white/25 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active filter chips (dismissible) */}
          {[...activeFilters].map(f => (
            <button
              key={f}
              onClick={() => removeActiveFilter(f)}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium
                         bg-accent-dim text-accent-text ring-1 ring-accent/20
                         transition-all duration-500 active:scale-[0.96]"
            >
              {f}
              <span className="text-[9px] opacity-60">✕</span>
            </button>
          ))}
          {toggles.weightUnheard && (
            <button onClick={() => removeActiveToggle('weightUnheard')}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium
                         bg-accent-dim text-accent-text ring-1 ring-accent/20
                         transition-all duration-500 active:scale-[0.96]">
              ⚖ Weighted <span className="text-[9px] opacity-60">✕</span>
            </button>
          )}
          {toggles.excludeKeywords && (
            <button onClick={() => removeActiveToggle('excludeKeywords')}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium
                         bg-accent-dim text-accent-text ring-1 ring-accent/20
                         transition-all duration-500 active:scale-[0.96]">
              🚫 No Remixes <span className="text-[9px] opacity-60">✕</span>
            </button>
          )}
          {toggles.avoidRecent && (
            <button onClick={() => removeActiveToggle('avoidRecent')}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium
                         bg-accent-dim text-accent-text ring-1 ring-accent/20
                         transition-all duration-500 active:scale-[0.96]">
              🕐 Not Recently Queued <span className="text-[9px] opacity-60">✕</span>
            </button>
          )}

          {/* Save preset button — only when custom filter combo active without preset */}
          {activeFilterCount > 0 && !activePreset && (
            <button
              onClick={() => setShowSavePreset(v => !v)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium
                         ring-1 ring-dashed ring-gray-300 text-gray-500 hover:ring-gray-400"
            >
              + Save
            </button>
          )}
        </div>

        {/* Save preset inline input */}
        {showSavePreset && (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowSavePreset(false) }}
              placeholder="Preset name…"
              maxLength={24}
              className="flex-1 bg-white border border-border-subtle rounded-xl px-3 py-1.5
                         text-[12px] text-ink outline-none focus:border-accent transition-all duration-500
                         placeholder:text-ink-muted"
              style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            />
            <button onClick={savePreset} className="text-[11px] font-medium text-ink px-2 py-1.5">Save</button>
            <button onClick={() => setShowSavePreset(false)} className="text-[11px] text-ink-muted px-1 py-1.5">✕</button>
          </div>
        )}
      </div>

      {/* ── Queue status toast (fixed bottom) ──────────────────────── */}
      {queueStatus && (
        <div
          className={`fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-50
                      rounded-2xl px-4 py-2.5 text-[12px] font-medium text-center shadow-lg
            ${queueStatus.error
              ? 'bg-white border border-red-200 text-red-600'
              : 'bg-white border border-accent/20 text-accent-text'
            }`}
          style={{ animation: 'toastIn 0.4s cubic-bezier(0.32,0.72,0,1) both' }}
        >
          {queueStatus.msg}
        </div>
      )}

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">

        {/* Random Picker */}
        <section className="pt-4">

          {/* Eyebrow + pool count */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                             bg-accent-dim ring-1 ring-accent/20 text-accent-text
                             text-[9px] font-bold uppercase tracking-widest">
              RANDOM PICK
            </span>
            <span className="text-[10px] text-ink-muted">{filteredAlbums.length} in pool</span>
          </div>

          {filteredAlbums.length === 0
            ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-chip-inactive ring-1 ring-black/5
                                flex items-center justify-center text-3xl mx-auto mb-4">🔍</div>
                <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-2">No results</p>
                <p className="text-[15px] font-semibold text-ink">No albums match</p>
                <p className="text-[12px] text-ink-muted mt-1">Try removing some filters</p>
              </div>
            )
            : (
              <>
                {/* Count selector — segmented pill */}
                <div className="inline-flex items-center bg-chip-inactive ring-1 ring-black/5 rounded-full p-1 gap-0.5 mb-4">
                  {PICK_COUNTS.map(n => (
                    <button
                      key={n}
                      onClick={() => { setPickCount(n); setPickedAlbums([]) }}
                      style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                      className={`w-10 h-8 rounded-full text-[12px] font-semibold transition-all duration-500 active:scale-[0.96]
                        ${pickCount === n
                          ? 'bg-white text-ink shadow-sm ring-1 ring-black/5'
                          : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* Pick CTA — Button-in-Button */}
                <button
                  onClick={pickRandom}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  className="group w-full flex items-center justify-between
                             bg-ink text-white font-semibold
                             pl-5 pr-2 py-2 rounded-2xl mb-5
                             transition-all duration-700
                             hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]
                             active:scale-[0.98]"
                >
                  <span className="text-[15px]">
                    {pickCount === 1 ? 'Pick an Album' : `Pick ${pickCount} Albums`}
                  </span>
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-white/15
                               transition-transform duration-700
                               group-hover:translate-x-1 group-hover:-translate-y-[1px]"
                    style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </span>
                </button>

                {/* Results */}
                {pickedAlbums.length > 0 && (
                  <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.32,0.72,0,1) both' }}>
                    {pickCount === 1
                      ? (
                        <FeaturedAlbumCard
                          album={pickedAlbums[0]}
                          stats={getAlbumStats(pickedAlbums[0])}
                          onQueue={handleQueue}
                          onSave={handleSave}
                          onRemove={handleRemove}
                          saved={isSaved(pickedAlbums[0].id)}
                          onTap={() => setSelectedAlbum(pickedAlbums[0])}
                        />
                      )
                      : (
                        <MultiPickList
                          albums={pickedAlbums}
                          getAlbumStats={getAlbumStats}
                          onQueue={handleQueue}
                          onSave={handleSave}
                          onRemove={handleRemove}
                          isSaved={isSaved}
                          onTap={setSelectedAlbum}
                          onQueueAll={handleQueueAll}
                          onSaveAll={handleSaveAll}
                        />
                      )
                    }
                  </div>
                )}
              </>
            )
          }
        </section>

        <div className="h-8 pb-safe" />
      </div>

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={getAlbumStats(selectedAlbum)}
          saved={isSaved(selectedAlbum.id)}
          onSave={(album) => { handleSave(album); setSelectedAlbum(null) }}
          onRemove={handleRemove}
          onClose={() => setSelectedAlbum(null)}
          onQueue={(album) => { handleQueue(album); setSelectedAlbum(null) }}
        />
      )}

      {filterModalOpen && (
        <FilterModal
          draftFilters={draftFilters}
          draftToggles={draftToggles}
          setDraftFilters={setDraftFilters}
          setDraftToggles={setDraftToggles}
          onApply={applyFilters}
          onClose={() => setFilterModalOpen(false)}
          activeFilterCount={activeFilterCount}
        />
      )}
    </div>
  )
}
