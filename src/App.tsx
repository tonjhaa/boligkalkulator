import { lazy, Suspense, useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { MainNav } from '@/components/layout/MainNav'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/useAppStore'
import { useAuthStore } from '@/store/useAuthStore'
import { LoginPage } from '@/pages/LoginPage'
import { loadFromSupabase, startAutoSync } from '@/lib/syncEconomyData'

// Lazy-load sider som ikke er kritisk for første innlasting
const ScenarioComparison = lazy(() =>
  import('@/components/scenarios/ScenarioComparison').then((m) => ({
    default: m.ScenarioComparison,
  }))
)
const SettingsPanel = lazy(() =>
  import('@/components/settings/SettingsPanel').then((m) => ({
    default: m.SettingsPanel,
  }))
)
const EconomyPage = lazy(() =>
  import('@/pages/economy/EconomyPage').then((m) => ({
    default: m.EconomyPage,
  }))
)

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Laster…
    </div>
  )
}

function AppContent() {
  const currentView = useAppStore((s) => s.currentView)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MainNav />
      <div className="flex-1 overflow-hidden">
        {currentView === 'calculator' && <CalculatorPage />}
        {currentView === 'comparison' && (
          <Suspense fallback={<PageFallback />}>
            <ScenarioComparison />
          </Suspense>
        )}
        {currentView === 'settings' && (
          <Suspense fallback={<PageFallback />}>
            <SettingsPanel />
          </Suspense>
        )}
        {currentView === 'economy' && (
          <Suspense fallback={<PageFallback />}>
            <EconomyPage />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function App() {
  const { user, initialized, initialize } = useAuthStore()
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!user) return

    setSyncing(true)
    loadFromSupabase().finally(() => setSyncing(false))

    const stopSync = startAutoSync()
    return stopSync
  }, [user])

  if (!initialized || syncing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {syncing ? 'Laster data…' : 'Laster…'}
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AppLayout>
        <AppContent />
      </AppLayout>
    </TooltipProvider>
  )
}

export default App
