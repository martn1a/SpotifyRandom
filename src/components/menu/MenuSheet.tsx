import { motion, AnimatePresence } from 'framer-motion'
import { Settings, LogOut, X } from 'lucide-react'

interface MenuSheetProps {
  open: boolean
  onClose: () => void
  onOpenSettings: () => void
  onSignOut: () => void
  burnStats: { burned: number; resets: number; lastBurn: string | null }
}

export default function MenuSheet({ open, onClose, onOpenSettings, onSignOut, burnStats }: MenuSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            className="relative w-72 bg-card h-full p-6 flex flex-col"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between mb-8">
              <p className="text-lg font-black tracking-widest text-ink">SONAR</p>
              <button onClick={onClose}><X size={20} className="text-ink-muted" /></button>
            </div>

            <div className="bg-card-raised border border-border rounded-xl p-4 mb-6">
              <p className="text-[10px] font-semibold tracking-widest text-ink-subtle mb-3">BURN ANALYTICS</p>
              <div className="flex justify-between">
                <div className="text-center">
                  <p className="text-2xl font-black text-accent">{burnStats.burned}</p>
                  <p className="text-[9px] tracking-wider text-ink-subtle">BURNED</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-ink">{burnStats.resets}</p>
                  <p className="text-[9px] tracking-wider text-ink-subtle">RESETS</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-ink">{burnStats.lastBurn ?? '—'}</p>
                  <p className="text-[9px] tracking-wider text-ink-subtle">LAST BURN</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={() => { onOpenSettings(); onClose() }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card-raised border border-border text-sm font-semibold text-ink"
              >
                <Settings size={16} className="text-ink-muted" /> Settings
              </button>
              <button
                onClick={onSignOut}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card-raised border border-border text-sm font-semibold text-ink-muted"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
