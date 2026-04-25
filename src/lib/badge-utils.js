/**
 * Returns an array of badge objects for an album.
 * @param {object} album  - Spotify album (has _discogsGenres, release_date, tracks.items)
 * @param {object|null} stats - Last.fm stats from getAlbumStats() (has listenCount), or null
 * @returns {Array<{ value: string, label: string, icon: string, color: string }>}
 */
export function getAlbumBadges(album, stats) {
  const badges = []
  const year = parseInt((album.release_date || '').substring(0, 4))
  const trackCount = album.tracks?.items?.length ?? 0
  const listenCount = stats?.listenCount ?? null

  // ── Listen count badges ──────────────────────────────────────────────
  if (listenCount !== null) {
    if (listenCount === 0) {
      badges.push({ value: 'unheard', label: 'Unheard', icon: '🌑', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' })
    } else if (listenCount > 100) {
      badges.push({ value: 'masterpiece', label: 'Masterpiece', icon: '👑', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' })
    } else if (listenCount > 50) {
      badges.push({ value: 'heavy-rotation', label: 'Heavy Rotation', icon: '🎧', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' })
    } else if (listenCount < 5) {
      badges.push({ value: 'hidden-gem', label: 'Hidden Gem', icon: '💎', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' })
    }
  }

  // ── Era badges ───────────────────────────────────────────────────────
  if (!isNaN(year)) {
    if (year < 1970) {
      badges.push({ value: 'vintage', label: 'Vintage', icon: '📻', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
    } else if (year < 1980) {
      badges.push({ value: 'golden-oldie', label: 'Golden Oldie', icon: '📀', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' })
    } else if (year >= 2024) {
      badges.push({ value: 'brand-new', label: 'Brand New', icon: '🔥', color: 'bg-red-500/20 text-red-400 border-red-500/30' })
    } else if (year >= 2020) {
      badges.push({ value: 'recent', label: 'Recent', icon: '✨', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
    }
  }

  // ── Format badges ────────────────────────────────────────────────────
  if (trackCount >= 15) {
    badges.push({ value: 'epic-lp', label: 'Epic LP', icon: '📚', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  } else if (trackCount > 0 && trackCount <= 6) {
    badges.push({ value: 'ep', label: 'EP / Short', icon: '💿', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  }

  // ── Genre/mood badges ────────────────────────────────────────────────
  const dg = album._genres || []

  if (dg.includes('Electronic')) {
    badges.push({ value: 'late-night', label: 'Late Night', icon: '🌙', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' })
  }
  if (dg.includes('Jazz') || dg.includes('Classical')) {
    badges.push({ value: 'focus', label: 'Focus', icon: '🧠', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' })
  }

  return badges
}

/**
 * Returns albums from the library that share the same genre cluster as the given album.
 * @param {object} album    - The current album (has _genres)
 * @param {object[]} library - Full Spotify library array
 * @param {number} count    - Max number of results to return
 * @returns {object[]}
 */
export function getSimilarAlbums(album, library, count = 4) {
  const dg = new Set(album._genres || [])

  if (dg.size === 0) return []

  return library
    .filter(a => {
      if (a.id === album.id) return false
      return (a._genres || []).some(g => dg.has(g))
    })
    .slice(0, count)
}
