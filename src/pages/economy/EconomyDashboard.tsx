import { AlertTriangle, Zap, Home } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useEconomyStore } from '@/application/useEconomyStore'
import { calculateGoalProgress } from '@/domain/economy/savingsCalculator'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
import { getDaysUsedLast12Months, getDaysUsedFromEvents, getAbsenceStatus, getAbsenceStatusFromEvents, getStatusColor } from '@/domain/economy/absenceCalculator'
import type { AbsenceStatus } from '@/types/economy'
import { sumATFByYear } from '@/domain/economy/atfCalculator'
import { forecastJune } from '@/domain/economy/holidayPayCalculator'
import { computeBudgetTable } from '@/domain/economy/budgetTableComputer'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { HeroBand, calcHealthScore } from '@/components/economy/widgets/HeroBand'
import { FormueChart } from '@/components/economy/charts/FormueChart'

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

function fmtNOK(n: number): string {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

// ── Norske helligdager ──────────────────────────────────────
function getEasterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function getNorwegianHolidays(year: number): Set<string> {
  const easter = getEasterSunday(year)
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-17`,
    `${year}-12-25`, `${year}-12-26`,
    fmt(addDays(easter, -3)), fmt(addDays(easter, -2)), fmt(easter),
    fmt(addDays(easter, 1)), fmt(addDays(easter, 39)),
    fmt(addDays(easter, 49)), fmt(addDays(easter, 50)),
  ])
}

function getNextPayday(from: Date): Date {
  const tryMonth = (year: number, month: number): Date => {
    const holidays = getNorwegianHolidays(year)
    let d = new Date(year, month, 12)
    while (d.getDay() === 0 || d.getDay() === 6 || holidays.has(d.toISOString().slice(0, 10))) {
      d.setDate(d.getDate() - 1)
    }
    return d
  }
  const thisMonthPayday = tryMonth(from.getFullYear(), from.getMonth())
  if (thisMonthPayday <= from) {
    const next = new Date(from.getFullYear(), from.getMonth() + 1, 1)
    return tryMonth(next.getFullYear(), next.getMonth())
  }
  return thisMonthPayday
}

// ══════════════════════════════════════════════════════════════
// HOVED-KOMPONENT
// ══════════════════════════════════════════════════════════════

export function EconomyDashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const {
    monthHistory,
    savingsAccounts,
    savingsGoals,
    debts,
    atfEntries,
    absenceRecords,
    absenceEvents,
    taxSettlements,
    budgetTemplate,
    profile,
    fondPortfolio,
    subscriptions,
    insurances,
    temporaryPayEntries,
    budgetOverrides,
    ivfTransactions,
  } = useEconomyStore()

  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // ── Nedtellinger ──────────────────────────────────────────
  const nextPayday = getNextPayday(now)
  const daysToPayday = Math.ceil((nextPayday.getTime() - now.getTime()) / 86400000)

  const currentMonthRecord = monthHistory.find(
    (m) => m.year === currentYear && m.month === currentMonth
  )
  const nettoInn = currentMonthRecord?.nettoUtbetalt ?? 0

  const fasteUt = budgetTemplate.lines
    .filter((l) => l.isRecurring && ['bolig', 'transport', 'mat', 'helse', 'abonnement', 'forsikring', 'klær', 'fritid', 'annet_forbruk'].includes(l.category))
    .reduce((s, l) => s + Math.abs(l.amount), 0)

  const atfSum = sumATFByYear(atfEntries, currentYear)
  const yearATF = atfEntries.filter((e) => (e.payoutYear ?? e.year) === currentYear)

  const absenceDays = absenceEvents.length > 0
    ? getDaysUsedFromEvents(absenceEvents)
    : getDaysUsedLast12Months(absenceRecords)
  const absenceStatus = absenceEvents.length > 0
    ? getAbsenceStatusFromEvents(absenceEvents)
    : getAbsenceStatus(absenceRecords)

  const taxAnalysis = analyzeTaxSettlements(taxSettlements, profile?.extraTaxWithholding ?? 0)

  const appScenarios = useAppStore((s) => s.scenarios)
  const appActiveScenarioId = useAppStore((s) => s.activeScenarioId)
  const appAnalyses = useAppStore((s) => s.analyses)
  const activeScenario = appScenarios.find((s) => s.id === appActiveScenarioId)
  const maxKjøpesum = activeScenario
    ? appAnalyses[activeScenario.id]?.maxPurchase?.maxPurchasePrice
    : null

  // ── Formue ────────────────────────────────────────────────
  const sparingKontoer = savingsAccounts.reduce((s, a) => {
    const sorted = [...a.balanceHistory].sort((x, y) =>
      x.year !== y.year ? y.year - x.year : y.month - x.month
    )
    return s + (sorted[0]?.balance ?? a.openingBalance)
  }, 0)
  const sortedFondSnapshots = [...(fondPortfolio?.snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const fondVerdi = sortedFondSnapshots[0]?.totalValue ?? 0
  const totalSparing = sparingKontoer + fondVerdi
  const totalGjeld = debts.reduce((s, d) => s + d.currentBalance, 0)
  const nettoFormue = totalSparing - totalGjeld

  // ── Inntektstrend ─────────────────────────────────────────
  const trendData = [...monthHistory]
    .filter((m) => m.slipData != null)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .slice(-12)
    .map((m) => ({ m: MONTH_NAMES[m.month], v: m.nettoUtbetalt }))

  // ── Budsjett ──────────────────────────────────────────────
  const juneForecast = profile ? forecastJune(currentYear, monthHistory, profile, atfEntries) : null

  const yearOverrides = Object.fromEntries(
    Object.entries(budgetOverrides)
      .filter(([k]) => k.startsWith(`${currentYear}:`))
      .map(([k, v]) => [k.slice(String(currentYear).length + 1), v])
  )
  const budgetTable = profile
    ? computeBudgetTable(
        currentYear, profile, budgetTemplate, monthHistory, atfEntries,
        savingsAccounts, debts, subscriptions, insurances,
        yearOverrides, temporaryPayEntries, juneForecast ?? undefined,
        false, ivfTransactions, fondPortfolio,
      )
    : null

  const allBudgetRows = budgetTable?.sections.flatMap((s) => s.rows) ?? []
  const monthIdx = currentMonth - 1
  const nettoCell = allBudgetRows.find((r) => r.id === 'netto')?.cells[monthIdx]
  const overskuddCell = allBudgetRows.find((r) => r.id === 'overskudd')?.cells[monthIdx]
  const nettoFraBudsjett = nettoCell ? (nettoCell.actual ?? nettoCell.budget) : 0
  const overskuddFraBudsjett = overskuddCell ? (overskuddCell.actual ?? overskuddCell.budget) : null

  // ── Sparerate & healthscore ───────────────────────────────
  const sparerate = nettoFraBudsjett > 0 && overskuddFraBudsjett !== null
    ? Math.max(0, Math.round((overskuddFraBudsjett / nettoFraBudsjett) * 100))
    : 0

  const healthScore = calcHealthScore({
    sparerate,
    absenceDays,
    nettoFormue,
    overskudd: overskuddFraBudsjett,
    totalSparing,
    totalGjeld,
  })

  // ── Pengepuls-chips ───────────────────────────────────────
  const chips: { icon: string; text: string; accent?: string }[] = []
  if (nettoFraBudsjett > 0 && overskuddFraBudsjett !== null) {
    chips.push({
      icon: '💰',
      text: `Sparerate: ${sparerate}% av netto`,
      accent: sparerate >= 20 ? 'green' : sparerate >= 10 ? 'yellow' : 'red',
    })
  }
  if (juneForecast) {
    const juneFirst = new Date(now.getFullYear(), 5, 24)
    if (juneFirst < now) juneFirst.setFullYear(now.getFullYear() + 1)
    const days = Math.ceil((juneFirst.getTime() - now.getTime()) / 86400000)
    chips.push({
      icon: '🏖️',
      text: `${days} dager til feriepenger (${Math.round(juneForecast.nettoJuni).toLocaleString('no-NO')} kr)`,
    })
  }
  if (savingsGoals.length > 0) {
    const goal = savingsGoals[0]
    const prog = calculateGoalProgress(goal, savingsAccounts, fondVerdi, fondPortfolio?.monthlyDeposit ?? 0)
    if (prog.percent >= 100) {
      chips.push({ icon: '✅', text: `«${goal.label}» er nådd!`, accent: 'green' })
    } else if (prog.monthsRemaining !== null && prog.monthsRemaining > 0) {
      chips.push({ icon: '🎯', text: `«${goal.label}» nås om ca. ${prog.monthsRemaining} mnd` })
    }
  }
  if (atfSum > 0) {
    chips.push({ icon: '🎖️', text: `ATF-bonus i år: ${Math.round(atfSum).toLocaleString('no-NO')} kr` })
  }
  if (absenceDays >= 16) {
    chips.push({ icon: '⚠️', text: `${absenceDays}/24 egenmeldingsdager brukt`, accent: 'red' })
  }
  if (taxAnalysis.recommendation === 'reduce_extra') {
    chips.push({
      icon: '🧾',
      text: `Vurder å senke ekstra trekk med ${fmtNOK(taxAnalysis.recommendedExtraAdjustment)}/mnd`,
      accent: 'yellow',
    })
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── 1. HERO BAND ── */}
      <HeroBand
        healthScore={healthScore}
        nettoFormue={nettoFormue}
        totalSparing={totalSparing}
        totalGjeld={totalGjeld}
        nettoInn={nettoFraBudsjett}
        sparerate={sparerate}
        daysToPayday={daysToPayday}
        nextPayday={nextPayday}
        juneForecast={juneForecast}
      />

      {/* ── 2. MIDT-RAD ── */}
      <div className="grid grid-cols-[260px_1fr_260px] gap-3 px-5 py-3 shrink-0">
        <MonthlyFlowCard
          nettoInn={nettoFraBudsjett || nettoInn}
          fasteUt={fasteUt}
          overskudd={overskuddFraBudsjett}
        />
        <FormueChart
          history={trendData}
          nettoFormue={nettoFormue}
        />
        <PengePulsCard chips={chips} />
      </div>

      {/* ── 3. BUNN-GRID ── */}
      <div className="grid grid-cols-4 gap-3 px-5 pb-4 flex-1 min-h-0">
        <SpareMaalCard
          goals={savingsGoals}
          accounts={savingsAccounts}
          fondVerdi={fondVerdi}
          fondMonthlyDeposit={fondPortfolio?.monthlyDeposit ?? 0}
          onNavigate={onNavigate}
        />
        <ATFCard
          entries={yearATF}
          sum={atfSum}
          year={currentYear}
          onNavigate={onNavigate}
        />
        <GjeldCard debts={debts} onNavigate={onNavigate} />
        <AbsenceAndTaxCard
          absenceDays={absenceDays}
          absenceStatus={absenceStatus}
          taxAnalysis={taxAnalysis}
          onNavigate={onNavigate}
          maxKjøpesum={maxKjøpesum}
        />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MIDT-RAD: MÅNEDLIG FLYT
// ══════════════════════════════════════════════════════════════

function MonthlyFlowCard({
  nettoInn, fasteUt, overskudd,
}: {
  nettoInn: number
  fasteUt: number
  overskudd: number | null
}) {
  const ledig = overskudd ?? (nettoInn - fasteUt)
  const sparing = nettoInn - fasteUt - Math.max(0, ledig)

  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Netto inn', value: nettoInn, color: 'bg-green-500' },
    { label: 'Faste ut', value: fasteUt, color: 'bg-red-400' },
    ...(sparing > 0 ? [{ label: 'Sparing', value: sparing, color: 'bg-blue-400' }] : []),
    { label: 'Ledig', value: Math.max(0, ledig), color: 'bg-violet-400' },
  ]

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-3 flex flex-col gap-2.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Månedlig flyt</p>
      {nettoInn === 0 ? (
        <p className="text-xs text-muted-foreground flex-1 flex items-center">Ingen data</p>
      ) : (
        rows.map((row) => (
          <div key={row.label} className="space-y-0.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono tabular-nums text-foreground/80">
                {Math.round(row.value).toLocaleString('no-NO')} kr
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={cn('h-full rounded-full', row.color)}
                style={{ width: `${Math.min(100, (row.value / nettoInn) * 100)}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MIDT-RAD: PENGEPULS-KORT
// ══════════════════════════════════════════════════════════════

function PengePulsCard({ chips }: { chips: { icon: string; text: string; accent?: string }[] }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-3 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Zap className="h-3 w-3 text-violet-400" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pengepuls</span>
      </div>
      {chips.length === 0 ? (
        <p className="text-xs text-muted-foreground flex-1">Last inn data for å se innsikter.</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto">
          {chips.map((chip, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] border leading-snug',
                chip.accent === 'green' && 'bg-green-500/10 border-green-500/20 text-green-400',
                chip.accent === 'yellow' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
                chip.accent === 'red' && 'bg-red-500/10 border-red-500/20 text-red-400',
                !chip.accent && 'bg-muted/40 border-border/40 text-muted-foreground',
              )}
            >
              <span className="shrink-0">{chip.icon}</span>
              <span>{chip.text}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BUNN-GRID: SPAREMÅL
// ══════════════════════════════════════════════════════════════

function SpareMaalCard({
  goals, accounts, fondVerdi, fondMonthlyDeposit, onNavigate,
}: {
  goals: ReturnType<typeof useEconomyStore.getState>['savingsGoals']
  accounts: ReturnType<typeof useEconomyStore.getState>['savingsAccounts']
  fondVerdi: number
  fondMonthlyDeposit: number
  onNavigate: (page: string) => void
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border/30">
        <p className="text-xs font-medium">Sparemål</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5">
        {goals.length === 0 ? (
          <EmptyState message="Ingen sparemål" action="Legg til" onAction={() => onNavigate('savings')} />
        ) : (
          goals.slice(0, 4).map((goal) => {
            const progress = calculateGoalProgress(goal, accounts, fondVerdi, fondMonthlyDeposit)
            return (
              <div key={goal.id} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 min-w-0">
                    <span>{goal.icon}</span>
                    <span className="font-medium truncate">{goal.label}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 ml-1">{Math.round(progress.percent)}%</span>
                </div>
                <Progress value={progress.percent} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(progress.currentTotal).toLocaleString('no-NO')} kr</span>
                  <span>{Math.round(progress.targetAmount).toLocaleString('no-NO')} kr</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BUNN-GRID: ATF
// ══════════════════════════════════════════════════════════════

function ATFCard({
  entries, sum, year, onNavigate,
}: {
  entries: ReturnType<typeof useEconomyStore.getState>['atfEntries']
  sum: number
  year: number
  onNavigate: (page: string) => void
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border/30">
        <p className="text-xs font-medium">ATF {year}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {entries.length === 0 ? (
          <EmptyState message={`Ingen øvelser ${year}`} action="Legg til" onAction={() => onNavigate('atf')} />
        ) : (
          <>
            {entries.slice(0, 5).map((e) => (
              <div key={e.id} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground truncate">{e.øvelsesnavn}</span>
                <span className="font-mono ml-2 shrink-0">{Math.round(e.beregnetBeløp).toLocaleString('no-NO')} kr</span>
              </div>
            ))}
            <div className="flex justify-between text-[11px] border-t border-border pt-1.5 mt-1">
              <span className="font-medium">Sum</span>
              <span className="font-mono font-semibold text-green-500">{Math.round(sum).toLocaleString('no-NO')} kr</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs mt-0.5" onClick={() => onNavigate('atf')}>
              + Øvelse
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BUNN-GRID: GJELD
// ══════════════════════════════════════════════════════════════

function GjeldCard({
  debts, onNavigate,
}: {
  debts: ReturnType<typeof useEconomyStore.getState>['debts']
  onNavigate: (page: string) => void
}) {
  const total = debts.reduce((s, d) => s + d.currentBalance, 0)
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border/30">
        <p className="text-xs font-medium">Gjeld</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {debts.length === 0 ? (
          <EmptyState message="Ingen gjeld" action="Legg til lån" onAction={() => onNavigate('debt')} />
        ) : (
          <>
            {debts.slice(0, 4).map((d) => (
              <div key={d.id} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground truncate">{d.creditor}</span>
                <span className="font-mono ml-2 shrink-0">{Math.round(d.currentBalance).toLocaleString('no-NO')} kr</span>
              </div>
            ))}
            <div className="flex justify-between text-[11px] border-t border-border pt-1.5 mt-1">
              <span className="font-medium">Total</span>
              <span className="font-mono font-semibold text-red-400">{Math.round(total).toLocaleString('no-NO')} kr</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BUNN-GRID: EGENMELDING + SKATT (+ valgfri bolig)
// ══════════════════════════════════════════════════════════════

function AbsenceAndTaxCard({
  absenceDays, absenceStatus, taxAnalysis, maxKjøpesum,
}: {
  absenceDays: number
  absenceStatus: AbsenceStatus
  taxAnalysis: ReturnType<typeof analyzeTaxSettlements>
  onNavigate: (page: string) => void
  maxKjøpesum: number | null | undefined
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border/30">
        <p className="text-xs font-medium">Egenmelding & skatt</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">

        {/* Egenmelding */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Brukt siste 12 mnd</span>
            <span className={cn('font-medium', getStatusColor(absenceStatus))}>
              {absenceDays} / 24 dager
            </span>
          </div>
          <Progress
            value={(absenceDays / 24) * 100}
            className={cn(
              'h-1.5',
              absenceStatus === 'ok' ? '[&>div]:bg-green-500'
                : absenceStatus === 'warning' ? '[&>div]:bg-yellow-500'
                : '[&>div]:bg-red-500'
            )}
          />
        </div>

        {/* Skattevarsel */}
        {taxAnalysis.recommendation === 'reduce_extra' && (
          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/25 px-2.5 py-2 text-[11px] text-yellow-400 flex gap-1.5 items-start">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Du får tilbake ~{fmtNOK(taxAnalysis.avgYearlyRefund)}/år.
              Senk ekstra trekk med {fmtNOK(taxAnalysis.recommendedExtraAdjustment)}/mnd.
            </span>
          </div>
        )}
        {taxAnalysis.recommendation === 'keep' && (
          <p className="text-[11px] text-muted-foreground">Skattetrekk ser riktig ut ✓</p>
        )}

        {/* Boligscenario */}
        {maxKjøpesum && (
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-[11px]">
              <Home className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Maks kjøpesum</span>
            </div>
            <button
              onClick={() => useAppStore.getState().setCurrentView('calculator')}
              className="text-[11px] font-semibold font-mono text-blue-400 hover:text-blue-300 transition-colors"
            >
              {Math.round(maxKjøpesum).toLocaleString('no-NO')} kr →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Felles hjelpere ──────────────────────────────────────────

function EmptyState({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="text-center py-2">
      <p className="text-[11px] text-muted-foreground mb-2">{message}</p>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAction}>{action}</Button>
    </div>
  )
}
