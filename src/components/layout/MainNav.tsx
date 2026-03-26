import { Calculator, Wallet } from 'lucide-react'
import { useAppStore, type AppView } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { view: AppView; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { view: 'economy',    label: 'Økonomi',         Icon: Wallet },
  { view: 'calculator', label: 'Boligkalkulator', Icon: Calculator },
]

export function MainNav() {
  const currentView = useAppStore((s) => s.currentView)
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  return (
    <nav className="flex items-center border-b border-border bg-card px-4 shrink-0">
      {NAV_ITEMS.map(({ view, label, Icon }) => (
        <button
          key={view}
          onClick={() => setCurrentView(view)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            currentView === view
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </nav>
  )
}
