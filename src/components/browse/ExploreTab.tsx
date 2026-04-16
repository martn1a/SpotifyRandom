import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import type { PlaylistItem, SpotifyAlbum } from '../../lib/types'

interface ExploreTabProps {
  playlists: PlaylistItem[]
  selectedPlaylistIds: string[]
  onSelectAlbum: (album: SpotifyAlbum) => void
  getPlaylistAlbums: (id: string) => SpotifyAlbum[]
  loading: boolean
}

export default function ExploreTab({ playlists, selectedPlaylistIds, onSelectAlbum, getPlaylistAlbums, loading }: ExploreTabProps) {
  const [activePlaylist, setActivePlaylist] = useState<PlaylistItem | null>(null)

  const visible = playlists.filter(p => selectedPlaylistIds.includes(p.id))

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
        <p className="text-ink-muted text-sm">No playlists selected</p>
        <p className="text-ink-subtle text-xs">Enable playlists in Settings to see them here</p>
      </div>
    )
  }

  if (activePlaylist) {
    const playlistAlbums = getPlaylistAlbums(activePlaylist.id)
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 shrink-0">
          <button onClick={() => setActivePlaylist(null)}><ChevronLeft size={20} className="text-ink-muted" /></button>
          <p className="font-semibold text-sm text-ink">{activePlaylist.name}</p>
          <span className="text-xs text-ink-subtle ml-auto">{activePlaylist.trackCount} tracks</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 px-4 pb-4">
            {playlistAlbums.map(album => (
              <motion.div key={album.id} whileTap={{ scale: 0.97 }} onClick={() => onSelectAlbum(album)} className="cursor-pointer">
                <img src={album.images?.[0]?.url ?? ''} alt={album.name} className="w-full aspect-square rounded-xl object-cover" decoding="async" />
                <p className="mt-1.5 text-xs font-semibold text-ink truncate">{album.name}</p>
                <p className="text-[10px] text-ink-muted truncate">{album.artists[0]?.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        {visible.map(pl => (
          <motion.div key={pl.id} whileTap={{ scale: 0.97 }} onClick={() => setActivePlaylist(pl)} className="cursor-pointer">
            {pl.imageUrl
              ? <img src={pl.imageUrl} alt={pl.name} className="w-full aspect-square rounded-xl object-cover" decoding="async" />
              : <div className="w-full aspect-square rounded-xl bg-card-raised border border-border" />
            }
            <p className="mt-1.5 text-xs font-semibold text-ink truncate">{pl.name}</p>
            <p className="text-[10px] text-ink-muted">{pl.trackCount} tracks</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
