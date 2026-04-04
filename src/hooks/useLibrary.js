import { useState, useEffect } from 'react'
import { fetchAllAlbums, fetchArtistGenres } from '../lib/spotify-api.js'

// Phase 1 (albumsLoading): fetch all saved albums — blocks the UI with a loading screen
// Phase 2 (genresLoading): fetch artist genres in the background — UI is already usable
export function useLibrary() {
  const [albums,         setAlbums]         = useState([])
  const [genres,         setGenres]         = useState([])
  const [albumsLoading,  setAlbumsLoading]  = useState(true)
  const [genresLoading,  setGenresLoading]  = useState(false)
  const [albumsProgress, setAlbumsProgress] = useState({ done: 0, total: 0 })
  const [genresProgress, setGenresProgress] = useState({ done: 0, total: 0 })
  const [error,          setError]          = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // ── Phase 1: albums (shows loading screen) ───────────────────
        const loaded = await fetchAllAlbums((done, total) => {
          if (!cancelled) setAlbumsProgress({ done, total })
        })
        if (cancelled) return

        setAlbums(loaded)
        setAlbumsLoading(false) // unblock UI

        // ── Phase 2: genres (runs in background) ─────────────────────
        setGenresLoading(true)
        const allGenres = await fetchArtistGenres(loaded, (done, total) => {
          if (!cancelled) setGenresProgress({ done, total })
        })
        if (cancelled) return

        setGenres(allGenres)
        setAlbums([...loaded]) // new array ref triggers re-render with _genres populated
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setAlbumsLoading(false)
        }
      } finally {
        if (!cancelled) setGenresLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { albums, genres, albumsLoading, genresLoading, albumsProgress, genresProgress, error }
}
