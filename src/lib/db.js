import { openDB } from 'idb'

const DB_NAME = 'albumdisc_react_v1'
const DB_VERSION = 3

let _db = null

export async function getDb() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        // Spotify library cache
        if (!db.objectStoreNames.contains('library'))
          db.createObjectStore('library')

        // Artist genre cache
        if (!db.objectStoreNames.contains('artist_cache'))
          db.createObjectStore('artist_cache', { keyPath: 'id' })

        // Queue history (albums queued to Spotify)
        if (!db.objectStoreNames.contains('history'))
          db.createObjectStore('history', { keyPath: 'id' })

        // Listen Later queue
        if (!db.objectStoreNames.contains('listen_later'))
          db.createObjectStore('listen_later', { keyPath: 'id' })

        // User settings
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings')
      }

      if (oldVersion < 2) {
        // Burn events — append-only analytics log
        const evStore = db.createObjectStore('burn_events', { keyPath: 'id' })
        evStore.createIndex('by_carousel', 'carouselId')
        evStore.createIndex('by_burnedAt', 'burnedAt')

        // Burn resets — one record per carousel, tracks last reset time
        db.createObjectStore('burn_resets', { keyPath: 'carouselId' })
      }

      if (oldVersion < 3) {
        // Playlist metadata list (own playlists from Spotify)
        if (!db.objectStoreNames.contains('playlists_meta'))
          db.createObjectStore('playlists_meta')

        // Albums per playlist (keyed by playlist ID)
        if (!db.objectStoreNames.contains('playlist_albums'))
          db.createObjectStore('playlist_albums')
      }
    },
  })
  return _db
}
