import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useNewScenario } from '@/hooks/useNewScenario'
import { useAllCalculations } from '@/hooks/useCalculator'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ScenarioFormPanel } from '@/components/calculator/ScenarioFormPanel'
import { ResultsPanel } from '@/components/calculator/ResultsPanel'
import { Button } from '@/components/ui/button'
import { Plus, Calculator, FileInput, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function EmptyState() {
  const { createScenario } = useNewScenario()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
        <Calculator className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Kom i gang</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Start et nytt scenario for å analysere boliglånet ditt mot gjeldende norske regler (2025).
        </p>
      </div>
      <Button onClick={createScenario} className="gap-2">
        <Plus className="h-4 w-4" />
        Start nytt scenario
      </Button>
      <div className="grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground max-w-sm">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">15% EK-krav</p>
          <p>Boliglånsforskriften 2025</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">5× gjeldsgrad</p>
          <p>Maks gjeld / inntekt</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">+3% stresstest</p>
          <p>Min 7% stressrente</p>
        </div>
      </div>
    </div>
  )
}

/** Mobil-layout: tabs for å bytte mellom inndata og resultater */
function MobileLayout({ scenarioId }: { scenarioId: string }) {
  const scenarios = useAppStore((s) => s.scenarios)
  const scenario = scenarios.find((s) => s.id === scenarioId)
  const [tab, setTab] = useState<'input' | 'results'>('input')

  if (!scenario) return null

  return (
    <div className="flex flex-col h-full">
      {/* Mobil tab-bar */}
      <div className="flex border-b border-border shrink-0">
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'input'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground'
          )}
          onClick={() => setTab('input')}
        >
          <FileInput className="h-4 w-4" />
          Inndata
        </button>
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'results'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground'
          )}
          onClick={() => setTab('results')}
        >
          <BarChart2 className="h-4 w-4" />
          Resultater
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'input' ? (
          <ScenarioFormPanel scenario={scenario} />
        ) : (
          <ResultsPanel scenarioId={scenarioId} />
        )}
      </div>
    </div>
  )
}

export function CalculatorPage() {
  const scenarios = useAppStore((s) => s.scenarios)
  const activeId = useAppStore((s) => s.activeScenarioId)
  const setActive = useAppStore((s) => s.setActiveScenario)
  const { createScenario } = useNewScenario()
  const isMobile = useIsMobile()

  useAllCalculations()

  const activeScenario = scenarios.find((s) => s.id === activeId)

  useEffect(() => {
    if (!activeId && scenarios.length > 0) setActive(scenarios[0].id)
  }, [activeId, scenarios, setActive])

  if (scenarios.length === 0) return <EmptyState />

  if (!activeScenario) {
    return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={createScenario} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Velg eller opprett et scenario
        </Button>
      </div>
    )
  }

  if (isMobile) {
    return <MobileLayout scenarioId={activeScenario.id} />
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[380px] shrink-0 border-r border-border overflow-hidden flex flex-col">
        <ScenarioFormPanel scenario={activeScenario} />
      </div>
      <div className="flex-1 overflow-hidden">
        <ResultsPanel scenarioId={activeScenario.id} />
      </div>
    </div>
  )
}
