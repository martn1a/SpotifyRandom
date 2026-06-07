import { useState, useEffect, useMemo, Component } from 'react'
import { isLoggedIn, handleCallback, logout } from './lib/auth.js'
import { getDb } from './lib/db.js'
import { useLibrary } from './hooks/useLibrary.js'
import { useLastfm } from './hooks/useLastfm.js'
import { useListenLater } from './hooks/useListenLater.js'
import { usePlaylists } from './hooks/usePlaylists.js'
import { useSkin } from './hooks/useSkin.js'
import LoginScreen from './components/LoginScreen.jsx'
import Header from './components/layout/Header.jsx'
import TabBar from './components/layout/TabBar.jsx'
import DiscoverTab from './components/discover/DiscoverTab.jsx'
import BrowseTab from './components/browse/BrowseTab.jsx'
import ListenLaterTab from './components/listen-later/ListenLaterTab.jsx'

// ── Error boundary (catches render errors per tab) ────────────────────

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3">
          <p className="text-2xl">⚠️</p>
          <p className="text-sm font-medium text-ink">Something went wrong</p>
          <p className="text-[11px] text-ink-muted max-w-xs">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-1 px-4 py-2 bg-accent text-black font-semibold text-[13px] rounded-xl"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Loading screen (shown while album library is fetching) ────────────

function LoadingScreen({ progress }) {
  const { done, total } = progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="h-dvh bg-page flex flex-col items-center justify-center px-8 gap-6">
      <p className="text-base font-medium text-ink">Loading your library…</p>

      {total > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div className="h-1 bg-card-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-ink-muted text-center">
            {done} / {total} albums
          </p>
        </div>
      )}
    </div>
  )
}

// ── Module-level helpers ──────────────────────────────────────────────

function defaultCarouselSettings() {
  return {
    _order: ['most-played', 'latest-discoveries', 'recently-added', 'golden-oldies', 'climbers', 'fallers', 'on-this-day', 'overdue', 'peak-nostalgie', 'long-waiting', 'artist-gaps', 'former-love', 'genre-dive', 'gateway', 'streaks'],
    'most-played':        { visible: true, sort: 'original' },
    'latest-discoveries': { visible: true, sort: 'original' },
    'golden-oldies':      { visible: true, sort: 'original' },
    'climbers':           { visible: true, sort: 'original' },
    'fallers':            { visible: true, sort: 'original' },
    'on-this-day':        { visible: true, sort: 'original' },
    'recently-added':     { visible: true, sort: 'original' },
    'overdue':            { visible: true, sort: 'original' },
    'peak-nostalgie':     { visible: true, sort: 'original' },
    'long-waiting':       { visible: true, sort: 'original' },
    'artist-gaps':        { visible: true, sort: 'original' },
    'former-love':        { visible: true, sort: 'original' },
    'genre-dive':         { visible: true, sort: 'original' },
    'gateway':            { visible: true, sort: 'original' },
    'streaks':            { visible: true },
  }
}

// ── Main app (post-login) ─────────────────────────────────────────────

function MainApp({ onLogout }) {
  const [activeTab, setActiveTab] = useState('discover')
  const [browseSubTab, setBrowseSubTab] = useState('library')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState(null)
  const [carouselSettings, setCarouselSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonar_carousel_settings')) ?? defaultCarouselSettings()
    } catch {
      return defaultCarouselSettings()
    }
  })

  const [skin, setSkin] = useSkin()

  const {
    albums, genresLoading, albumsLoading, albumsProgress, error: libraryError
  } = useLibrary()

  const { getAlbumStats, lastfmMap, onThisDay, loaded: lastfmLoaded, meta: lastfmMeta, refresh: refreshLastfm, albumTagsMap } = useLastfm()

  const enrichedAlbums = useMemo(() => {
    return albums.map(a => {
      if ((a._genres || []).length > 0) return a
      const key = `${a.artists?.[0]?.name || ''}||${a.name}`.toLowerCase()
      const lfmTags = albumTagsMap.get(key) || []
      return { ...a, _genres: lfmTags }
    })
  }, [albums, albumTagsMap])
  const { items: listenLater, save: saveLater, remove: removeLater, isSaved } = useListenLater()

  const [selectedPlaylists, setSelectedPlaylists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonar_selected_playlists')) ?? []
    } catch { return [] }
  })

  const { playlists, playlistAlbums, loading: playlistsLoading, error: playlistsError, refreshPlaylists } = usePlaylists(selectedPlaylists)

  const [hideLibraryAlbums, setHideLibraryAlbums] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonar_hide_library_albums')) ?? false
    } catch { return false }
  })

  function updateHideLibraryAlbums(value) {
    setHideLibraryAlbums(value)
    localStorage.setItem('sonar_hide_library_albums', JSON.stringify(value))
  }

  function updateSelectedPlaylists(ids) {
    const capped = ids.slice(0, 5)
    setSelectedPlaylists(capped)
    localStorage.setItem('sonar_selected_playlists', JSON.stringify(capped))
  }

  function updateCarouselOrder(newOrder) {
    setCarouselSettings(prev => {
      const next = { ...prev, _order: newOrder }
      localStorage.setItem('sonar_carousel_settings', JSON.stringify(next))
      return next
    })
  }

  async function handleRefresh() {
    const db = await getDb()
    await db.delete('library', 'albums')
    window.location.reload()
  }

  function handleExportLibrary() {
    const list = albums.map(a => ({
      artist: a.artists?.[0]?.name || '',
      album:  a.name,
    }))
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spotify-library.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (libraryError) {
    return (
      <div className="h-dvh bg-page flex flex-col items-center justify-center px-8 gap-4">
        <p className="text-sm font-medium text-ink">Failed to load library</p>
        <p className="text-xs text-ink-muted text-center">{libraryError}</p>
        <button
          onClick={onLogout}
          className="mt-2 px-4 py-2 bg-accent text-black font-semibold text-sm rounded-xl"
        >
          Sign out and retry
        </button>
      </div>
    )
  }

  if (albumsLoading) {
    return <LoadingScreen progress={albumsProgress} />
  }

  function handleBadgeClick(badge) {
    setLibraryFilter(badge)
    setActiveTab('browse')
    setBrowseSubTab('library')
  }

  function updateCarouselSettings(id, patch) {
    setCarouselSettings(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } }
      localStorage.setItem('sonar_carousel_settings', JSON.stringify(next))
      return next
    })
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'discover': return (
        <DiscoverTab
          albums={enrichedAlbums}
          genresLoading={genresLoading}
          getAlbumStats={getAlbumStats}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          onBadgeClick={handleBadgeClick}
        />
      )
      case 'browse': return (
        <BrowseTab
          albums={enrichedAlbums}
          getAlbumStats={getAlbumStats}
          lastfmMap={lastfmMap}
          lastfmLoaded={lastfmLoaded}
          onThisDay={onThisDay}
          genresLoading={genresLoading}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          activeSubTab={browseSubTab}
          onSubTabChange={setBrowseSubTab}
          libraryFilter={libraryFilter}
          onClearFilter={() => setLibraryFilter(null)}
          onBadgeClick={handleBadgeClick}
          carouselSettings={carouselSettings}
          onUpdateCarouselSettings={updateCarouselSettings}
          selectedPlaylists={selectedPlaylists}
          playlistAlbums={playlistAlbums}
          playlistsLoading={playlistsLoading}
          playlists={playlists}
          hideLibraryAlbums={hideLibraryAlbums}
        />
      )
      case 'later': return (
        <ListenLaterTab
          items={listenLater}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          getAlbumStats={getAlbumStats}
          albums={enrichedAlbums}
          onBadgeClick={handleBadgeClick}
        />
      )
      default: return null
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-page overflow-hidden">
      <Header
        onLogout={onLogout}
        albumCount={albums.length}
        lastfmMeta={lastfmMeta}
        onRefresh={handleRefresh}
        onRefreshLastfm={refreshLastfm}
        isSidebarOpen={isSidebarOpen}
        onSidebarOpen={() => setIsSidebarOpen(true)}
        onSidebarClose={() => setIsSidebarOpen(false)}
        isSettingsOpen={isSettingsOpen}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onSettingsClose={() => setIsSettingsOpen(false)}
        carouselSettings={carouselSettings}
        onUpdateCarouselSettings={updateCarouselSettings}
        onUpdateCarouselOrder={updateCarouselOrder}
        playlists={playlists}
        playlistsLoading={playlistsLoading}
        playlistsError={playlistsError}
        selectedPlaylists={selectedPlaylists}
        onUpdateSelectedPlaylists={updateSelectedPlaylists}
        onRefreshPlaylists={refreshPlaylists}
        hideLibraryAlbums={hideLibraryAlbums}
        onUpdateHideLibraryAlbums={updateHideLibraryAlbums}
        onExportLibrary={handleExportLibrary}
        skin={skin}
        onSkinChange={setSkin}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <ErrorBoundary key={activeTab}>
          {renderTab()}
        </ErrorBoundary>
      </main>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        browseSubTab={browseSubTab}
        onBrowseSubTabChange={setBrowseSubTab}
      />
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn,   setLoggedIn]   = useState(isLoggedIn)
  const [authError,  setAuthError]  = useState(null)
  const [handlingCb, setHandlingCb] = useState(false)

  // Handle Spotify OAuth callback (?code=...&state=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const state  = params.get('state')
    const error  = params.get('error')

    if (error) {
      setAuthError('Spotify login cancelled or denied.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (code && state) {
      setHandlingCb(true)
      handleCallback(code, state)
        .then(() => setLoggedIn(true))
        .catch(err => setAuthError(err.message))
        .finally(() => setHandlingCb(false))
    }
  }, [])

  if (handlingCb) {
    return (
      <div className="h-dvh bg-page flex items-center justify-center">
        <p className="text-sm text-ink-secondary">Connecting to Spotify…</p>
      </div>
    )
  }

  if (!loggedIn) {
    return <LoginScreen error={authError} />
  }

  return (
    <MainApp onLogout={() => { logout(); setLoggedIn(false) }} />
  )
}
