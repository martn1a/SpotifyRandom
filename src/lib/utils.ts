import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SpotifyAlbum, LastfmStats } from './types'
import { clusterOf } from '../data/genre-clusters.js'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function getAlbumCover(album: SpotifyAlbum): string {
  return album.images?.[0]?.url ?? ''
}

export function getAlbumYear(album: SpotifyAlbum): string {
  return album.release_date?.split('-')[0] ?? ''
}

export function getAlbumBadges(album: SpotifyAlbum): string[] {
  const badges: string[] = []
  if (album._genres?.length) badges.push(...album._genres.slice(0, 2))
  const year = getAlbumYear(album)
  if (year) badges.push(year)
  if (album.album_type === 'single') badges.push('SINGLE')
  if (album.album_type === 'ep') badges.push('EP')
  return badges
}

export function getSimilarAlbums(
  album: SpotifyAlbum,
  library: SpotifyAlbum[],
  lastfmMap: Map<string, LastfmStats>
): SpotifyAlbum[] {
  const targetCluster = clusterOf(album._genres ?? [])
  return library
    .filter(a => a.id !== album.id && clusterOf(a._genres ?? []) === targetCluster)
    .sort((a, b) => {
      const aKey = `${a.artists[0]?.name}||${a.name}`
      const bKey = `${b.artists[0]?.name}||${b.name}`
      const aCount = lastfmMap.get(aKey)?.listenCount ?? 0
      const bCount = lastfmMap.get(bKey)?.listenCount ?? 0
      return bCount - aCount
    })
    .slice(0, 4)
}
