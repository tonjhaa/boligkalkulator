import { Moon, Sun, Menu } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'

export function Header() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 flex-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">LB</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Lommeboka</span>
          <p className="text-xs text-muted-foreground italic leading-none">Oversikt er frihet</p>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  )
}
