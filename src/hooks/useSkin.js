import { useState, useEffect } from 'react'

export const SKINS = [
  { id: 'oled',     label: 'OLED',     description: 'Pure black, battery saving' },
  { id: 'solar',    label: 'Solar',    description: 'Dark grey, outdoor readable' },
  { id: 'daylight', label: 'Daylight', description: 'Light, maximum visibility' },
]

const STORAGE_KEY = 'sonar_skin'
const DEFAULT_SKIN = 'oled'

function applyDataSkin(id) {
  if (id === DEFAULT_SKIN) {
    document.documentElement.removeAttribute('data-skin')
  } else {
    document.documentElement.setAttribute('data-skin', id)
  }
}

export function useSkin() {
  const [skin, setSkinState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SKINS.find(s => s.id === stored) ? stored : DEFAULT_SKIN
  })

  useEffect(() => {
    applyDataSkin(skin)
  }, [skin])

  function setSkin(id) {
    localStorage.setItem(STORAGE_KEY, id)
    setSkinState(id)
  }

  return [skin, setSkin]
}
