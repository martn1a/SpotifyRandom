import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { getAlbumCover, getAlbumYear, getAlbumBadges } from '../../lib/utils'
import type { SpotifyAlbum, LastfmStats } from '../../lib/types'

interface DiscoverListProps {
  albums: SpotifyAlbum[]
  lastfmMap: Map<string, LastfmStats>
  onSelect: (album: SpotifyAlbum) => void
}

export default function DiscoverList({ albums, lastfmMap, onSelect }: DiscoverListProps) {
  return (
    <div className="flex flex-col gap-2">
      {albums.map((album, i) => {
        const cover = getAlbumCover(album)
        const year = getAlbumYear(album)
        const badges = getAlbumBadges(album)
        const lfKey = `${album.artists[0]?.name}||${album.name}`
        const stats = lastfmMap.get(lfKey)
        return (
          <motion.div
            key={album.id}
            onClick={() => onSelect(album)}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 bg-card-raised rounded-xl p-3 border border-border cursor-pointer"
          >
            <img src={cover} alt={album.name} className="w-14 h-14 rounded-lg object-cover shrink-0" decoding="async" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink truncate">{album.name}</p>
              <p className="text-xs text-ink-muted mt-0.5 truncate">{album.artists[0]?.name}</p>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {badges.slice(0, 2).map(b => (
                  <span key={b} className="text-[9px] font-bold tracking-wider text-ink-subtle bg-card border border-border rounded-full px-2 py-0.5">
                    {b}
                  </span>
                ))}
                {stats && stats.listenCount > 0 && (
                  <span className="text-[9px] font-bold text-accent">{stats.listenCount}×</span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-ink-subtle shrink-0" />
          </motion.div>
        )
      })}
    </div>
  )
}
