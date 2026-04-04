import { useState, useEffect } from 'react'

// Loads public/lastfm-data.json and builds a lowercase lookup map.
// Key format: "artist||album" (lowercase) → album stats object
// Non-blocking — app works without it, listen counts just show as 0.
export function useLastfm() {
  const [lastfmMap, setLastfmMap] = useState(new Map())
  const [stats,     setStats]     = useState(null)
  const [loaded,    setLoaded]    = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}lastfm-data.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const map = new Map()
        for (const [key, val] of Object.entries(data.albums || {})) {
          map.set(key.toLowerCase(), val)
        }
        setLastfmMap(map)
        setStats(data.stats || null)
        setLoaded(true)
      })
      .catch(() => {
        // lastfm data is optional — silently continue without it
        setLoaded(true)
      })
  }, [])

  // Helper: look up a Spotify album object in the map
  function getAlbumStats(album) {
    const artist = album.artists?.[0]?.name || ''
    const key    = `${artist}||${album.name}`.toLowerCase()
    return lastfmMap.get(key) || null
  }

  return { lastfmMap, stats, loaded, getAlbumStats }
}
