import { Compass, Search, Clock } from 'lucide-react'
import { cn } from '../lib/utils'

export type Tab = 'discover' | 'browse' | 'later'

interface TabBarProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'discover', label: 'DISCOVER', Icon: Compass },
  { id: 'browse',   label: 'BROWSE',   Icon: Search },
  { id: 'later',    label: 'LATER',    Icon: Clock },
]

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around h-14">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-6 py-1 transition-colors',
              active === id ? 'text-accent' : 'text-ink-subtle'
            )}
          >
            <Icon size={20} strokeWidth={active === id ? 2.5 : 1.5} />
            <span className="text-[9px] font-semibold tracking-widest">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
