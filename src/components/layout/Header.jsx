import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils.js'

const CAROUSEL_LABELS = {
  'most-played':        '👑 Most Played',
  'latest-discoveries': '🔭 Latest Discoveries',
  'golden-oldies':      '🕰️ Golden Oldies',
  'climbers':           '📈 Climbers',
  'fallers':            '📉 Fallers',
  'on-this-day':        '📅 On This Day',
}

const SORT_OPTIONS = [
  { id: 'original', label: 'Default' },
  { id: 'added',    label: 'By Date' },
  { id: 'relevance', label: 'By Plays' },
]

function DraggableList({ items, onReorder, renderItem }) {
  const [localItems, setLocalItems] = useState(items)
  const [dragIdx, setDragIdx] = useState(null)

  useEffect(() => { setLocalItems(items) }, [items])

  function handleDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnter(idx) {
    if (dragIdx === null || dragIdx === idx) return
    const next = [...localItems]
    const [item] = next.splice(dragIdx, 1)
    next.splice(idx, 0, item)
    setLocalItems(next)
    setDragIdx(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
    onReorder(localItems.map(i => i.id))
  }

  return (
    <div>
      {localItems.map((item, idx) => (
        <div
          key={item.id}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragEnter={() => handleDragEnter(idx)}
          onDragOver={e => e.preventDefault()}
          onDragEnd={handleDragEnd}
          style={{ opacity: dragIdx === idx ? 0.4 : 1, transition: 'opacity 0.15s' }}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  )
}

function Sidebar({ isOpen, onClose, onSettingsOpen, onLogout }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-card z-50 border-r border-border-subtle flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-border-subtle">
              <span className="font-black text-lg tracking-tight">SONAR</span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-ink-muted"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4">
              <button
                onClick={() => { onSettingsOpen(); onClose() }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-card-raised transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-border-subtle flex items-center justify-center text-ink-muted">
                  ⚙
                </div>
                <div>
                  <p className="font-bold text-sm">Settings</p>
                  <p className="text-xs text-ink-muted">Customize your experience</p>
                </div>
              </button>
            </div>

            <div className="p-6 border-t border-border-subtle">
              <button
                onClick={onLogout}
                className="text-sm text-ink-muted hover:text-ink transition-colors font-medium"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SettingsModal({
  isOpen,
  onClose,
  albumCount,
  lastfmMeta,
  onRefresh,
  carouselSettings,
  onUpdateCarouselSettings,
  onUpdateCarouselOrder,
  playlists,
  playlistsLoading,
  playlistsError,
  selectedPlaylists,
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
}) {
  const [expandedSection, setExpandedSection] = useState(null)

  const toggle = (id) => setExpandedSection(prev => prev === id ? null : id)

  const metaDate = lastfmMeta?.generatedAt
    ? new Date(lastfmMeta.generatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg bg-card z-50 rounded-3xl border border-border-subtle overflow-hidden flex flex-col max-h-[88vh] shadow-2xl"
          >
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Settings</h2>
                <p className="text-xs text-ink-muted">Personalize your SONAR experience</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-card-raised flex items-center justify-center text-ink-muted"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {/* Sync section */}
              <div>
                <button
                  onClick={() => toggle('sync')}
                  className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
                >
                  <span>Data Synchronization</span>
                  <span className="text-ink-muted">{expandedSection === 'sync' ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {expandedSection === 'sync' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4 space-y-3">
                        <div className="flex items-center justify-between bg-card-raised p-4 rounded-2xl border border-border-subtle">
                          <div>
                            <p className="font-bold text-sm">Spotify Library</p>
                            <p className="text-xs text-ink-muted">{albumCount} albums cached</p>
                          </div>
                          <button
                            onClick={onRefresh}
                            className="px-4 py-2 bg-accent text-page text-xs font-bold rounded-xl"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="bg-card-raised p-4 rounded-2xl border border-border-subtle">
                          <p className="font-bold text-sm">Last.fm Data</p>
                          <p className="text-xs text-ink-muted mt-1">
                            {metaDate ? `Generated ${metaDate} · parser output` : 'No metadata'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Carousels section */}
              <div className="border-t border-border-subtle pt-2">
                <button
                  onClick={() => toggle('carousels')}
                  className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
                >
                  <span>Insights Carousels</span>
                  <span className="text-ink-muted">{expandedSection === 'carousels' ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {expandedSection === 'carousels' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4">
                        <DraggableList
                          items={(carouselSettings?._order ?? Object.keys(CAROUSEL_LABELS)).map(id => ({ id, label: CAROUSEL_LABELS[id] }))}
                          onReorder={onUpdateCarouselOrder}
                          renderItem={({ id, label }) => {
                            const settings = carouselSettings?.[id] || { visible: true, sort: 'original' }
                            return (
                              <div className="flex items-center gap-2 bg-card-raised p-3 rounded-xl border border-border-subtle mb-2">
                                <span className="text-ink-muted text-base select-none cursor-grab active:cursor-grabbing">⠿</span>
                                <span className="text-sm font-medium flex-1">{label}</span>
                                <div className="flex gap-1">
                                  {SORT_OPTIONS.map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => onUpdateCarouselSettings(id, { sort: opt.id })}
                                      className={cn(
                                        'px-2 py-1 rounded text-[10px] font-bold transition-all',
                                        settings.sort === opt.id
                                          ? 'bg-accent text-page'
                                          : 'text-ink-muted hover:text-ink'
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => onUpdateCarouselSettings(id, { visible: !settings.visible })}
                                  className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                                    settings.visible
                                      ? 'bg-accent/20 text-accent border-accent/30'
                                      : 'bg-transparent text-ink-muted border-border-subtle'
                                  )}
                                >
                                  {settings.visible ? 'On' : 'Off'}
                                </button>
                              </div>
                            )
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Explore Playlists section */}
              <div className="border-t border-border-subtle pt-2">
                <button
                  onClick={() => toggle('explore')}
                  className="w-full flex items-center justify-between py-3 font-bold text-sm text-ink"
                >
                  <span>Explore Playlists</span>
                  <span className="text-ink-muted">{expandedSection === 'explore' ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {expandedSection === 'explore' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4 space-y-3">
                        {/* Header row with refresh button */}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-ink-muted">Select up to 5 playlists</p>
                          <button
                            onClick={onRefreshPlaylists}
                            disabled={playlistsLoading}
                            className="text-xs text-accent font-medium disabled:opacity-50"
                          >
                            {playlistsLoading ? 'Loading…' : 'Refresh ↻'}
                          </button>
                        </div>

                        {/* Error state */}
                        {playlistsError && (
                          <p className="text-xs text-red-400">{playlistsError}</p>
                        )}

                        {/* Playlist picker */}
                        {!playlistsLoading && playlists.length === 0 && !playlistsError && (
                          <p className="text-xs text-ink-muted">No playlists found. Tap Refresh to load.</p>
                        )}
                        {playlists.length > 0 && (
                          <div className="max-h-60 overflow-y-auto rounded-xl border border-border-subtle bg-card-raised">
                            {playlists.map((pl, idx) => {
                              const isSelected = selectedPlaylists.includes(pl.id)
                              const atMax = selectedPlaylists.length >= 5 && !isSelected
                              return (
                                <button
                                  key={pl.id}
                                  disabled={atMax}
                                  onClick={() => {
                                    if (isSelected) {
                                      onUpdateSelectedPlaylists(selectedPlaylists.filter(id => id !== pl.id))
                                    } else {
                                      onUpdateSelectedPlaylists([...selectedPlaylists, pl.id])
                                    }
                                  }}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all',
                                    idx < playlists.length - 1 ? 'border-b border-border-subtle' : '',
                                    atMax ? 'opacity-40' : 'hover:bg-card'
                                  )}
                                >
                                  <span className={cn(
                                    'w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] border',
                                    isSelected
                                      ? 'bg-accent border-accent text-page'
                                      : 'border-border-subtle'
                                  )}>
                                    {isSelected ? '✓' : ''}
                                  </span>
                                  <span className="text-sm flex-1 truncate">{pl.name}</span>
                                  <span className="text-[11px] text-ink-muted flex-shrink-0">{pl.trackCount}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Reorder selected playlists */}
                        {selectedPlaylists.length > 1 && (
                          <>
                            <p className="text-xs text-ink-muted pt-1">Drag to reorder</p>
                            <DraggableList
                              items={selectedPlaylists.map(id => ({
                                id,
                                label: playlists.find(p => p.id === id)?.name ?? id,
                              }))}
                              onReorder={onUpdateSelectedPlaylists}
                              renderItem={({ label }) => (
                                <div className="flex items-center gap-3 bg-card-raised px-4 py-2.5 rounded-xl border border-border-subtle mb-2">
                                  <span className="text-ink-muted text-base select-none cursor-grab active:cursor-grabbing">⠿</span>
                                  <span className="text-sm flex-1 truncate">{label}</span>
                                </div>
                              )}
                            />
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Header({
  onLogout,
  albumCount,
  lastfmMeta,
  onRefresh,
  isSidebarOpen,
  onSidebarOpen,
  onSidebarClose,
  isSettingsOpen,
  onSettingsOpen,
  onSettingsClose,
  carouselSettings,
  onUpdateCarouselSettings,
  onUpdateCarouselOrder,
  playlists,
  playlistsLoading,
  playlistsError,
  selectedPlaylists,
  onUpdateSelectedPlaylists,
  onRefreshPlaylists,
}) {
  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 bg-page/90 border-b border-border-subtle flex-shrink-0 backdrop-blur-xl">
        {/* Hamburger */}
        <button
          onClick={onSidebarOpen}
          className="w-9 h-9 rounded-full bg-card-raised flex items-center justify-center text-ink hover:bg-border-subtle transition-all"
          aria-label="Open menu"
        >
          ☰
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-page">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
            </svg>
          </div>
          <span className="font-black tracking-tight text-lg">SONAR</span>
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-card-raised border border-border-subtle flex items-center justify-center text-ink-muted text-sm font-bold">
          ♪
        </div>
      </header>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={onSidebarClose}
        onSettingsOpen={onSettingsOpen}
        onLogout={onLogout}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onSettingsClose}
        albumCount={albumCount}
        lastfmMeta={lastfmMeta}
        onRefresh={onRefresh}
        carouselSettings={carouselSettings}
        onUpdateCarouselSettings={onUpdateCarouselSettings}
        onUpdateCarouselOrder={onUpdateCarouselOrder}
        playlists={playlists}
        playlistsLoading={playlistsLoading}
        playlistsError={playlistsError}
        selectedPlaylists={selectedPlaylists}
        onUpdateSelectedPlaylists={onUpdateSelectedPlaylists}
        onRefreshPlaylists={onRefreshPlaylists}
      />
    </>
  )
}
