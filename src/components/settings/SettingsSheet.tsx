import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw } from 'lucide-react'
import CarouselManager from './CarouselManager'
import type { CarouselConfig, PlaylistItem } from '../../lib/types'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  carouselConfig: CarouselConfig[]
  onCarouselChange: (configs: CarouselConfig[]) => void
  playlists: PlaylistItem[]
  selectedPlaylistIds: string[]
  onTogglePlaylist: (id: string) => void
  onSpotifySync: () => void
}

export default function SettingsSheet({ open, onClose, carouselConfig, onCarouselChange, playlists, selectedPlaylistIds, onTogglePlaylist, onSpotifySync }: SettingsSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            className="relative w-full bg-card rounded-t-2xl max-h-[90dvh] flex flex-col"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-4 shrink-0">
              <p className="text-[10px] font-semibold tracking-widest text-ink-subtle">SETTINGS</p>
              <button onClick={onClose}><X size={20} className="text-ink-muted" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-safe space-y-6">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-3">DATA SYNC</p>
                <button onClick={onSpotifySync}
                  className="w-full flex items-center justify-center gap-2 bg-card-raised border border-border rounded-xl py-3 text-sm font-semibold text-ink">
                  <RefreshCw size={15} /> Sync Spotify Library
                </button>
              </div>

              <div>
                <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-3">CAROUSELS</p>
                <CarouselManager configs={carouselConfig} onChange={onCarouselChange} />
              </div>

              {playlists.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-3">EXPLORE PLAYLISTS</p>
                  <div className="flex flex-col gap-2">
                    {playlists.map(p => (
                      <div key={p.id} className="flex items-center gap-3 bg-card-raised border border-border rounded-xl p-3">
                        {p.imageUrl
                          ? <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-card shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                          <p className="text-[10px] text-ink-muted">{p.trackCount} tracks</p>
                        </div>
                        <button onClick={() => onTogglePlaylist(p.id)}
                          className={`w-10 h-6 rounded-full transition-colors ${selectedPlaylistIds.includes(p.id) ? 'bg-accent' : 'bg-card border border-border'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full mx-auto transition-transform ${selectedPlaylistIds.includes(p.id) ? 'translate-x-2' : '-translate-x-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
