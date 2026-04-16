import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import { useState } from 'react'
import { useLibrary } from '../../hooks/useLibrary.js'
import { useLastfm } from '../../hooks/useLastfm.js'
import { useListenLater } from '../../hooks/useListenLater.js'
import AlbumModal from '../AlbumModal'
import { getAlbumCover } from '../../lib/utils'
import type { SpotifyAlbum } from '../../lib/types'

interface LaterTabProps {
  onToast: (msg: string) => void
}

export default function LaterTab({ onToast }: LaterTabProps) {
  const { albums } = useLibrary()
  const { lastfmMap } = useLastfm()
  const { listenLater, toggleSave } = useListenLater()
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbum | null>(null)

  function handleQueue(album: SpotifyAlbum) {
    onToast(`Queued: ${album.name}`)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 shrink-0">
        <p className="text-base font-black tracking-widest text-ink">LATER</p>
        <span className="text-sm font-bold text-accent">{listenLater.length} albums</span>
      </div>

      {listenLater.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-ink-subtle text-sm">No saved albums yet</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 px-4 pb-4">
            {listenLater.map((album: SpotifyAlbum) => (
              <motion.div key={album.id} whileTap={{ scale: 0.97 }} onClick={() => setSelectedAlbum(album)} className="cursor-pointer">
                <div className="relative">
                  <img src={getAlbumCover(album)} alt={album.name} className="w-full aspect-square rounded-xl object-cover" decoding="async" />
                  <div className="absolute top-2 right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                    <Bookmark size={12} className="fill-black text-black" />
                  </div>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-ink truncate">{album.name}</p>
                <p className="text-[10px] text-ink-muted truncate">{album.artists[0]?.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
          lastfmMap={lastfmMap}
          library={albums}
          isSaved={true}
          onToggleSave={toggleSave}
          onQueue={handleQueue}
          showRemove={true}
        />
      )}
    </div>
  )
}
