import { describe, it, expect } from 'vitest'
import { getAlbumBadges, getSimilarAlbums } from '../lib/badge-utils.js'

// Minimal album fixture
const makeAlbum = (overrides = {}) => ({
  id: 'a1',
  release_date: '1995-01-01',
  _discogsGenres: [],
  tracks: { items: Array(10).fill({}) },
  ...overrides,
})

describe('getAlbumBadges', () => {
  it('returns Unheard badge when listenCount is 0', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 0 })
    expect(badges.some(b => b.value === 'unheard')).toBe(true)
  })

  it('returns Hidden Gem badge when listenCount is between 1 and 4', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 3 })
    expect(badges.some(b => b.value === 'hidden-gem')).toBe(true)
  })

  it('returns Heavy Rotation badge when listenCount > 50', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 75 })
    expect(badges.some(b => b.value === 'heavy-rotation')).toBe(true)
  })

  it('returns Masterpiece badge when listenCount > 100', () => {
    const badges = getAlbumBadges(makeAlbum(), { listenCount: 120 })
    expect(badges.some(b => b.value === 'masterpiece')).toBe(true)
  })

  it('returns Vintage badge for pre-1970 releases', () => {
    const badges = getAlbumBadges(makeAlbum({ release_date: '1965-01-01' }), null)
    expect(badges.some(b => b.value === 'vintage')).toBe(true)
  })

  it('returns Golden Oldie badge for 1970s releases', () => {
    const badges = getAlbumBadges(makeAlbum({ release_date: '1975-01-01' }), null)
    expect(badges.some(b => b.value === 'golden-oldie')).toBe(true)
  })

  it('returns Brand New badge for 2024+ releases', () => {
    const badges = getAlbumBadges(makeAlbum({ release_date: '2024-06-01' }), null)
    expect(badges.some(b => b.value === 'brand-new')).toBe(true)
  })

  it('returns Epic LP badge when track count >= 15', () => {
    const album = makeAlbum({ tracks: { items: Array(16).fill({}) } })
    const badges = getAlbumBadges(album, null)
    expect(badges.some(b => b.value === 'epic-lp')).toBe(true)
  })

  it('returns EP badge when track count <= 6', () => {
    const album = makeAlbum({ tracks: { items: Array(5).fill({}) } })
    const badges = getAlbumBadges(album, null)
    expect(badges.some(b => b.value === 'ep')).toBe(true)
  })

  it('returns empty array when stats is null and album is unremarkable', () => {
    // Release 1995, 10 tracks, no genres → no badges
    const badges = getAlbumBadges(makeAlbum(), null)
    expect(badges).toEqual([])
  })
})

describe('getSimilarAlbums', () => {
  const library = [
    makeAlbum({ id: 'a1', _discogsGenres: ['rock', 'alternative'] }),
    makeAlbum({ id: 'a2', _discogsGenres: ['rock', 'grunge'] }),
    makeAlbum({ id: 'a3', _discogsGenres: ['jazz', 'blues'] }),
    makeAlbum({ id: 'a4', _discogsGenres: ['rock', 'indie'] }),
    makeAlbum({ id: 'a5', _discogsGenres: ['electronic', 'ambient'] }),
  ]
  const currentAlbum = library[0] // a1, rock cluster

  it('excludes the current album from results', () => {
    const results = getSimilarAlbums(currentAlbum, library, 4)
    expect(results.find(a => a.id === 'a1')).toBeUndefined()
  })

  it('returns only albums from the same genre cluster', () => {
    const results = getSimilarAlbums(currentAlbum, library, 4)
    // a2 (rock/grunge) and a4 (rock/indie) should be included; a3 (jazz) and a5 (electronic) should not
    expect(results.some(a => a.id === 'a2')).toBe(true)
    expect(results.some(a => a.id === 'a4')).toBe(true)
    expect(results.some(a => a.id === 'a3')).toBe(false)
    expect(results.some(a => a.id === 'a5')).toBe(false)
  })

  it('respects the count limit', () => {
    const results = getSimilarAlbums(currentAlbum, library, 1)
    expect(results.length).toBe(1)
  })

  it('returns empty array when no genres match', () => {
    const albumNoGenre = makeAlbum({ id: 'ax', _discogsGenres: [] })
    const results = getSimilarAlbums(albumNoGenre, library, 4)
    expect(results).toEqual([])
  })
})
