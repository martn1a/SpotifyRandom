import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react'
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

function Chip({ label, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full
                  text-[12px] font-medium transition-all duration-200 active:scale-[0.97] border
        ${active
          ? 'bg-accent border-accent text-black font-semibold'
          : 'bg-card-raised border-border-subtle text-ink-secondary hover:text-ink'
        }`}
    >
      {children || label}
    </button>
  )
}

function PresetSheet({ open, onClose, presets, customPresets, activePreset, onSelect, onDelete }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ps-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.div
            key="ps-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-card border-t border-border-subtle z-50 rounded-t-[2rem] overflow-hidden flex flex-col"
          >
            {/* Drag pill */}
            <div className="flex justify-center py-3 flex-shrink-0">
              <div className="w-10 h-1.5 bg-border-subtle rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4 flex-shrink-0">
              <h2 className="text-[16px] font-bold text-ink tracking-tight">Discovery Mode</h2>
              <button onClick={onClose} className="text-ink-muted text-xl leading-none active:text-ink">✕</button>
            </div>
            {/* List */}
            <div className="overflow-y-auto flex-1 px-5 pb-8">
              {/* Built-ins */}
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.id); onClose() }}
                  className={`w-full flex items-center gap-3 py-3 border-b border-border-subtle/50 last:border-0 text-left ${activePreset === p.id ? 'border-l-2 border-l-accent pl-3' : ''}`}
                >
                  <span className="text-xl flex-shrink-0">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-ink">{p.label}</p>
                    <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mt-0.5">Smart Algorithm</p>
                  </div>
                  {activePreset === p.id && <span className="text-accent text-lg flex-shrink-0">✓</span>}
                </button>
              ))}
              {/* Custom presets */}
              {customPresets.map(p => {
                const filterCount = (p.filters?.length ?? 0) + Object.values(p.toggles ?? {}).filter(Boolean).length
                return (
                  <div key={p.id} className={`flex items-center gap-3 py-3 border-b border-border-subtle/50 last:border-0 ${activePreset === p.id ? 'border-l-2 border-l-accent pl-3' : ''}`}>
                    <button
                      onClick={() => { onSelect(p.id); onClose() }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <span className="text-xl flex-shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-ink">{p.label}</p>
                        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mt-0.5">{filterCount} Filter{filterCount !== 1 ? 's' : ''} Active</p>
                      </div>
                      {activePreset === p.id && <span className="text-accent text-lg flex-shrink-0">✓</span>}
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="flex-shrink-0 text-[11px] font-bold text-red-400 px-2 py-1 rounded active:opacity-70"
                    >
                      Delete
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function FeaturedAlbumCard({ album, stats, onQueue, onSkip, onTap }) {
  const art     = album.images?.[0]?.url
  const artist  = (album.artists || []).map(a => a.name).join(', ')
  const cluster = getGenreCluster(album)
  const count   = stats?.listenCount ?? 0
  const year    = (album.release_date || '').substring(0, 4)
  const [gone, setGone] = useState(false)

  const x            = useMotionValue(0)
  const leftOpacity  = useTransform(x, [-80, -20], [1, 0])
  const rightOpacity = useTransform(x, [20, 80], [0, 1])

  if (gone) return null

  return (
    <div className="relative rounded-2xl overflow-hidden select-none">
      {/* Cover with framer-motion drag + badges overlay */}
      <motion.div
        className="relative w-full aspect-square overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80 || info.velocity.x < -500) {
            setGone(true)
            onSkip()
          } else if (info.offset.x > 80 || info.velocity.x > 500) {
            setGone(true)
            onQueue(album)
          }
        }}
        onClick={() => { if (Math.abs(x.get()) < 5) onTap() }}
      >
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover block select-none" draggable={false} loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-5xl bg-card-raised">💿</div>
        }

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {count > 0 && (
            <span className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{ background: 'rgba(30,215,96,0.2)', color: '#1ed760', border: '1px solid rgba(30,215,96,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              {count}×
            </span>
          )}
          {year && (
            <span className="px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#f0f0f0', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              {year}
            </span>
          )}
        </div>

        {/* Swipe overlays (driven by motion value) */}
        <motion.div className="absolute inset-0 flex items-center justify-start px-4 pointer-events-none"
             style={{ opacity: leftOpacity }}>
          <span className="text-[13px] font-bold px-3 py-1.5 rounded-lg"
                style={{ color: '#8a8a8a', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            ← Skip
          </span>
        </motion.div>
        <motion.div className="absolute inset-0 flex items-center justify-end px-4 pointer-events-none"
             style={{ opacity: rightOpacity }}>
          <span className="text-[13px] font-bold px-3 py-1.5 rounded-lg"
                style={{ color: '#1ed760', background: 'rgba(30,215,96,0.2)', backdropFilter: 'blur(8px)' }}>
            Queue →
          </span>
        </motion.div>

        {/* Static swipe hints — bottom (visible at rest) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between pointer-events-none">
          <span className="px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#8a8a8a', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            ← Skip
          </span>
          <span className="px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{ background: 'rgba(30,215,96,0.2)', color: '#1ed760', border: '1px solid rgba(30,215,96,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            Queue →
          </span>
        </div>
      </motion.div>

      {/* Metadata */}
      <div className="px-4 pt-3 pb-4 cursor-pointer" onClick={() => { if (Math.abs(x.get()) < 5) onTap() }}>
        <p className="text-[17px] font-bold text-ink leading-snug line-clamp-2">{album.name}</p>
        <p className="text-[13px] text-ink-secondary mt-1 truncate">{artist}</p>
        {cluster && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ background: 'rgba(138,138,255,0.15)', color: '#a0a0ff' }}>
              {cluster.icon} {cluster.label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SwipeableAlbumRow ─────────────────────────────────────────────────

function SwipeableAlbumRow({ album, stats, onQueue, onSave, onRemove, saved, onTap }) {
  const art    = album.images?.[0]?.url
  const artist = (album.artists || []).map(a => a.name).join(', ')
  const count  = stats?.listenCount ?? 0
  const year   = (album.release_date || '').substring(0, 4)
  const [done, setDone] = useState(false)

  const x            = useMotionValue(0)
  const leftOpacity  = useTransform(x, [-80, -20], [1, 0])
  const rightOpacity = useTransform(x, [20, 80], [0, 1])

  if (done) return null

  return (
    <div className="bg-card rounded-2xl border border-border-subtle overflow-hidden">
      {/* Cover with framer-motion drag */}
      <motion.div
        className="relative w-full aspect-square overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80 || info.velocity.x < -500) {
            // Left swipe → Skip
            setDone(true)
          } else if (info.offset.x > 80 || info.velocity.x > 500) {
            // Right swipe → Queue
            setDone(true)
            onQueue(album)
          }
        }}
        onClick={() => { if (Math.abs(x.get()) < 5) onTap(album) }}
      >
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover block select-none" draggable={false} loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-4xl bg-card-raised">💿</div>
        }

        {/* Top badge */}
        {count > 0 && (
          <div className="absolute top-2 left-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: 'rgba(30,215,96,0.2)', color: '#1ed760', border: '1px solid rgba(30,215,96,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              {count}×
            </span>
          </div>
        )}

        {/* Swipe overlays (driven by motion value) */}
        <motion.div className="absolute inset-0 flex items-center justify-start px-3 pointer-events-none"
             style={{ opacity: leftOpacity }}>
          <span className="text-[11px] font-bold px-2 py-1 rounded-md"
                style={{ color: '#8a8a8a', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
            ← Skip
          </span>
        </motion.div>
        <motion.div className="absolute inset-0 flex items-center justify-end px-3 pointer-events-none"
             style={{ opacity: rightOpacity }}>
          <span className="text-[11px] font-bold px-2 py-1 rounded-md"
                style={{ color: '#1ed760', background: 'rgba(30,215,96,0.2)', backdropFilter: 'blur(8px)' }}>
            Queue →
          </span>
        </motion.div>
      </motion.div>

      {/* Metadata */}
      <div className="px-4 pt-3 pb-4 cursor-pointer" onClick={() => onTap(album)}>
        <p className="text-[15px] font-bold text-ink leading-snug line-clamp-2">{album.name}</p>
        <p className="text-[12px] text-ink-secondary mt-0.5 truncate">{artist}</p>
        {year && <p className="text-[11px] text-ink-muted mt-0.5">{year}</p>}
      </div>
    </div>
  )
}

// ── MultiPickList ─────────────────────────────────────────────────────

function MultiPickList({ albums, getAlbumStats, onQueue, onSave, onRemove, isSaved, onTap, onQueueAll, onSaveAll }) {
  if (!albums.length) return null
  return (
    <div>
      {/* Vertical list */}
      <div className="flex flex-col gap-4">
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
      </div>

      {albums.length > 1 && (
        <div className="flex gap-3 pt-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onQueueAll}
            className="flex-1 py-3.5 rounded-xl text-[14px] font-bold"
            style={{ background: '#1ed760', color: '#000' }}
          >
            ▶ Queue All
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onSaveAll}
            className="flex-1 py-3.5 rounded-xl text-[14px] font-semibold border border-border-subtle text-ink"
            style={{ background: 'transparent' }}
          >
            Save All
          </motion.button>
        </div>
      )}
    </div>
  )
}

// ── FilterModal ───────────────────────────────────────────────────────

function FilterModal({ draftFilters, draftToggles, setDraftFilters, setDraftToggles, onApply, onClose, onSavePreset, activeFilterCount }) {
  const [presetName,     setPresetName]     = useState('')
  const [showNameInput,  setShowNameInput]  = useState(false)

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
    + (draftToggles.weightUnheard   ? 1 : 0)
    + (draftToggles.excludeKeywords ? 1 : 0)
    + (draftToggles.avoidRecent     ? 1 : 0)

  function handleSavePreset() {
    if (!showNameInput) { setShowNameInput(true); return }
    if (presetName.trim()) {
      onSavePreset(presetName.trim(), draftFilters, draftToggles)
      setShowNameInput(false)
      setPresetName('')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[1.75rem] border-t border-border-subtle max-h-[88vh] flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Drag pill */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-card-raised" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border-subtle">
          <span className="text-[15px] font-semibold text-ink">Filters</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-ink-secondary text-[18px] leading-none active:scale-[0.92] transition-transform duration-200"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-5 pt-4">

          {/* Decades */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Decades</p>
            <div className="flex flex-wrap gap-2">
              {DECADES.map(d => {
                const active = draftFilters.has(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleDraftFilter(d)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
                      active
                        ? 'border-accent bg-accent text-black font-semibold'
                        : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Genres */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Genres</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_CLUSTERS.map(c => {
                const active = draftFilters.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleDraftFilter(c.id)}
                    className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
                      active
                        ? 'border-accent bg-accent text-black font-semibold'
                        : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
                    }`}
                  >
                    <span>{c.icon}</span><span>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Listening history */}
          <div>
            <p className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mb-3">Listening History</p>
            <div className="flex flex-wrap gap-2">
              {['Never heard', 'Not recently played'].map(label => {
                const active = draftFilters.has(label)
                return (
                  <button
                    key={label}
                    onClick={() => toggleDraftFilter(label)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] border transition-all duration-200 active:scale-[0.96] ${
                      active
                        ? 'border-accent bg-accent text-black font-semibold'
                        : 'border-border-subtle bg-card-raised text-ink-secondary font-medium'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preferences */}
          <div>
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
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-card-raised border border-border-subtle active:opacity-70 transition-all duration-200"
                >
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-ink">{label}</p>
                    <p className="text-[10px] text-ink-muted mt-0.5">{desc}</p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full relative flex-shrink-0 border transition-all duration-300 ${
                      draftToggles[key] ? 'bg-accent border-accent' : 'bg-card border-border-subtle'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                        draftToggles[key] ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-4 flex-shrink-0 pb-safe border-t border-border-subtle space-y-2">
          {draftCount > 0 && (
            showNameInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                  placeholder="Preset name…"
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-xl bg-card-raised border border-border-subtle text-ink text-[13px] outline-none focus:border-accent"
                />
                <button
                  onClick={handleSavePreset}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold border border-accent text-accent transition-colors active:opacity-70"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={handleSavePreset}
                className="w-full py-3 rounded-xl text-[13px] font-semibold border border-border-subtle text-ink-secondary transition-colors active:opacity-70"
                style={{ background: 'transparent' }}
              >
                + Save as Preset
              </button>
            )
          )}

          <button
            onClick={onApply}
            className="w-full py-3.5 rounded-xl text-[15px] font-bold transition-all duration-200 active:scale-[0.98]"
            style={{ background: '#1ed760', color: '#000' }}
          >
            {draftCount > 0 ? `Apply ${draftCount} filter${draftCount > 1 ? 's' : ''} →` : 'Apply →'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────

export default function DiscoverTab({ albums, getAlbumStats, saveLater, removeLater, isSaved, onBadgeClick }) {
  const [activeFilters,   setActiveFilters]  = useState(new Set())
  const [toggles,         setToggles]        = useState({ weightUnheard: false, excludeKeywords: false, avoidRecent: false })
  const [activePreset,    setActivePreset]   = useState(null)
  const [customPresets,   setCustomPresets]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('discover_presets') || '[]') } catch { return [] }
  })
  const [queueHistory,    setQueueHistory]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('discover_queue_history') || '{}') } catch { return {} }
  })
  const [pickCount,       setPickCount]      = useState(1)
  const [pickedAlbums,    setPickedAlbums]   = useState([])
  const [selectedAlbum,   setSelectedAlbum]  = useState(null)
  const [queueStatus,     setQueueStatus]    = useState(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [presetSheetOpen, setPresetSheetOpen] = useState(false)
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
        setActiveFilters(new Set(cp.filters ?? cp.savedFilters ?? []))
        setToggles(cp.toggles ?? cp.savedToggles ?? { weightUnheard: false, excludeKeywords: false, avoidRecent: false })
      }
    }
    setActivePreset(id)
    setPickedAlbums([])
  }

  function savePreset(name, filters, toggleState) {
    const preset = {
      id: Date.now().toString(),
      icon: '⭐',
      label: name,
      filters: [...filters],
      toggles: { ...toggleState },
    }
    const next = [...customPresets, preset]
    setCustomPresets(next)
    localStorage.setItem('discover_presets', JSON.stringify(next))
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

  const activePresetObj = activePreset
    ? ([...BUILTIN_PRESETS, ...customPresets].find(p => p.id === activePreset) ?? null)
    : null
  const activePresetLabel = activePresetObj?.label ?? 'Surprise Me'
  const activePresetIcon  = activePresetObj?.icon  ?? '🎲'

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

  // Auto-pick when pool is ready and nothing is shown (also fires after swipe removes last album)
  // Must be after filteredAlbums (useMemo) and pickRandom — both used below
  useEffect(() => {
    if (filteredAlbums.length > 0 && pickedAlbums.length === 0) {
      pickRandom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAlbums.length, pickCount, pickedAlbums.length])

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
    <div className="flex flex-col min-h-full">
      {/* Discovery Mode row + filter button */}
      <div className="flex items-center gap-2 px-5 pb-3">
        <button
          onClick={() => setPresetSheetOpen(true)}
          className="flex-1 flex items-center gap-3 bg-card-raised border border-border-subtle rounded-2xl px-4 py-3 text-left active:opacity-80 transition-opacity"
        >
          <span className="text-lg flex-shrink-0">🎛</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Discovery Mode</p>
            <p className="text-[14px] font-semibold text-ink mt-0.5 truncate">{activePresetIcon} {activePresetLabel}</p>
          </div>
          <span className="text-ink-muted text-sm flex-shrink-0">›</span>
        </button>
        <button
          onClick={openFilterModal}
          className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center bg-card-raised border border-border-subtle rounded-2xl active:opacity-80 transition-opacity"
        >
          <span className="text-[18px]">⊽</span>
          {activeFilterCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-black"
              style={{ background: '#1ed760' }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Count selector */}
      <div className="flex items-center gap-2 px-5 pb-4">
        <span className="text-[12px] text-ink-muted mr-1">Pick</span>
        {PICK_COUNTS.map(n => (
          <button
            key={n}
            onClick={() => setPickCount(n)}
            className={`w-9 h-9 rounded-full text-[13px] font-semibold border transition-all duration-200 active:scale-[0.95] ${
              pickCount === n
                ? 'bg-card-raised border-ink-muted text-ink'
                : 'bg-card border-border-subtle text-ink-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Picker area */}
      <div className="px-5 flex-1">
        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-3">
          {pickedAlbums.length > 1 ? `Your Picks · ${pickedAlbums.length}` : 'Your Pick'}
        </p>

        {pickedAlbums.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-ink-muted text-sm">No albums match your filters</p>
            <button
              onClick={() => { setActiveFilters(new Set()); setToggles({ weightUnheard: false, excludeKeywords: false, avoidRecent: false }) }}
              className="text-accent text-sm font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {pickedAlbums.length === 1 && (
          <FeaturedAlbumCard
            key={pickedAlbums[0].id}
            album={pickedAlbums[0]}
            stats={getAlbumStats(pickedAlbums[0])}
            onQueue={handleQueue}
            onSkip={pickRandom}
            onTap={() => setSelectedAlbum(pickedAlbums[0])}
          />
        )}

        {pickedAlbums.length > 1 && (
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
        )}

        {pickedAlbums.length > 0 && (
          <button
            onClick={pickRandom}
            className="w-full mt-4 py-3.5 rounded-xl text-[14px] font-semibold border border-border-subtle text-ink-secondary transition-all duration-200 active:scale-[0.98]"
            style={{ background: 'transparent' }}
          >
            🎲 Show Another
          </button>
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-6" />

      {/* AlbumModal */}
      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          stats={getAlbumStats(selectedAlbum)}
          onClose={() => setSelectedAlbum(null)}
          onQueue={(album) => { handleQueue(album); setSelectedAlbum(null) }}
          onSave={(album) => { handleSave(album); setSelectedAlbum(null) }}
          onRemove={handleRemove}
          saved={isSaved(selectedAlbum.id)}
          library={albums}
          onBadgeClick={onBadgeClick}
        />
      )}

      <PresetSheet
        open={presetSheetOpen}
        onClose={() => setPresetSheetOpen(false)}
        presets={BUILTIN_PRESETS}
        customPresets={customPresets}
        activePreset={activePreset}
        onSelect={applyPreset}
        onDelete={deleteCustomPreset}
      />

      {/* Filter sheet */}
      <AnimatePresence>
        {filterModalOpen && (
          <FilterModal
            draftFilters={draftFilters}
            draftToggles={draftToggles}
            setDraftFilters={setDraftFilters}
            setDraftToggles={setDraftToggles}
            onApply={applyFilters}
            onClose={() => setFilterModalOpen(false)}
            onSavePreset={savePreset}
            activeFilterCount={activeFilterCount}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      {queueStatus && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-[12px] font-semibold text-black"
          style={{ background: '#1ed760', animation: 'toastIn 0.3s ease both' }}
        >
          {queueStatus.msg ?? queueStatus}
        </div>
      )}
    </div>
  )
}
