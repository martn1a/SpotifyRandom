import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface Preset {
  id: string
  label: string
  description: string
  isBuiltIn?: boolean
  emoji?: string
}

export const BUILT_IN_PRESETS: Preset[] = [
  { id: 'surprise-me',    label: 'Surprise Me',    description: 'SMART ALGORITHM', emoji: '🎲', isBuiltIn: true },
  { id: 'forgotten-gems', label: 'Forgotten Gems', description: 'SMART ALGORITHM', emoji: '💎', isBuiltIn: true },
  { id: 'deep-cuts',      label: 'Deep Cuts',      description: 'SMART ALGORITHM', emoji: '⏰', isBuiltIn: true },
]

interface PresetSheetProps {
  open: boolean
  activePresetId: string
  customPresets: Preset[]
  onSelect: (preset: Preset) => void
  onClose: () => void
}

export default function PresetSheet({ open, activePresetId, customPresets, onSelect, onClose }: PresetSheetProps) {
  const allPresets = [...BUILT_IN_PRESETS, ...customPresets]
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            className="relative w-full bg-card rounded-t-2xl p-5 pb-safe"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold tracking-widest text-ink-subtle">DISCOVERY MODE</p>
              <button onClick={onClose}><X size={20} className="text-ink-muted" /></button>
            </div>
            <div className="flex flex-col gap-2">
              {allPresets.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p); onClose() }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                    activePresetId === p.id
                      ? 'border-accent bg-accent-dim'
                      : 'border-border bg-card-raised'
                  )}
                >
                  {p.emoji && <span className="text-xl">{p.emoji}</span>}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{p.label}</p>
                    <p className="text-[10px] tracking-wider text-ink-subtle mt-0.5">{p.description}</p>
                  </div>
                  {activePresetId === p.id && <Check size={16} className="text-accent shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
