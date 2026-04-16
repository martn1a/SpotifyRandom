import type { CarouselConfig } from './types'

export const CAROUSEL_DEFAULTS: CarouselConfig[] = [
  { id: 'most-played',        label: 'Most Played',        visible: true, sortMode: 'original', order: 0 },
  { id: 'latest-discoveries', label: 'Latest Discoveries', visible: true, sortMode: 'original', order: 1 },
  { id: 'golden-oldies',      label: 'Golden Oldies',      visible: true, sortMode: 'original', order: 2 },
  { id: 'climbers',           label: 'Climbers',           visible: true, sortMode: 'original', order: 3 },
  { id: 'fallers',            label: 'Fallers',            visible: true, sortMode: 'original', order: 4 },
  { id: 'on-this-day',        label: 'On This Day',        visible: true, sortMode: 'original', order: 5 },
]

export const GENRE_EMOJI: Record<string, string> = {
  'Electronic':   '🎛️',
  'Hip-Hop':      '🎤',
  'Rock':         '🎸',
  'Pop':          '🎵',
  'Jazz':         '🎷',
  'Classical':    '🎻',
  'R&B':          '🎙️',
  'Metal':        '🤘',
  'Folk':         '🪕',
  'Indie':        '🌿',
  'Alternative':  '⚡',
  'Other':        '🎶',
}

export const DECADE_CHIPS = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'] as const
