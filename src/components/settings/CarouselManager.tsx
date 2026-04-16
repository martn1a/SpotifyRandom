import { Eye, EyeOff, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { CarouselConfig } from '../../lib/types'

interface CarouselManagerProps {
  configs: CarouselConfig[]
  onChange: (updated: CarouselConfig[]) => void
}

export default function CarouselManager({ configs, onChange }: CarouselManagerProps) {
  const sorted = [...configs].sort((a, b) => a.order - b.order)

  function toggleVisible(id: string) {
    onChange(configs.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }

  function setSortMode(id: string, sortMode: CarouselConfig['sortMode']) {
    onChange(configs.map(c => c.id === id ? { ...c, sortMode } : c))
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(c => (
        <div key={c.id} className={cn('flex items-center gap-3 bg-card-raised border rounded-xl p-3', c.visible ? 'border-border' : 'border-border/50 opacity-60')}>
          <GripVertical size={16} className="text-ink-subtle shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{c.label}</p>
            <div className="flex gap-1 mt-1">
              {(['original', 'date', 'relevance'] as const).map(m => (
                <button key={m} onClick={() => setSortMode(c.id, m)}
                  className={cn('text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border', c.sortMode === m ? 'bg-accent text-black border-accent' : 'bg-card border-border text-ink-subtle')}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => toggleVisible(c.id)}>
            {c.visible ? <Eye size={16} className="text-accent" /> : <EyeOff size={16} className="text-ink-subtle" />}
          </button>
        </div>
      ))}
    </div>
  )
}
