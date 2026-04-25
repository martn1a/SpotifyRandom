import { useState, useEffect } from 'react'
import { getDb } from '../lib/db.js'
import { fetchCurrentUser, fetchUserPlaylists, fetchPlaylistItems } from '../lib/spotify-api.js'

export function usePlaylists(selectedPlaylistIds = []) {
  const [playlists, setPlaylists] = useState([])
  const [playlistAlbums, setPlaylistAlbums] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const db = await getDb()
        const cached = await db.get('playlists_meta', 'list')
        if (cached) {
          if (!cancelled) { setPlaylists(cached.data); setLoading(false) }
          const user = await fetchCurrentUser()
          if (!cancelled) setUserId(user.id)
        } else {
          const user = await fetchCurrentUser()
          if (cancelled) return
          setUserId(user.id)
          const data = await fetchUserPlaylists(user.id)
          if (cancelled) return
          await db.put('playlists_meta', { data, cachedAt: Date.now() }, 'list')
          setPlaylists(data)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Lazy-fetch albums for selected playlists (skip already-loaded ones)
  const idsKey = selectedPlaylistIds.join(',')
  useEffect(() => {
    if (!selectedPlaylistIds.length) return
    let cancelled = false
    async function fetchSelected() {
      const db = await getDb()
      const updates = new Map()
      await Promise.all(selectedPlaylistIds.map(async (id) => {
        const cached = await db.get('playlist_albums', id)
        if (cached) { updates.set(id, cached.data); return }
        try {
          const albums = await fetchPlaylistItems(id)
          await db.put('playlist_albums', { data: albums, cachedAt: Date.now() }, id)
          updates.set(id, albums)
        } catch {
          updates.set(id, [])
        }
      }))
      if (cancelled) return
      setPlaylistAlbums(prev => {
        const next = new Map(prev)
        for (const [id, albums] of updates) next.set(id, albums)
        return next
      })
    }
    fetchSelected()
    return () => { cancelled = true }
  }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshPlaylists() {
    setLoading(true)
    setError(null)
    try {
      const db = await getDb()
      await db.delete('playlists_meta', 'list').catch(() => {})
      for (const id of selectedPlaylistIds) {
        await db.delete('playlist_albums', id).catch(() => {})
      }
      const uid = userId ?? (await fetchCurrentUser()).id
      const data = await fetchUserPlaylists(uid)
      await db.put('playlists_meta', { data, cachedAt: Date.now() }, 'list')
      setPlaylists(data)
      const updates = new Map()
      await Promise.all(selectedPlaylistIds.map(async (id) => {
        try {
          const albums = await fetchPlaylistItems(id)
          await db.put('playlist_albums', { data: albums, cachedAt: Date.now() }, id)
          updates.set(id, albums)
        } catch {
          updates.set(id, [])
        }
      }))
      setPlaylistAlbums(prev => {
        const next = new Map(prev)
        for (const [id, albums] of updates) next.set(id, albums)
        return next
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return { playlists, playlistAlbums, loading, error, refreshPlaylists }
}
