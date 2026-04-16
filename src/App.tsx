import { useState, useEffect, Suspense, lazy } from 'react'
import { AnimatePresence } from 'framer-motion'
import { isLoggedIn, handleCallback, login } from './lib/auth.js'
import TabBar, { type Tab } from './components/TabBar'
import Toast from './components/Toast'

const DiscoverTab = lazy(() => import('./components/discover/DiscoverTab'))
const BrowseTab   = lazy(() => import('./components/browse/BrowseTab'))
const LaterTab    = lazy(() => import('./components/later/LaterTab'))

function LoginScreen() {
  function handleLogin() {
    login()
  }
  return (
    <div className="h-dvh bg-page flex flex-col items-center justify-center gap-6 px-8">
      <p className="text-3xl font-black tracking-tight text-ink">SONAR</p>
      <p className="text-sm text-ink-muted text-center">Your music, rediscovered.</p>
      <button
        onClick={handleLogin}
        className="bg-accent text-black font-bold px-8 py-3 rounded-full text-sm"
      >
        Connect Spotify
      </button>
    </div>
  )
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('discover')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (code && state) {
      handleCallback(code, state)
        .then(() => setLoggedIn(true))
        .catch(err => console.error('OAuth callback failed:', err))
    } else {
      setLoggedIn(isLoggedIn())
    }
  }, [])

  if (!loggedIn) return <LoginScreen />

  return (
    <div className="h-dvh bg-page flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden pb-14">
        <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}>
          {activeTab === 'discover' && <DiscoverTab onToast={setToast} />}
          {activeTab === 'browse'   && <BrowseTab   onToast={setToast} />}
          {activeTab === 'later'    && <LaterTab    onToast={setToast} />}
        </Suspense>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <AnimatePresence>
        {toast && <Toast message={toast} onClear={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}
