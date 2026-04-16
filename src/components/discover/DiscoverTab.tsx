import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Filter, SlidersHorizontal } from 'lucide-react'
import { useLibrary } from '../../hooks/useLibrary.js'
import { useLastfm } from '../../hooks/useLastfm.js'
import { useListenLater } from '../../hooks/useListenLater.js'
import AlbumModal from '../AlbumModal'
import DiscoverCard from './DiscoverCard'
import DiscoverList from './DiscoverList'
import PresetSheet, { BUILT_IN_PRESETS, type Preset } from './PresetSheet'
import FilterSheet, { type DiscoverFilters } from './FilterSheet'
import { cn } from '../../lib/utils'
import { clusterOf } from '../../data/genre-clusters.js'
import type { SpotifyAlbum } from '../../lib/types'

const PICK_COUNTS = [1, 3, 5] as const
const QUEUE_HISTORY_KEY = 'discover_queue_history'
const PRESETS_KEY = 'discover_presets'

function getQueueHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_HISTORY_KEY) ?? '[]') } catch { return [] }
}
function addToQueueHistory(id: string) {
  const h = getQueueHistory().filter(x => x !== id)
  localStorage.setItem(QUEUE_HISTORY_KEY, JSON.stringify([id, ...h].slice(0, 500)))
}
function getCustomPresets(): Preset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') } catch { return [] }
}

function pickRandom(pool: SpotifyAlbum[], count: number, lastfmMap: Map<string, any>, weighted: boolean): SpotifyAlbum[] {
  if (pool.length === 0) return []
  const weights = pool.map(a => {
    if (!weighted) return 1
    const stats = lastfmMap.get(`${a.artists[0]?.name}||${a.name}`)
    if (!stats || stats.listenCount === 0) return 10
    const daysSince = stats.lastHeard ? (Date.now() - new Date(stats.lastHeard).getTime()) / 86400000 : 999
    return daysSince > 90 ? 5 : 1
  })
  const total = weights.reduce((a, b) => a + b, 0)
  const results: SpotifyAlbum[] = []
  const used = new Set<number>()
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < pool.length; j++) {
      if (used.has(j)) continue
      r -= weights[j]
      if (r <= 0) { idx = j; break }
    }
    used.add(idx)
    results.push(pool[idx])
  }
  return results
}

interface DiscoverTabProps {
  onToast: (msg: string) => void
  onMenuOpen: () => void
}

export default function DiscoverTab({ onToast, onMenuOpen }: DiscoverTabProps) {
  const { albums, loading } = useLibrary()
  const { lastfmMap } = useLastfm()
  const { listenLater, toggleSave } = useListenLater()

  const [activePreset, setActivePreset] = useState<Preset>(BUILT_IN_PRESETS[0])
  const [customPresets, setCustomPresets] = useState<Preset[]>(getCustomPresets)
  const [filters, setFilters] = useState<DiscoverFilters>({ decades: [], genres: [], neverHeard: false, notRecentlyPlayed: false })
  const [pickCount, setPickCount] = useState<1 | 3 | 5>(1)
  const [picks, setPicks] = useState<SpotifyAlbum[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbum | null>(null)
  const [presetOpen, setPresetOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [weighted, setWeighted] = useState(true)
  const [noRemixes, setNoRemixes] = useState(true)
  const [notRecentlyQueued, setNotRecentlyQueued] = useState(true)

  const REMIX_RE = /\b(live|remix|edit|instrumental|reprise|version)\b/i

  const pool = useMemo(() => {
    let p = albums
    if (noRemixes) p = p.filter(a => !REMIX_RE.test(a.name))
    if (notRecentlyQueued) {
      const h = new Set(getQueueHistory())
      p = p.filter(a => !h.has(a.id))
    }
    if (filters.decades.length) {
      p = p.filter(a => {
        const y = parseInt(a.release_date?.split('-')[0] ?? '0')
        return filters.decades.some(d => {
          const decade = parseInt('19' + d.replace('s', ''))
          return d === '00s' ? y >= 2000 && y < 2010
               : d === '10s' ? y >= 2010 && y < 2020
               : d === '20s' ? y >= 2020
               : y >= decade && y < decade + 10
        })
      })
    }
    if (filters.genres.length) {
      p = p.filter(a => filters.genres.includes(clusterOf(a._genres ?? [])))
    }
    if (filters.neverHeard) {
      p = p.filter(a => {
        const stats = lastfmMap.get(`${a.artists[0]?.name}||${a.name}`)
        return !stats || stats.listenCount === 0
      })
    }
    return p
  }, [albums, filters, noRemixes, notRecentlyQueued, lastfmMap])

  function shuffle() {
    const picked = pickRandom(pool, pickCount, lastfmMap, weighted)
    setPicks(picked)
  }

  function handleQueue(album: SpotifyAlbum) {
    addToQueueHistory(album.id)
    // TODO: call Spotify queue API via spotify-api.js in Session 4
    onToast(`Queued: ${album.name}`)
  }

  function handleApplyFilter(f: DiscoverFilters, saveAs?: string) {
    setFilters(f)
    if (saveAs) {
      const newPreset: Preset = { id: `custom-${Date.now()}`, label: saveAs, description: 'CUSTOM', emoji: '⭐' }
      const updated = [...customPresets, newPreset]
      setCustomPresets(updated)
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
    }
  }

  const activeFilterCount = filters.decades.length + filters.genres.length + (filters.neverHeard ? 1 : 0)
  const isSaved = (a: SpotifyAlbum) => listenLater.some((s: any) => s.id === a.id)

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 shrink-0">
        <button onClick={onMenuOpen} className="w-8 h-8 flex items-center justify-center text-ink-muted">
          <Menu size={20} />
        </button>
        <p className="text-base font-black tracking-widest text-ink">SONAR</p>
        <div className="w-8 h-8 rounded-full bg-card-raised border border-border" />
      </div>

      {/* Discovery Mode Bar */}
      <div className="flex items-center gap-2 px-4 pb-2 shrink-0">
        <button
          onClick={() => setPresetOpen(true)}
          className="flex-1 flex items-center justify-between bg-card-raised border border-border rounded-xl px-3 py-2.5"
        >
          <div className="text-left">
            <p className="text-[9px] tracking-widest text-ink-subtle">DISCOVERY MODE</p>
            <p className="text-sm font-semibold text-ink mt-0.5">{activePreset.emoji} {activePreset.label}</p>
          </div>
          <SlidersHorizontal size={16} className="text-ink-subtle" />
        </button>
        <button
          onClick={() => setFilterOpen(true)}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center border relative',
            activeFilterCount > 0 ? 'bg-accent-dim border-accent-border text-accent' : 'bg-card-raised border-border text-ink-muted'
          )}
        >
          <Filter size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full text-[9px] font-bold text-black flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Pick count selector */}
      <div className="flex gap-1.5 px-4 pb-3 shrink-0">
        {PICK_COUNTS.map(n => (
          <button
            key={n}
            onClick={() => setPickCount(n)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold border transition-colors',
              pickCount === n ? 'bg-accent text-black border-accent' : 'bg-card-raised border-border text-ink-muted'
            )}
          >{n}</button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4">
        <AnimatePresence mode="wait">
          {picks.length === 0 ? (
            <motion.div key="empty" className="flex flex-col items-center justify-center h-48 text-center gap-2">
              <p className="text-ink-subtle text-sm">Hit shuffle to discover albums</p>
              <p className="text-ink-subtle text-xs">{pool.length} albums in pool</p>
            </motion.div>
          ) : picks.length === 1 ? (
            <motion.div key="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <DiscoverCard album={picks[0]} lastfmMap={lastfmMap} onClick={() => setSelectedAlbum(picks[0])} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <DiscoverList albums={picks} lastfmMap={lastfmMap} onSelect={setSelectedAlbum} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Shuffle button */}
      <div className="px-4 py-3 shrink-0">
        <button onClick={shuffle} className="w-full bg-accent text-black font-bold text-sm rounded-xl py-3.5">
          SHUFFLE PICKS
        </button>
      </div>

      {/* Sheets */}
      <PresetSheet
        open={presetOpen}
        activePresetId={activePreset.id}
        customPresets={customPresets}
        onSelect={setActivePreset}
        onClose={() => setPresetOpen(false)}
      />
      <FilterSheet
        open={filterOpen}
        filters={filters}
        onApply={handleApplyFilter}
        onClose={() => setFilterOpen(false)}
      />

      {/* AlbumModal */}
      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
          lastfmMap={lastfmMap}
          library={albums}
          isSaved={isSaved(selectedAlbum)}
          onToggleSave={toggleSave}
          onQueue={handleQueue}
        />
      )}
    </div>
  )
}
