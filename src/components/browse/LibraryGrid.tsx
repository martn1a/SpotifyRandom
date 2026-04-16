import { useState, useMemo } from 'react'
import { Search, Filter, Bookmark } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, getAlbumCover, getAlbumYear, getAlbumBadges } from '../../lib/utils'
import { GENRE_EMOJI, DECADE_CHIPS } from '../../lib/constants'
import { clusterOf } from '../../data/genre-clusters.js'
import type { SpotifyAlbum, LastfmStats } from '../../lib/types'

type SortMode = 'recently-added' | 'most-played' | 'year' | 'name'

interface LibraryGridProps {
  albums: SpotifyAlbum[]
  lastfmMap: Map<string, LastfmStats>
  savedIds: Set<string>
  onSelect: (album: SpotifyAlbum) => void
}

export default function LibraryGrid({ albums, lastfmMap, savedIds, onSelect }: LibraryGridProps) {
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('recently-added')
  const [genreFilter, setGenreFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  const SORT_OPTS: { id: SortMode; label: string }[] = [
    { id: 'recently-added', label: 'Recently Added' },
    { id: 'most-played',    label: 'Most Played' },
    { id: 'year',           label: 'Year' },
    { id: 'name',           label: 'Name' },
  ]
  const TYPE_OPTS = ['Album', 'EP', 'Single']

  const filtered = useMemo(() => {
    let p = albums
    if (query) {
      const q = query.toLowerCase()
      p = p.filter(a => a.name.toLowerCase().includes(q) || a.artists[0]?.name.toLowerCase().includes(q))
    }
    if (genreFilter.length) p = p.filter(a => genreFilter.includes(clusterOf(a._genres ?? [])))
    if (typeFilter.length) p = p.filter(a => typeFilter.map(t => t.toLowerCase()).includes(a.album_type))
    return [...p].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name)
      if (sortMode === 'year') return (b.release_date ?? '').localeCompare(a.release_date ?? '')
      if (sortMode === 'most-played') {
        const aK = `${a.artists[0]?.name}||${a.name}`
        const bK = `${b.artists[0]?.name}||${b.name}`
        return (lastfmMap.get(bK)?.listenCount ?? 0) - (lastfmMap.get(aK)?.listenCount ?? 0)
      }
      return 0
    })
  }, [albums, query, genreFilter, typeFilter, sortMode, lastfmMap])

  const activeFilterCount = genreFilter.length + typeFilter.length + (sortMode !== 'recently-added' ? 1 : 0)

  return (
    <div className="flex flex-col h-full">
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-accent-dim border-b border-accent-border shrink-0">
          <span className="text-xs font-semibold text-accent">FILTERED BY {activeFilterCount} CRITERIA</span>
          <button onClick={() => { setGenreFilter([]); setTypeFilter([]); setSortMode('recently-added') }}
            className="text-xs text-accent font-bold">× CLEAR</button>
        </div>
      )}

      <div className="flex gap-2 px-4 py-2 shrink-0">
        <div className="flex-1 flex items-center gap-2 bg-card-raised border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-ink-subtle shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search albums..."
            className="flex-1 bg-transparent text-sm text-ink placeholder-ink-subtle outline-none"
          />
        </div>
        <button
          onClick={() => setFilterOpen(v => !v)}
          className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', filterOpen ? 'bg-accent-dim border-accent-border text-accent' : 'bg-card-raised border-border text-ink-muted')}
        >
          <Filter size={16} />
        </button>
      </div>

      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-4 pb-3 space-y-3">
              <div>
                <p className="text-[9px] tracking-widest text-ink-subtle mb-1.5">SORT BY</p>
                <div className="flex flex-wrap gap-1.5">
                  {SORT_OPTS.map(s => (
                    <button key={s.id} onClick={() => setSortMode(s.id)}
                      className={cn('px-3 py-1 rounded-full text-[11px] font-semibold border', sortMode === s.id ? 'bg-accent text-black border-accent' : 'bg-card-raised border-border text-ink-muted')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] tracking-widest text-ink-subtle mb-1.5">FORMAT</p>
                <div className="flex gap-1.5">
                  {TYPE_OPTS.map(t => (
                    <button key={t} onClick={() => setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      className={cn('px-3 py-1 rounded-full text-[11px] font-semibold border', typeFilter.includes(t) ? 'bg-accent text-black border-accent' : 'bg-card-raised border-border text-ink-muted')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 py-2 text-[10px] text-ink-subtle tracking-wider">{filtered.length} ALBUMS</p>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {filtered.map(album => {
            const lfKey = `${album.artists[0]?.name}||${album.name}`
            const stats = lastfmMap.get(lfKey)
            const cover = getAlbumCover(album)
            return (
              <motion.div key={album.id} whileTap={{ scale: 0.97 }} onClick={() => onSelect(album)} className="cursor-pointer">
                <div className="relative">
                  <img src={cover} alt={album.name} className="w-full aspect-square rounded-xl object-cover" decoding="async" />
                  {savedIds.has(album.id) && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                      <Bookmark size={12} className="fill-black text-black" />
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-xs font-semibold text-ink truncate">{album.name}</p>
                <p className="text-[10px] text-ink-muted truncate">{album.artists[0]?.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {(album._genres ?? []).slice(0, 1).map(g => (
                    <span key={g} className="text-[9px] text-ink-subtle bg-card-raised border border-border rounded-full px-2 py-0.5">{g}</span>
                  ))}
                  {stats && stats.listenCount > 0 && (
                    <span className="text-[9px] font-bold text-accent ml-auto">{stats.listenCount}×</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
