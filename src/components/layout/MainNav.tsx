import { Calculator, Wallet } from 'lucide-react'
import { useAppStore, type AppView } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { view: AppView; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { view: 'economy',    label: 'Økonomi',         Icon: Wallet },
  { view: 'calculator', label: 'Boligkalkulator', Icon: Calculator },
]

function LBLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="lb-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/* L */}
      <rect x="4" y="6" width="5" height="28" rx="1.5" fill="url(#lb-grad)" />
      <rect x="4" y="29" width="14" height="5" rx="1.5" fill="url(#lb-grad)" />
      {/* B */}
      <rect x="19" y="6" width="5" height="28" rx="1.5" fill="url(#lb-grad)" />
      <path
        d="M23 6 h7 a5 5 0 0 1 0 10 h-7 z"
        fill="url(#lb-grad)"
      />
      <path
        d="M23 16 h8 a6 6 0 0 1 0 18 h-8 z"
        fill="url(#lb-grad)"
      />
    </svg>
  )
}

export function MainNav() {
  const currentView = useAppStore((s) => s.currentView)
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  return (
    <nav className="flex items-center border-b border-border bg-card px-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4 py-2 select-none">
        <LBLogo className="h-7 w-7" />
        <span className="font-semibold text-sm text-foreground hidden sm:inline">Lommeboka</span>
      </div>

      <div className="w-px h-5 bg-border mr-2" />

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
