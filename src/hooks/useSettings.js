import { useState, useCallback } from 'react'
import { CAROUSEL_DEFAULTS } from '../lib/constants.ts'

const SETTINGS_KEY = 'sonar_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    const saved = loadSettings()
    return {
      carouselConfig: saved?.carouselConfig ?? CAROUSEL_DEFAULTS,
      selectedPlaylistIds: saved?.selectedPlaylistIds ?? [],
    }
  })

  function save(next) {
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  const updateCarousel = useCallback((id, patch) => {
    save({
      ...settings,
      carouselConfig: settings.carouselConfig.map(c => c.id === id ? { ...c, ...patch } : c),
    })
  }, [settings])

  const reorderCarousels = useCallback((ordered) => {
    save({ ...settings, carouselConfig: ordered.map((c, i) => ({ ...c, order: i })) })
  }, [settings])

  const togglePlaylist = useCallback((id) => {
    const ids = settings.selectedPlaylistIds
    save({
      ...settings,
      selectedPlaylistIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    })
  }, [settings])

  return {
    carouselConfig: settings.carouselConfig,
    selectedPlaylistIds: settings.selectedPlaylistIds,
    updateCarousel,
    reorderCarousels,
    togglePlaylist,
  }
}
