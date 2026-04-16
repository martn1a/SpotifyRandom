export interface SpotifyAlbum {
  id: string
  name: string
  artists: { id: string; name: string }[]
  images: { url: string }[]
  release_date: string
  tracks: { items: { id: string; name: string; duration_ms: number; track_number: number }[] }
  album_type: string
  _genres?: string[]
  _inLibrary?: boolean
  _source?: 'library' | 'playlist'
}

export interface LastfmStats {
  listenCount: number
  backgroundCount: number
  firstHeard: string
  lastHeard: string
  peakMonth: string
  rawScrobbles: number
}

export interface CarouselConfig {
  id: string
  label: string
  visible: boolean
  sortMode: 'original' | 'date' | 'relevance'
  order: number
}

export interface PlaylistItem {
  id: string
  name: string
  imageUrl: string | null
  trackCount: number
}
