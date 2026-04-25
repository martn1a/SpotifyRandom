import { useState, useEffect, useCallback } from 'react'

// Loads public/lastfm-data.json and builds a lowercase lookup map.
// Key format: "artist||album" (lowercase) → album stats object
// Non-blocking — app works without it, listen counts just show as 0.
export function useLastfm() {
  const [lastfmMap,   setLastfmMap]   = useState(new Map())
  const [stats,       setStats]       = useState(null)
  const [meta,        setMeta]        = useState(null)
  const [onThisDay,   setOnThisDay]   = useState([])
  const [loaded,      setLoaded]      = useState(false)
  const [refreshKey,  setRefreshKey]  = useState(0)
  const [albumTagsMap, setAlbumTagsMap] = useState(new Map())

  const refresh = useCallback(() => {
    setLoaded(false)
    setRefreshKey(k => k + 1)
  }, [])

  useEffect(() => {
    const cacheMode = refreshKey > 0 ? 'reload' : 'default'
    fetch(`${import.meta.env.BASE_URL}lastfm-data.json`, { cache: cacheMode })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        // Build album lookup map
        const map = new Map()
        for (const [key, val] of Object.entries(data.albums || {})) {
          map.set(key.toLowerCase(), val)
        }
        setLastfmMap(map)
        setStats(data.stats || null)
        setMeta(data.meta || null)

        // Parse album tags
        const tagsMap = new Map()
        for (const [key, tags] of Object.entries(data.albumTags || {})) {
          tagsMap.set(key.toLowerCase(), tags)
        }
        setAlbumTagsMap(tagsMap)

        // Compute "On This Day" from timeline (runs once, O(N))
        const today = new Date()
        const mth = today.getMonth()
        const day = today.getDate()
        const yr  = today.getFullYear()
        const seen = new Set()
        const otd = []
        for (const e of (data.timeline || [])) {
          const d = new Date(e.ts)
          if (d.getMonth() !== mth || d.getDate() !== day) continue
          if (d.getFullYear() === yr) continue  // skip current year
          const key = `${d.getFullYear()}||${(e.a || '').toLowerCase()}||${(e.al || '').toLowerCase()}`
          if (!seen.has(key)) {
            seen.add(key)
            otd.push({ year: d.getFullYear(), artist: e.a, album: e.al })
          }
        }
        otd.sort((a, b) => b.year - a.year)
        setOnThisDay(otd)

        setLoaded(true)
      })
      .catch(() => {
        // lastfm data is optional — silently continue without it
        setLoaded(true)
      })
  }, [refreshKey])

  // Helper: look up a Spotify album object in the map
  function getAlbumStats(album) {
    const artist = album.artists?.[0]?.name || ''
    const key    = `${artist}||${album.name}`.toLowerCase()
    return lastfmMap.get(key) || null
  }

  return { lastfmMap, albumTagsMap, stats, meta, onThisDay, loaded, getAlbumStats, refresh }
}
