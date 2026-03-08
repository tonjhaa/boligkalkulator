import { CheckCircle2, XCircle, Download, GitCompare } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useNewScenario } from '@/hooks/useNewScenario'
import { useAllCalculations } from '@/hooks/useCalculator'
import { exportAnalysisCSV } from '@/hooks/useExport'
import { formatCurrency, formatPercent, formatNumber, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { LoanAnalysis } from '@/types'

/* ------------------------------------------------------------------ */
/* Hjelpere                                                             */
/* ------------------------------------------------------------------ */

type CellClass = 'best' | 'worst' | 'ok' | 'neutral'

function cellClass(cls: CellClass): string {
  return {
    best:    'text-green-400 font-semibold',
    worst:   'text-red-400',
    ok:      'text-foreground',
    neutral: 'text-muted-foreground',
  }[cls]
}

function bestIdx(values: number[], higherIsBetter: boolean): number {
  if (values.length < 2) return -1
  return higherIsBetter
    ? values.indexOf(Math.max(...values))
    : values.indexOf(Math.min(...values))
}

function worstIdx(values: number[], higherIsBetter: boolean): number {
  if (values.length < 2) return -1
  return higherIsBetter
    ? values.indexOf(Math.min(...values))
    : values.indexOf(Math.max(...values))
}

/* ------------------------------------------------------------------ */
/* Enkeltrader                                                          */
/* ------------------------------------------------------------------ */

interface MetricRowProps {
  label: string
  values: (string | React.ReactNode)[]
  classes?: CellClass[]
  isSection?: boolean
}

function MetricRow({ label, values, classes, isSection }: MetricRowProps) {
  if (isSection) {
    return (
      <tr className="bg-muted/30">
        <td colSpan={values.length + 1} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={cn('px-4 py-2.5 text-sm text-right', classes?.[i] ? cellClass(classes[i]) : 'text-foreground')}
        >
          {v}
        </td>
      ))}
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/* Hoved-komponent                                                      */
/* ------------------------------------------------------------------ */

export function ScenarioComparison() {
  const scenarios = useAppStore((s) => s.scenarios)
  const analyses = useAppStore((s) => s.analyses)
  const setActive = useAppStore((s) => s.setActiveScenario)
  const setView = useAppStore((s) => s.setCurrentView)
  const { createScenario } = useNewScenario()

  useAllCalculations()

  const ready = scenarios.map((s) => analyses[s.id]).filter(Boolean) as LoanAnalysis[]

  if (scenarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <GitCompare className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Opprett minst to scenarioer i kalkulatoren for å sammenligne dem.
        </p>
        <Button variant="outline" onClick={() => { createScenario(); setView('calculator') }}>
          Gå til kalkulator
        </Button>
      </div>
    )
  }

  if (ready.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <GitCompare className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Du trenger minst to beregningsklare scenarioer for sammenligning.
        </p>
        <Button variant="outline" onClick={() => { createScenario(); setView('calculator') }}>
          Legg til scenario
        </Button>
      </div>
    )
  }

  /* ---- Beregn klasser for hver rad ---- */
  function makeClasses(nums: number[], higherIsBetter: boolean): CellClass[] {
    const bi = bestIdx(nums, higherIsBetter)
    const wi = worstIdx(nums, higherIsBetter)
    return nums.map((_, i) => (i === bi ? 'best' : i === wi ? 'worst' : 'ok'))
  }

  const prices       = ready.map((a) => a.property.purchasePrice)
  const ekPcts       = ready.map((a) => a.equity.equityPercent)
  const loans        = ready.map((a) => a.property.loanAmount)
  const debtRatios   = ready.map((a) => a.debtRatio.debtRatio)
  const pmtNormal    = ready.map((a) => a.affordability.monthlyPaymentNormal)
  const pmtStress    = ready.map((a) => a.affordability.monthlyPaymentStress)
  const disposable   = ready.map((a) => a.affordability.disposableAmount)
  const maxPurchase  = ready.map((a) => a.maxPurchase.maxPurchasePrice)
  const totalInterest = ready.map((a) => a.property.loanAmount) // placeholder, from amortization

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Toppraden */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground">Scenariosammenligning</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{ready.length} scenarioer</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => exportAnalysisCSV(ready)}
          >
            <Download className="h-3.5 w-3.5" />
            Eksporter CSV
          </Button>
        </div>
      </div>

      {/* Tabell */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-44">
                Metrikk
              </th>
              {ready.map((a) => {
                const sc = scenarios.find((s) => s.id === a.scenarioId)
                return (
                  <th key={a.scenarioId} className="px-4 py-3 text-right text-xs font-semibold">
                    <button
                      className="hover:text-primary transition-colors text-foreground"
                      onClick={() => { setActive(a.scenarioId); setView('calculator') }}
                      title="Åpne i kalkulator"
                    >
                      {a.scenarioLabel}
                    </button>
                    {sc && (
                      <p className="font-normal text-muted-foreground">
                        {formatCurrency(sc.loanParameters.interestRate).replace('kr', '%').trim()} rente
                      </p>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {/* Godkjent-status */}
            <MetricRow
              label="Status"
              values={ready.map((a) =>
                a.status.approved ? (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <CheckCircle2 className="h-4 w-4" /> Godkjent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <XCircle className="h-4 w-4" /> Avvist
                  </span>
                )
              )}
            />

            <MetricRow label="Bolig" values={[]} isSection />

            <MetricRow
              label="Boligpris"
              values={ready.map((a) => formatCurrency(a.property.purchasePrice))}
              classes={makeClasses(prices, false)}
            />
            <MetricRow
              label="Dokumentavgift"
              values={ready.map((a) => formatCurrency(a.property.stampDuty))}
              classes={makeClasses(prices, false)}
            />

            <MetricRow label="Egenkapital" values={[]} isSection />

            <MetricRow
              label="EK-prosent"
              values={ready.map((a) => (
                <span className={a.equity.approved ? 'text-green-400' : 'text-red-400'}>
                  {formatPercent(a.equity.equityPercent)}
                  {a.equity.approved ? ' ✓' : ' ✗'}
                </span>
              ))}
              classes={makeClasses(ekPcts, true)}
            />
            <MetricRow
              label="Mangler / buffer"
              values={ready.map((a) => formatCurrency(a.equity.equityBuffer))}
              classes={makeClasses(ready.map((a) => a.equity.equityBuffer), true)}
            />

            <MetricRow label="Lån og gjeld" values={[]} isSection />

            <MetricRow
              label="Lånebeløp"
              values={ready.map((a) => formatCurrency(a.property.loanAmount))}
              classes={makeClasses(loans, false)}
            />
            <MetricRow
              label="Gjeldsgrad"
              values={ready.map((a) => (
                <span className={a.debtRatio.approved ? '' : 'text-red-400'}>
                  {formatNumber(a.debtRatio.debtRatio, 2)}×
                  {a.debtRatio.approved ? '' : ' ✗'}
                </span>
              ))}
              classes={makeClasses(debtRatios, false)}
            />
            <MetricRow
              label="Maks tillatt gjeld"
              values={ready.map((a) => formatCurrency(a.debtRatio.maxAllowedDebt))}
            />

            <MetricRow label="Månedlig betaling" values={[]} isSection />

            <MetricRow
              label="Terminbeløp (normal)"
              values={ready.map((a) => formatCurrency(a.affordability.monthlyPaymentNormal))}
              classes={makeClasses(pmtNormal, false)}
            />
            <MetricRow
              label="Terminbeløp (stresstest)"
              values={ready.map((a) => formatCurrency(a.affordability.monthlyPaymentStress))}
              classes={makeClasses(pmtStress, false)}
            />
            <MetricRow
              label="Stresstestrente"
              values={ready.map((a) => formatPercent(a.affordability.stressTestRate))}
            />

            <MetricRow label="Betjeningsevne" values={[]} isSection />

            <MetricRow
              label="Nettoinntekt / mnd"
              values={ready.map((a) => formatCurrency(a.affordability.monthlyNetIncome))}
              classes={makeClasses(ready.map((a) => a.affordability.monthlyNetIncome), true)}
            />
            <MetricRow
              label="SIFO-budsjett"
              values={ready.map((a) => formatCurrency(a.affordability.sifoExpenses))}
            />
            <MetricRow
              label="Disponibelt (stress)"
              values={ready.map((a) => (
                <span className={a.affordability.disposableAmount >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(a.affordability.disposableAmount)}
                </span>
              ))}
              classes={makeClasses(disposable, true)}
            />

            <MetricRow label="Maks kjøp" values={[]} isSection />

            <MetricRow
              label="Maks kjøpsbeløp"
              values={ready.map((a) => formatCurrency(a.maxPurchase.maxPurchasePrice))}
              classes={makeClasses(maxPurchase, true)}
            />
            <MetricRow
              label="Begrensende faktor"
              values={ready.map((a) => {
                const labels = { equity: 'Egenkapital', debtRatio: 'Gjeldsgrad', affordability: 'Betjeningsevne' }
                return (
                  <Badge variant="muted" className="text-xs">
                    {labels[a.maxPurchase.limitingFactor]}
                  </Badge>
                )
              })}
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}
