import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils.js'

const MAIN_TABS = [
  {
    id: 'discover',
    label: 'Discover',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    ),
  },
  {
    id: 'browse',
    label: 'Browse',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'later',
    label: 'Later',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
]

const BROWSE_SUB_TABS = [
  { id: 'library',  label: 'Library' },
  { id: 'insights', label: 'Insights' },
  { id: 'explore',  label: 'Explore' },
]

export default function TabBar({ activeTab, onTabChange, browseSubTab, onBrowseSubTabChange }) {
  return (
    <div className="flex-shrink-0 pb-safe border-t border-border-subtle" style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      {/* Browse sub-tabs (only visible when Browse is active) */}
      <AnimatePresence>
        {activeTab === 'browse' && (
          <motion.div
            key="sub-strip"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex border-b border-border-subtle px-4 pt-2 overflow-hidden"
          >
            {BROWSE_SUB_TABS.map(sub => (
              <button
                key={sub.id}
                onClick={() => onBrowseSubTabChange(sub.id)}
                className={cn(
                  'flex-1 pb-2 text-xs font-bold uppercase tracking-widest transition-colors relative',
                  browseSubTab === sub.id ? 'text-accent' : 'text-ink-muted'
                )}
              >
                {sub.label}
                {browseSubTab === sub.id && (
                  <motion.div
                    layoutId="browse-sub-indicator"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full"
                  />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main tabs */}
      <nav className="flex h-16">
        {MAIN_TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-accent' : 'text-ink-muted'
              )}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
