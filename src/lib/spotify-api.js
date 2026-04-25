import { getToken } from './auth.js'
import { getDb } from './db.js'

async function get(url) {
  const token = await getToken()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Spotify API ${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}

const ALBUM_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// GET /me/albums — paginated, returns all saved albums
// Cache: reads from IndexedDB 'library' store on repeat visits (TTL = 24h)
export async function fetchAllAlbums(onProgress) {
  const db = await getDb()

  // ── Cache hit ──────────────────────────────────────────────────
  const cached = await db.get('library', 'albums')
  if (cached && Date.now() - cached.cachedAt < ALBUM_CACHE_TTL) {
    onProgress(cached.data.length, cached.data.length)
    return cached.data
  }

  // ── Cache miss / stale → fetch fresh ──────────────────────────
  const albums = []
  let url = 'https://api.spotify.com/v1/me/albums?limit=50&market=from_token'
  while (url) {
    const data = await get(url)
    for (const item of data.items) {
      item.album._added_at = item.added_at || null
      item.album._genres  = []
      albums.push(item.album)
    }
    url = data.next
    onProgress(albums.length, data.total)
  }

  db.put('library', { data: albums, cachedAt: Date.now() }, 'albums').catch(() => {})

  return albums
}

// GET /artists/{id} — one at a time (batch endpoint removed Feb 2026)
// Reads/writes artist_cache in IndexedDB, fetches concurrently (pool=5)
export async function fetchArtistGenres(albums, onProgress) {
  const idSet = new Set()
  for (const a of albums)
    for (const ar of (a.artists || []))
      if (ar.id) idSet.add(ar.id)

  const allIds    = [...idSet]
  const genreMap  = new Map()

  // Populate from cache first
  const db     = await getDb()
  const cached = await db.getAll('artist_cache')
  for (const e of cached) genreMap.set(e.id, e.genres)

  const uncached = allIds.filter(id => !genreMap.has(id))
  let done = allIds.length - uncached.length
  onProgress(done, allIds.length)

  const fetchOne = async (id) => {
    try {
      const data   = await get(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`)
      const genres = data.genres || []
      genreMap.set(id, genres)
      db.put('artist_cache', { id, genres, cachedAt: Date.now() }).catch(() => {})
    } catch {
      genreMap.set(id, [])
    }
    done++
    onProgress(done, allIds.length)
  }

  const POOL = 5
  for (let i = 0; i < uncached.length; i += POOL)
    await Promise.all(uncached.slice(i, i + POOL).map(fetchOne))

  // Write genres back onto album objects (in-place mutation)
  const allGenres = new Set()
  for (const a of albums) {
    const ag = new Set()
    for (const ar of (a.artists || []))
      for (const g of (genreMap.get(ar.id) || [])) {
        ag.add(g)
        allGenres.add(g)
      }
    a._genres = [...ag]
  }

  return [...allGenres].sort()
}

export async function addToQueue(uri) {
  const token = await getToken()
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 404) throw new Error('No active Spotify device. Start playing something first.')
  if (res.status === 429) throw new Error('Rate limited. Try again in a moment.')
  if (!res.ok && res.status !== 204) throw new Error(`Queue error ${res.status}`)
}

// GET /me — returns the authenticated user's profile
export async function fetchCurrentUser() {
  return get('https://api.spotify.com/v1/me')
}

// GET /me/playlists — paginated, returns only playlists owned by userId
export async function fetchUserPlaylists(userId) {
  const results = []
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50'
  while (url) {
    const data = await get(url)
    for (const p of data.items ?? []) {
      if (p.owner?.id === userId) {
        results.push({ id: p.id, name: p.name, trackCount: p.tracks?.total ?? 0 })
      }
    }
    url = data.next
  }
  return results
}

// GET /playlists/{id}/items — paginated, deduplicates by album ID, skips non-tracks
export async function fetchPlaylistItems(playlistId) {
  const albums = []
  const seen = new Set()
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=50`
  while (url) {
    const data = await get(url)
    for (const item of data.items ?? []) {
      if (item?.track?.type !== 'track') continue
      const album = item.track.album
      if (!album?.id || seen.has(album.id)) continue
      seen.add(album.id)
      albums.push(album)
    }
    url = data.next
  }
  return albums
}

// GET /albums/{id}/tracks — paginated, returns full track list (for non-library album queuing)
export async function fetchAlbumTracks(albumId) {
  const tracks = []
  let url = `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`
  while (url) {
    const data = await get(url)
    tracks.push(...(data.items ?? []))
    url = data.next
  }
  return tracks
}
