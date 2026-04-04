import { useState, useMemo, useCallback } from 'react'
import { GENRE_CLUSTERS, clusterOf } from '../../data/genre-clusters.js'
import { addToQueue } from '../../lib/spotify-api.js'
import AlbumModal from '../AlbumModal.jsx'

// ── Constants ─────────────────────────────────────────────────────────

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const DECADE_STARTS = { '60s': 1960, '70s': 1970, '80s': 1980, '90s': 1990, '00s': 2000, '10s': 2010, '20s': 2020 }
const NINETY_DAYS_MS  = 90 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS  = 30 * 24 * 60 * 60 * 1000
const BLOCKLIST_KW    = ['instrumental', 'remix', 'edit', 'live', 'reprise', 'version']

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

// Weighted random pick — never-heard albums get 10×, forgotten get 5×, recent get 1×
function weightedPickOne(albums, getAlbumStats) {
  if (!albums.length) return null
  const now = Date.now()
  const weighted = albums.map(a => {
    const stats = getAlbumStats(a)
    const listenCount = stats?.listenCount ?? 0
    const lastHeard   = stats?.lastHeard ?? null
    const w = listenCount === 0   ? 10
            : !lastHeard          ? 5
            : now - lastHeard > NINETY_DAYS_MS ? 5
            : 1
    return { album: a, weight: w }
  })
  const total = weighted.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const { album, weight } of weighted) {
    r -= weight
    if (r <= 0) return album
  }
  return weighted[weighted.length - 1].album
}

// ── Sub-components ────────────────────────────────────────────────────

function Chip({ label, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors
        ${active ? 'bg-chip-active text-white' : 'bg-chip-inactive text-gray-600'}`}
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

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-border-subtle">
      {/* Tappable info area */}
      <div
        className="flex gap-4 cursor-pointer active:opacity-80 transition-opacity"
        onClick={onTap}
      >
        {/* Cover art */}
        <div className="w-[100px] h-[100px] rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {art
            ? <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center text-3xl">💿</div>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <p className="text-[16px] font-medium text-ink leading-snug line-clamp-2">{album.name}</p>
            <p className="text-[13px] text-ink-secondary mt-0.5 truncate">{artist}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {count > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                               bg-badge-listen-bg text-badge-listen">
                {count}× heard
              </span>
            )}
            {cluster && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                               bg-[#EEEDFE] text-[#534AB7]">
                {cluster.icon} {cluster.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onQueue(album) }}
          className="w-full bg-ink text-white text-[13px] font-medium py-2.5 rounded-xl
                     active:opacity-80 transition-opacity"
        >
          Queue to Spotify
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); saved ? onRemove(album.id) : onSave(album) }}
          className={`w-full text-[13px] font-medium py-2.5 rounded-xl transition-colors
            ${saved
              ? 'bg-gray-50 text-ink-muted'
              : 'border border-ink bg-white text-ink active:bg-gray-50'
            }`}
        >
          {saved ? 'Saved ✓' : 'Save for Later'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

export default function DiscoverTab({ albums, getAlbumStats, saveLater, removeLater, isSaved }) {
  const [activeFilters,  setActiveFilters]  = useState(new Set())
  const [toggles,        setToggles]        = useState({ weightUnheard: false, excludeKeywords: false, avoidRecent: false })
  const [activePreset,   setActivePreset]   = useState(null)
  const [customPresets,  setCustomPresets]  = useState(
    () => JSON.parse(localStorage.getItem('discover_presets') || '[]')
  )
  const [queueHistory,   setQueueHistory]   = useState(
    () => JSON.parse(localStorage.getItem('discover_queue_history') || '{}')
  )
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName,     setPresetName]     = useState('')
  const [pickedAlbum,    setPickedAlbum]    = useState(null)
  const [selectedAlbum,  setSelectedAlbum]  = useState(null)
  const [queueStatus,    setQueueStatus]    = useState(null)

  // ── Filter helpers ─────────────────────────────────────────────────

  function toggleFilter(f) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
    setActivePreset(null)
    setPickedAlbum(null)
  }

  function setToggle(key, val) {
    setToggles(prev => ({ ...prev, [key]: val }))
    setActivePreset(null)
    setPickedAlbum(null)
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
    setPickedAlbum(null)
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

  const hasActiveFilters = activeFilters.size > 0 || toggles.weightUnheard || toggles.excludeKeywords || toggles.avoidRecent

  // ── Filtered album pool ────────────────────────────────────────────

  const filteredAlbums = useMemo(() => {
    const activeDecades       = DECADES.filter(d => activeFilters.has(d))
    const activeGenreClusters = GENRE_CLUSTERS.filter(c => activeFilters.has(c.id))
    const now = Date.now()

    return albums.filter(a => {
      // Decade filter
      if (activeDecades.length && !activeDecades.includes(albumDecade(a))) return false
      // Genre cluster filter
      if (activeGenreClusters.length) {
        const albumClusters = new Set((a._genres || []).map(clusterOf))
        if (!activeGenreClusters.some(c => albumClusters.has(c.id))) return false
      }
      // Never heard / Not recently played
      const stats = getAlbumStats(a)
      if (activeFilters.has('Never heard') && (stats?.listenCount ?? 0) > 0) return false
      if (activeFilters.has('Not recently played')) {
        const lh = stats?.lastHeard
        if (lh && now - lh <= NINETY_DAYS_MS) return false
      }
      // Keyword filter
      if (toggles.excludeKeywords) {
        const l = (a.name || '').toLowerCase()
        if (BLOCKLIST_KW.some(k => l.includes(k))) return false
      }
      // Avoid recently queued (30 days)
      if (toggles.avoidRecent && queueHistory[a.id]) {
        if (now - queueHistory[a.id] < THIRTY_DAYS_MS) return false
      }
      return true
    })
  }, [albums, activeFilters, toggles, queueHistory, getAlbumStats])

  // Album of the Day — seeded from date, unaffected by filters
  const albumOfTheDay = useMemo(() => {
    if (!albums.length) return null
    return albums[seededIndex(new Date().toDateString(), albums.length)]
  }, [albums])

  // ── Actions ────────────────────────────────────────────────────────

  function pickRandom() {
    if (!filteredAlbums.length) return
    setPickedAlbum(
      toggles.weightUnheard
        ? weightedPickOne(filteredAlbums, getAlbumStats)
        : filteredAlbums[Math.floor(Math.random() * filteredAlbums.length)]
    )
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
      // Record this album in queue history
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
  }, [])

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Filter section ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 bg-page space-y-1.5">

        {/* Row 0: Presets */}
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
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors
                ${activePreset === p.id ? 'bg-chip-active text-white' : 'bg-[#FFF4E8] text-[#B06500]'}`}
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
          {hasActiveFilters && !activePreset && (
            <button
              onClick={() => setShowSavePreset(v => !v)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium
                         border border-dashed border-gray-300 text-gray-500 transition-colors
                         hover:border-gray-400"
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
              className="flex-1 bg-white border border-border-subtle rounded-lg px-3 py-1.5
                         text-[12px] text-ink outline-none focus:border-gray-300"
            />
            <button onClick={savePreset} className="text-[11px] font-medium text-ink px-2 py-1.5">Save</button>
            <button onClick={() => setShowSavePreset(false)} className="text-[11px] text-ink-muted px-1 py-1.5">✕</button>
          </div>
        )}

        {/* Row 1: decades + heard status */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {DECADES.map(d => (
            <Chip key={d} active={activeFilters.has(d)} onClick={() => toggleFilter(d)}>{d}</Chip>
          ))}
          {['Never heard', 'Not recently played'].map(label => (
            <Chip key={label} active={activeFilters.has(label)} onClick={() => toggleFilter(label)}>{label}</Chip>
          ))}
        </div>

        {/* Row 2: genre clusters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {GENRE_CLUSTERS.map(c => (
            <Chip key={c.id} active={activeFilters.has(c.id)} onClick={() => toggleFilter(c.id)}>
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </Chip>
          ))}
        </div>

        {/* Row 3: toggles */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <Chip active={toggles.weightUnheard}    onClick={() => setToggle('weightUnheard',    !toggles.weightUnheard)}>
            ⚖ Weighted
          </Chip>
          <Chip active={toggles.excludeKeywords}  onClick={() => setToggle('excludeKeywords',  !toggles.excludeKeywords)}>
            🚫 No Remixes
          </Chip>
          <Chip active={toggles.avoidRecent}      onClick={() => setToggle('avoidRecent',      !toggles.avoidRecent)}>
            🕐 Not Recently Queued
          </Chip>
        </div>
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

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">

        {/* Album of the Day */}
        <section className="pt-4">
          <h2 className="text-[11px] font-medium text-ink-muted uppercase tracking-wide mb-3">
            Today's Pick
          </h2>
          {albumOfTheDay
            ? (
              <FeaturedAlbumCard
                album={albumOfTheDay}
                stats={getAlbumStats(albumOfTheDay)}
                onQueue={handleQueue}
                onSave={saveLater}
                onRemove={removeLater}
                saved={isSaved(albumOfTheDay.id)}
                onTap={() => setSelectedAlbum(albumOfTheDay)}
              />
            )
            : <p className="text-[13px] text-ink-muted">No albums loaded.</p>
          }
        </section>

        {/* Random Picker */}
        <section>
          <h2 className="text-[11px] font-medium text-ink-muted uppercase tracking-wide mb-3">
            Random Pick
          </h2>

          {filteredAlbums.length === 0
            ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-[13px] font-medium text-ink">No albums match your filters</p>
                <p className="text-[12px] text-ink-muted mt-1">Try removing some filters</p>
              </div>
            )
            : (
              <>
                <button
                  onClick={pickRandom}
                  className="w-full bg-ink text-white text-[14px] font-medium py-3 rounded-xl
                             active:opacity-80 transition-opacity mb-4"
                >
                  Pick an Album
                  {hasActiveFilters && (
                    <span className="ml-1.5 text-[11px] opacity-60">
                      ({filteredAlbums.length} in pool)
                    </span>
                  )}
                </button>

                {pickedAlbum && (
                  <FeaturedAlbumCard
                    album={pickedAlbum}
                    stats={getAlbumStats(pickedAlbum)}
                    onQueue={handleQueue}
                    onSave={saveLater}
                    onRemove={removeLater}
                    saved={isSaved(pickedAlbum.id)}
                    onTap={() => setSelectedAlbum(pickedAlbum)}
                  />
                )}
              </>
            )
          }
        </section>

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
        />
      )}
    </div>
  )
}
