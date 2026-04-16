import { useState, useMemo } from 'react'
import { useLibrary } from '../../hooks/useLibrary.js'
import { useLastfm } from '../../hooks/useLastfm.js'
import { useListenLater } from '../../hooks/useListenLater.js'
import { useBurnTracking } from '../../hooks/useBurnTracking.js'
import AlbumModal from '../AlbumModal'
import LibraryGrid from './LibraryGrid'
import CarouselSection from './CarouselSection'
import ExploreTab from './ExploreTab'
import { cn } from '../../lib/utils'
import { CAROUSEL_DEFAULTS } from '../../lib/constants'
import type { SpotifyAlbum } from '../../lib/types'

type SubTab = 'library' | 'browse' | 'explore'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'library', label: 'LIBRARY' },
  { id: 'browse',  label: 'BROWSE' },
  { id: 'explore', label: 'EXPLORE' },
]

interface BrowseTabProps {
  onToast: (msg: string) => void
}

export default function BrowseTab({ onToast }: BrowseTabProps) {
  const { albums, loading } = useLibrary()
  const { lastfmMap } = useLastfm()
  const { listenLater, toggleSave } = useListenLater()
  const { burnedMap, burnAlbum, resetCarousel } = useBurnTracking()

  const [subTab, setSubTab] = useState<SubTab>('library')
  const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbum | null>(null)

  const carouselAlbums = useMemo(() => {
    const withStats = albums
      .filter(a => a._inLibrary)
      .map(a => ({ album: a, stats: lastfmMap.get(`${a.artists[0]?.name}||${a.name}`) }))

    const byListens = [...withStats].sort((a, b) => (b.stats?.listenCount ?? 0) - (a.stats?.listenCount ?? 0))
    const byDate = [...withStats].sort((a, b) => (b.album.release_date ?? '').localeCompare(a.album.release_date ?? ''))

    const today = new Date()
    const onThisDay = withStats.filter(({ stats }) => {
      if (!stats?.firstHeard) return false
      const d = new Date(stats.firstHeard)
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    })

    return {
      'most-played':        byListens.slice(0, 30).map(x => x.album),
      'latest-discoveries': byDate.slice(0, 30).map(x => x.album),
      'golden-oldies':      [...withStats].sort((a, b) => (a.album.release_date ?? '').localeCompare(b.album.release_date ?? '')).slice(0, 30).map(x => x.album),
      'climbers':           byListens.slice(0, 20).map(x => x.album),
      'fallers':            byListens.slice(-20).reverse().map(x => x.album),
      'on-this-day':        onThisDay.map(x => x.album),
    } as Record<string, SpotifyAlbum[]>
  }, [albums, lastfmMap])

  function handleQueue(album: SpotifyAlbum) {
    burnAlbum(album, 'browse', 'queue')
    onToast(`Queued: ${album.name}`)
  }

  const savedIds = useMemo<Set<string>>(() => new Set(listenLater.map((a: any) => a.id as string)), [listenLater])
  const isSaved = (a: SpotifyAlbum) => savedIds.has(a.id)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex border-b border-border shrink-0">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'flex-1 py-3 text-[10px] font-bold tracking-widest transition-colors border-b-2 -mb-px',
              subTab === t.id ? 'text-accent border-accent' : 'text-ink-subtle border-transparent'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {subTab === 'library' && (
          <LibraryGrid
            albums={albums}
            lastfmMap={lastfmMap}
            savedIds={savedIds}
            onSelect={setSelectedAlbum}
          />
        )}
        {subTab === 'browse' && (
          <div className="overflow-y-auto h-full pt-4">
            {CAROUSEL_DEFAULTS.map(config => (
              <CarouselSection
                key={config.id}
                config={config}
                albums={carouselAlbums[config.id] ?? []}
                burnedIds={new Set<string>([...(burnedMap.get(config.id) ?? [])] as string[])}
                onSelect={setSelectedAlbum}
                onReset={resetCarousel}
                showArrow={config.id === 'climbers' ? 'up' : config.id === 'fallers' ? 'down' : null}
              />
            ))}
          </div>
        )}
        {subTab === 'explore' && (
          <ExploreTab
            playlists={[]}
            selectedPlaylistIds={[]}
            onSelectAlbum={setSelectedAlbum}
            getPlaylistAlbums={() => []}
            loading={false}
          />
        )}
      </div>

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
