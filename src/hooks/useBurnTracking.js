import { useState, useEffect, useMemo } from 'react'
import { getDb } from '../lib/db.js'

export function useBurnTracking() {
  const [burnedMap,   setBurnedMap]   = useState(new Map()) // Map<carouselId, Set<albumId>>
  const [burnEvents,  setBurnEvents]  = useState([])
  const [resetTimes,  setResetTimes]  = useState(new Map()) // Map<carouselId, number>
  const [resetCounts, setResetCounts] = useState(new Map()) // Map<carouselId, number>

  // Load all burn data on mount
  useEffect(() => {
    getDb().then(async db => {
      const [events, resets] = await Promise.all([
        db.getAll('burn_events'),
        db.getAll('burn_resets'),
      ])

      const rt = new Map(resets.map(r => [r.carouselId, r.resetAt]))
      const rc = new Map(resets.map(r => [r.carouselId, r.resetCount ?? 0]))

      // Build burnedMap: only events after the last reset for that carousel
      const bm = new Map()
      for (const ev of events) {
        const resetAt = rt.get(ev.carouselId) ?? 0
        if (ev.burnedAt > resetAt) {
          if (!bm.has(ev.carouselId)) bm.set(ev.carouselId, new Set())
          bm.get(ev.carouselId).add(ev.albumId)
        }
      }

      setBurnEvents(events)
      setResetTimes(rt)
      setResetCounts(rc)
      setBurnedMap(bm)
    }).catch(() => {})
  }, [])

  function isBurned(albumId, carouselId) {
    if (!albumId || !carouselId) return false
    return burnedMap.get(carouselId)?.has(albumId) ?? false
  }

  async function burnAlbum(album, carouselId, action) {
    if (!album?.id || !carouselId) return
    const event = {
      id:         crypto.randomUUID(),
      albumId:    album.id,
      albumName:  album.name,
      artist:     album.artists?.[0]?.name ?? '',
      carouselId,
      action,
      burnedAt:   Date.now(),
    }
    try {
      const db = await getDb()
      await db.add('burn_events', event)
    } catch {
      return
    }
    setBurnEvents(prev => [...prev, event])
    setBurnedMap(prev => {
      const next = new Map(prev)
      if (!next.has(carouselId)) next.set(carouselId, new Set())
      next.set(carouselId, new Set(next.get(carouselId)).add(album.id))
      return next
    })
  }

  async function resetCarousel(carouselId) {
    const resetAt = Date.now()
    try {
      const db = await getDb()
      const existing = await db.get('burn_resets', carouselId)
      const resetCount = (existing?.resetCount ?? 0) + 1
      await db.put('burn_resets', { carouselId, resetAt, resetCount })
      setResetCounts(prev => new Map(prev).set(carouselId, resetCount))
    } catch {
      return
    }
    setResetTimes(prev => new Map(prev).set(carouselId, resetAt))
    setBurnedMap(prev => {
      const next = new Map(prev)
      next.set(carouselId, new Set())
      return next
    })
  }

  const burnStats = useMemo(() => {
    if (!burnEvents.length) return {
      totalBurned: 0,
      lastBurnedAt: null,
      mostBurnedCarouselId: null,
      perCarousel: new Map(),
    }

    let lastBurnedAt = 0
    const countByCarousel = new Map()
    const lastBurnByCarousel = new Map()

    for (const ev of burnEvents) {
      if (ev.burnedAt > lastBurnedAt) lastBurnedAt = ev.burnedAt

      const c = ev.carouselId
      countByCarousel.set(c, (countByCarousel.get(c) ?? 0) + 1)
      if ((ev.burnedAt ?? 0) > (lastBurnByCarousel.get(c) ?? 0)) {
        lastBurnByCarousel.set(c, ev.burnedAt)
      }
    }

    let mostBurnedCarouselId = null
    let maxCount = 0
    for (const [id, count] of countByCarousel) {
      if (count > maxCount) { maxCount = count; mostBurnedCarouselId = id }
    }

    // Per-carousel stats (all-time burn count + last burned + reset count)
    const perCarousel = new Map()
    for (const [carouselId, burnedCount] of countByCarousel) {
      perCarousel.set(carouselId, {
        burnedCount,
        lastBurnedAt: lastBurnByCarousel.get(carouselId) ?? null,
        resetCount:   resetCounts.get(carouselId) ?? 0,
      })
    }

    return {
      totalBurned: burnEvents.length,
      lastBurnedAt: lastBurnedAt || null,
      mostBurnedCarouselId,
      perCarousel,
    }
  }, [burnEvents, resetCounts])

  return { isBurned, burnAlbum, resetCarousel, burnStats, burnedMap }
}
