import { openDB } from 'idb'

const DB_NAME = 'albumdisc_react_v1'
const DB_VERSION = 1

let _db = null

export async function getDb() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
    },
  })
  return _db
}
