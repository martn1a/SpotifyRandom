import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { DECADE_CHIPS, GENRE_EMOJI } from '../../lib/constants'
import { GENRE_CLUSTERS } from '../../data/genre-clusters.js'

export interface DiscoverFilters {
  decades: string[]
  genres: string[]
  neverHeard: boolean
  notRecentlyPlayed: boolean
}

interface FilterSheetProps {
  open: boolean
  filters: DiscoverFilters
  onApply: (filters: DiscoverFilters, saveAsPreset?: string) => void
  onClose: () => void
}

export default function FilterSheet({ open, filters, onApply, onClose }: FilterSheetProps) {
  const [local, setLocal] = useState<DiscoverFilters>(filters)
  const [presetName, setPresetName] = useState('')

  const genreKeys = (GENRE_CLUSTERS as Array<{ id: string; label: string }>).map(g => g.label)

  function toggleDecade(d: string) {
    setLocal(prev => ({
      ...prev,
      decades: prev.decades.includes(d) ? prev.decades.filter(x => x !== d) : [...prev.decades, d]
    }))
  }

  function toggleGenre(g: string) {
    setLocal(prev => ({
      ...prev,
      genres: prev.genres.includes(g) ? prev.genres.filter(x => x !== g) : [...prev.genres, g]
    }))
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            className="relative w-full bg-card rounded-t-2xl max-h-[85dvh] flex flex-col"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-4 shrink-0">
              <p className="text-[10px] font-semibold tracking-widest text-ink-subtle">FILTERS</p>
              <button onClick={onClose}><X size={20} className="text-ink-muted" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-5">
              {/* Decades */}
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-2">DECADES</p>
                <div className="flex flex-wrap gap-2">
                  {DECADE_CHIPS.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleDecade(d)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                        local.decades.includes(d) ? 'bg-accent text-black border-accent' : 'bg-card-raised border-border text-ink-muted'
                      )}
                    >{d}</button>
                  ))}
                </div>
              </div>

              {/* Genres */}
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-2">GENRES</p>
                <div className="grid grid-cols-2 gap-2">
                  {genreKeys.map(g => (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors text-left',
                        local.genres.includes(g) ? 'bg-accent-dim border-accent-border text-accent' : 'bg-card-raised border-border text-ink-muted'
                      )}
                    >
                      <span>{GENRE_EMOJI[g] ?? '🎵'}</span>
                      <span>{g}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save as Preset */}
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-2">SAVE AS PRESET</p>
                <div className="flex gap-2">
                  <input
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 bg-card-raised border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-subtle outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => { if (presetName.trim()) { onApply(local, presetName.trim()); onClose() } }}
                    disabled={!presetName.trim()}
                    className="bg-accent text-black font-bold text-sm rounded-xl px-4 py-2 disabled:opacity-40"
                  >SAVE</button>
                </div>
              </div>
            </div>

            {/* Apply */}
            <div className="p-4 pb-safe shrink-0">
              <button
                onClick={() => { onApply(local); onClose() }}
                className="w-full bg-accent text-black font-bold text-sm rounded-xl py-3"
              >APPLY FILTER</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
