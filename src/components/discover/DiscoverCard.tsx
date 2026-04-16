import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { getAlbumCover, getAlbumYear, getAlbumBadges } from '../../lib/utils'
import type { SpotifyAlbum, LastfmStats } from '../../lib/types'

interface DiscoverCardProps {
  album: SpotifyAlbum
  lastfmMap: Map<string, LastfmStats>
  onClick: () => void
}

export default function DiscoverCard({ album, lastfmMap, onClick }: DiscoverCardProps) {
  const cover = getAlbumCover(album)
  const year = getAlbumYear(album)
  const badges = getAlbumBadges(album)
  const lfKey = `${album.artists[0]?.name}||${album.name}`
  const stats = lastfmMap.get(lfKey)

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-pointer"
    >
      <img
        src={cover}
        alt={album.name}
        className="absolute inset-0 w-full h-full object-cover"
        decoding="async"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
        {badges.slice(0, 2).map(b => (
          <span key={b} className="text-[9px] font-bold tracking-widest bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-white/80 border border-white/10">
            {b}
          </span>
        ))}
        {stats && stats.listenCount === 0 && (
          <span className="text-[9px] font-bold tracking-widest bg-accent/20 border border-accent/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-accent">
            NEVER HEARD
          </span>
        )}
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-black text-xl leading-tight">{album.name}</p>
        <p className="text-white/70 text-sm mt-0.5">{album.artists[0]?.name}</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-white/50 text-xs">{year} · {album.album_type}</p>
          {stats && stats.listenCount > 0 && (
            <span className="text-[10px] font-bold text-accent">{stats.listenCount}× HEARD</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
