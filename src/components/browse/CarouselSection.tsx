import { motion } from 'framer-motion'
import { ChevronRight, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn, getAlbumCover } from '../../lib/utils'
import type { SpotifyAlbum, CarouselConfig } from '../../lib/types'

interface CarouselSectionProps {
  config: CarouselConfig
  albums: SpotifyAlbum[]
  burnedIds: Set<string>
  onSelect: (album: SpotifyAlbum) => void
  onReset: (carouselId: string) => void
  showArrow?: 'up' | 'down' | null
}

export default function CarouselSection({ config, albums, burnedIds, onSelect, onReset, showArrow }: CarouselSectionProps) {
  const available = albums.filter(a => !burnedIds.has(a.id))
  const burnPct = albums.length > 0 ? Math.round(((albums.length - available.length) / albums.length) * 100) : 0

  if (!config.visible) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold tracking-wider text-ink">{config.label.toUpperCase()}</p>
          {burnPct > 0 && (
            <span className="text-[9px] font-semibold text-ink-subtle">{burnPct}% BURNED</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onReset(config.id)} className="text-ink-subtle">
            <RefreshCw size={13} />
          </button>
          <button className="flex items-center gap-0.5 text-[10px] text-ink-subtle font-semibold">
            SEE ALL <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="mx-4 mb-2 h-0.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-accent/60 rounded-full transition-all" style={{ width: `${burnPct}%` }} />
      </div>

      {available.length === 0 ? (
        <div className="mx-4 bg-card-raised border border-border rounded-xl p-4 text-center">
          <p className="text-sm text-ink-muted">All burned out!</p>
          <button onClick={() => onReset(config.id)} className="mt-2 text-xs text-accent font-semibold">Reset ↻</button>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar">
          {available.slice(0, 20).map((album) => (
            <motion.div
              key={album.id}
              onClick={() => onSelect(album)}
              whileTap={{ scale: 0.96 }}
              className="shrink-0 w-32 cursor-pointer"
            >
              <div className="relative">
                <img src={getAlbumCover(album)} alt={album.name} className="w-32 h-32 rounded-xl object-cover" decoding="async" />
                {showArrow && (
                  <div className={cn('absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center',
                    showArrow === 'up' ? 'bg-green-500/90' : 'bg-red-500/90')}>
                    {showArrow === 'up' ? <ArrowUpRight size={11} className="text-white" /> : <ArrowDownRight size={11} className="text-white" />}
                  </div>
                )}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-ink truncate">{album.name}</p>
              <p className="text-[10px] text-ink-muted truncate">{album.artists[0]?.name}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
