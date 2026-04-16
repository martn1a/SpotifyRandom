import { useState, useEffect } from 'react'
import { spotifyFetch } from '../lib/spotify-api.js'
import { getDb } from '../lib/db.js'

const CACHE_KEY = 'playlists'
const CACHE_TTL = 24 * 60 * 60 * 1000

export function usePlaylists() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const db = await getDb()
      const cached = await db.get('library', CACHE_KEY)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setPlaylists(cached.data)
        setLoading(false)
        return
      }
      try {
        const items = []
        let url = '/me/playlists?limit=50'
        while (url) {
          const res = await spotifyFetch(url)
          items.push(...(res.items ?? []))
          url = res.next ? res.next.replace('https://api.spotify.com/v1', '') : null
        }
        const mapped = items.map(p => ({
          id: p.id,
          name: p.name,
          imageUrl: p.images?.[0]?.url ?? null,
          trackCount: p.tracks?.total ?? 0,
        }))
        await db.put('library', { data: mapped, ts: Date.now() }, CACHE_KEY)
        setPlaylists(mapped)
      } catch (e) {
        console.error('usePlaylists', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function getPlaylistAlbums(playlistId) {
    const db = await getDb()
    const cacheKey = `playlist-albums-${playlistId}`
    const cached = await db.get('library', cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    const items = []
    let url = `/playlists/${playlistId}/items?limit=50`
    while (url) {
      const res = await spotifyFetch(url)
      items.push(...(res.items ?? []).map(i => i.track?.album).filter(Boolean))
      url = res.next ? res.next.replace('https://api.spotify.com/v1', '') : null
    }
    const unique = Array.from(new Map(items.map(a => [a.id, a])).values())
    await db.put('library', { data: unique, ts: Date.now() }, cacheKey)
    return unique
  }

  return { playlists, loading, getPlaylistAlbums }
}
