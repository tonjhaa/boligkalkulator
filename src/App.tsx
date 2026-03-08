import { lazy, Suspense } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { MainNav } from '@/components/layout/MainNav'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/useAppStore'

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
      </div>
    </div>
  )
}

function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AppLayout>
        <AppContent />
      </AppLayout>
    </TooltipProvider>
  )
}

export default App
