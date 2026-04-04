import { useState, useEffect } from 'react'
import { getDb } from '../lib/db.js'

export function useListenLater() {
  const [items, setItems] = useState([])

  useEffect(() => {
    getDb()
      .then(db => db.getAll('listen_later'))
      .then(setItems)
      .catch(() => {})
  }, [])

  async function save(album) {
    const item = { ...album, _savedAt: Date.now() }
    const db = await getDb()
    await db.put('listen_later', item)
    setItems(prev => [...prev.filter(i => i.id !== album.id), item])
  }

  async function remove(id) {
    const db = await getDb()
    await db.delete('listen_later', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function isSaved(id) {
    return items.some(i => i.id === id)
  }

  return { items, save, remove, isSaved }
}
