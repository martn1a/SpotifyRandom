import { useState, useEffect } from 'react'
import { isLoggedIn, handleCallback, logout } from './lib/auth.js'
import { useLibrary } from './hooks/useLibrary.js'
import { useLastfm } from './hooks/useLastfm.js'
import LoginScreen from './components/LoginScreen.jsx'
import Header from './components/layout/Header.jsx'
import TabBar from './components/layout/TabBar.jsx'
import DiscoverTab from './components/discover/DiscoverTab.jsx'
import LibraryTab from './components/library/LibraryTab.jsx'
import StatsTab from './components/stats/StatsTab.jsx'
import ListenLaterTab from './components/listen-later/ListenLaterTab.jsx'

// ── Loading screen (shown while album library is fetching) ────────────

function LoadingScreen({ progress }) {
  const { done, total } = progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="h-dvh bg-page flex flex-col items-center justify-center px-8 gap-6">
      <p className="text-base font-medium text-ink">Loading your library…</p>

      {total > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-ink rounded-full transition-all duration-300"
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

// ── Main app (post-login) ─────────────────────────────────────────────

function MainApp({ onLogout }) {
  const [activeTab, setActiveTab] = useState('library')

  const {
    albums, genresLoading, albumsLoading, albumsProgress, error: libraryError
  } = useLibrary()

  const { getAlbumStats } = useLastfm()

  if (libraryError) {
    return (
      <div className="h-dvh bg-page flex flex-col items-center justify-center px-8 gap-4">
        <p className="text-sm font-medium text-ink">Failed to load library</p>
        <p className="text-xs text-ink-muted text-center">{libraryError}</p>
        <button
          onClick={onLogout}
          className="mt-2 px-4 py-2 bg-ink text-white text-sm rounded-xl"
        >
          Sign out and retry
        </button>
      </div>
    )
  }

  if (albumsLoading) {
    return <LoadingScreen progress={albumsProgress} />
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'discover': return <DiscoverTab albums={albums} getAlbumStats={getAlbumStats} />
      case 'library':  return (
        <LibraryTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          genresLoading={genresLoading}
        />
      )
      case 'stats':    return <StatsTab getAlbumStats={getAlbumStats} />
      case 'later':    return <ListenLaterTab />
      default:         return null
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-page overflow-hidden">
      <Header onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderTab()}
      </main>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
