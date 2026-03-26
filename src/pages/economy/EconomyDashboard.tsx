import { Home, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useEconomyStore } from '@/application/useEconomyStore'
import { calculateGoalProgress } from '@/domain/economy/savingsCalculator'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
import { getDaysUsedLast12Months, getDaysUsedFromEvents, getAbsenceStatus, getAbsenceStatusFromEvents, getStatusColor } from '@/domain/economy/absenceCalculator'
import { sumATFByYear } from '@/domain/economy/atfCalculator'
import { forecastJune } from '@/domain/economy/holidayPayCalculator'
import { PayslipImporter } from '@/features/payslip/PayslipImporter'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { ParsetLonnsslipp } from '@/types/economy'

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

const MONTH_NAMES_FULL = [
  '', 'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

const EXPENSE_CATEGORIES = [
  'bolig', 'transport', 'mat', 'helse',
  'abonnement', 'forsikring', 'klær', 'fritid', 'annet_forbruk',
] as const

function fmtNOK(n: number): string {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtSigned(n: number | null): string {
  if (n === null) return '—'
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

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
  } = useEconomyStore()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const currentMonthRecord = monthHistory.find(
    (m) => m.year === currentYear && m.month === currentMonth
  )

  // Netto inn = nettoUtbetalt fra slipp (ikke bruttosum)
  const nettoInn = currentMonthRecord?.nettoUtbetalt ?? 0

  // Faste ut = recurring expense-linjer fra brukerens budsjettmal (ikke fra slippen)
  const fasteUt = budgetTemplate.lines
    .filter((l) => l.isRecurring && (EXPENSE_CATEGORIES as readonly string[]).includes(l.category))
    .reduce((s, l) => s + Math.abs(l.amount), 0)

  const harBudsjettLinjer = budgetTemplate.lines.some(
    (l) => l.isRecurring && (EXPENSE_CATEGORIES as readonly string[]).includes(l.category)
  )

  const disponibelt = nettoInn - fasteUt

  // Siste importerte slipp for inneværende år
  const latestSlipRecord = monthHistory
    .filter((m) => m.year === currentYear && m.slipData != null)
    .sort((a, b) => b.month - a.month)[0]

  const atfSum = sumATFByYear(atfEntries, currentYear)
  const yearATF = atfEntries.filter((e) => (e.payoutYear ?? e.year) === currentYear)

  const absenceDays = absenceEvents.length > 0 ? getDaysUsedFromEvents(absenceEvents) : getDaysUsedLast12Months(absenceRecords)
  const absenceStatus = absenceEvents.length > 0 ? getAbsenceStatusFromEvents(absenceEvents) : getAbsenceStatus(absenceRecords)

  const taxAnalysis = analyzeTaxSettlements(taxSettlements, profile?.extraTaxWithholding ?? 0)

  const appStore = useAppStore.getState()
  const activeScenario = appStore.scenarios.find((s) => s.id === appStore.activeScenarioId)
  const maxKjøpesum = activeScenario
    ? appStore.analyses[activeScenario.id]?.maxPurchase?.maxPurchasePrice
    : null

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </p>
        </div>
        <PayslipImporter compact />
      </div>

      {/* Månedsstatus */}
      {currentMonthRecord ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Netto inn" value={nettoInn} positive />
            <StatCard label="Faste ut" value={fasteUt} />
            <StatCard label="Disponibelt" value={disponibelt} positive={disponibelt >= 0} />
          </div>
          {!harBudsjettLinjer && (
            <p className="text-xs text-muted-foreground text-center">
              <button
                className="underline hover:text-foreground"
                onClick={() => onNavigate('budget')}
              >
                Legg til faste utgifter i Budsjett
              </button>
            </p>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ingen data for {MONTH_NAMES[currentMonth]}. Last opp lønnsslippen din for å komme i gang.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sparemål */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sparemål</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savingsGoals.length === 0 ? (
              <EmptyState message="Ingen sparemål registrert" action="Legg til mål" onAction={() => onNavigate('savings')} />
            ) : (
              savingsGoals.slice(0, 3).map((goal) => {
                const progress = calculateGoalProgress(goal, savingsAccounts)
                return (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <span>{goal.icon}</span>
                        <span className="font-medium">{goal.label}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {Math.round(progress.percent)}%
                      </span>
                    </div>
                    <Progress value={progress.percent} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{fmtNOK(progress.currentTotal)}</span>
                      <span>{fmtNOK(progress.targetAmount)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* ATF */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ATF dette året</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {yearATF.length === 0 ? (
              <EmptyState
                message={`Ingen øvelser registrert for ${currentYear}`}
                action="Legg til øvelse"
                onAction={() => onNavigate('atf')}
              />
            ) : (
              <>
                {yearATF.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{e.øvelsesnavn}</span>
                    <span className="font-mono font-medium ml-2 shrink-0">
                      {fmtNOK(e.beregnetBeløp)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                  <span className="font-medium">Sum {currentYear}</span>
                  <span className="font-mono font-semibold text-green-500">{fmtNOK(atfSum)}</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => onNavigate('atf')}>
                  + Legg til øvelse
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Gjeld */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gjeld</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {debts.length === 0 ? (
              <EmptyState message="Ingen gjeld registrert" action="Legg til lån" onAction={() => onNavigate('debt')} />
            ) : (
              <>
                {debts.slice(0, 4).map((d) => (
                  <div key={d.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{d.creditor}</span>
                    <span className="font-mono font-medium">{fmtNOK(d.currentBalance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="font-medium">Total</span>
                  <span className="font-mono font-semibold text-red-400">
                    {fmtNOK(debts.reduce((s, d) => s + d.currentBalance, 0))}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Egenmelding */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Egenmelding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Brukt siste 12 mnd</span>
              <span className={cn('text-sm font-medium', getStatusColor(absenceStatus))}>
                {absenceDays} / 24 dager
              </span>
            </div>
            <Progress
              value={(absenceDays / 24) * 100}
              className={cn(
                'h-2',
                absenceStatus === 'ok'
                  ? '[&>div]:bg-green-500'
                  : absenceStatus === 'warning'
                  ? '[&>div]:bg-yellow-500'
                  : '[&>div]:bg-red-500'
              )}
            />
            {taxAnalysis.recommendation === 'reduce_extra' && (
              <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 p-2 text-xs text-yellow-400 flex gap-2 mt-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Du får tilbake ~{fmtNOK(taxAnalysis.avgYearlyRefund)}/år.
                  Vurder å redusere ekstra trekk med {fmtNOK(taxAnalysis.recommendedExtraAdjustment)}/mnd.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feriepenger — kompakt (detaljer i egen fane) */}
      {profile && (
        <FeriepengeSummaryCard
          monthHistory={monthHistory}
          profile={profile}
          atfEntries={atfEntries}
          currentYear={currentYear}
          onNavigate={onNavigate}
        />
      )}

      {/* Lønn og skatt — full bredde */}
      <SlipWidget slip={latestSlipRecord?.slipData ?? null} onNavigate={onNavigate} />

      {/* Boligscenario */}
      {maxKjøpesum && (
        <Card>
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">Maks kjøpesum: </span>
                <span className="font-semibold">{fmtNOK(maxKjøpesum)}</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => useAppStore.getState().setCurrentView('calculator')}
            >
              Åpne kalkulator
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// LØNN OG SKATT WIDGET
// ------------------------------------------------------------

function SlipWidget({
  slip,
  onNavigate,
}: {
  slip: ParsetLonnsslipp | null
  onNavigate: (page: string) => void
}) {
  if (!slip) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Lønn og skatt</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4 space-y-2">
          <p className="text-sm text-muted-foreground">Last opp lønnsslippen din for å se tall</p>
          <Button variant="outline" size="sm" onClick={() => onNavigate('salary')}>
            Last opp slipp
          </Button>
        </CardContent>
      </Card>
    )
  }

  const hittilNetto = slip.hittilBrutto > 0
    ? slip.hittilBrutto - slip.hittilForskuddstrekk - slip.hittilPensjon
    : null

  const periode = `${MONTH_NAMES_FULL[slip.periode.month]} ${slip.periode.year}`

  type SlipRow = { label: string; denne: number; hittil: number | null; bold?: boolean }

  const rows: SlipRow[] = [
    { label: 'Brutto', denne: slip.bruttoSum, hittil: slip.hittilBrutto || null },
    {
      label: 'Skattetrekk',
      denne: -slip.skattetrekk,
      hittil: slip.hittilForskuddstrekk ? -slip.hittilForskuddstrekk : null,
    },
    {
      label: 'Pensjonstrekk SPK',
      denne: -slip.pensjonstrekk,
      hittil: slip.hittilPensjon ? -slip.hittilPensjon : null,
    },
    ...(slip.husleietrekk > 0
      ? [{ label: 'Husleietrekk', denne: -slip.husleietrekk, hittil: null as null }]
      : []),
    ...(slip.ekstraTrekk > 0
      ? [{ label: 'Ekstra trekk', denne: -slip.ekstraTrekk, hittil: null as null }]
      : []),
    ...(slip.fagforeningskontingent > 0
      ? [{ label: 'Fagforeningskont.', denne: -slip.fagforeningskontingent, hittil: null as null }]
      : []),
    { label: 'Netto utbetalt', denne: slip.nettoUtbetalt, hittil: hittilNetto, bold: true },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <CardTitle className="text-sm font-medium">Lønn og skatt</CardTitle>
          <span className="text-xs text-muted-foreground">Basert på slipp {periode}</span>
        </div>
        {slip.avregningsdato && (
          <p className="text-xs text-muted-foreground">Avregningsdato: {slip.avregningsdato}</p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-1/2">
                Post
              </th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                Denne mnd
              </th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                Hittil i år
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  row.bold && 'bg-muted/20 font-semibold'
                )}
              >
                <td className="px-4 py-2 text-muted-foreground">{row.label}</td>
                <td
                  className={cn(
                    'px-4 py-2 text-right font-mono',
                    row.denne < 0 ? 'text-red-400' : ''
                  )}
                >
                  {fmtSigned(row.denne)}
                </td>
                <td
                  className={cn(
                    'px-4 py-2 text-right font-mono text-muted-foreground',
                    row.hittil !== null && row.hittil < 0 ? 'text-red-400/70' : ''
                  )}
                >
                  {fmtSigned(row.hittil)}
                </td>
              </tr>
            ))}
          </tbody>
          {(slip.feriepengegrunnlag > 0 || slip.opptjentFerie > 0 || slip.gruppelivspremie > 0) && (
            <tfoot className="border-t-2 border-border">
              {slip.feriepengegrunnlag > 0 && (
                <tr className="border-b border-border/30">
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">
                    Feriepengegrunnlag
                  </td>
                  <td />
                  <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">
                    {fmtNOK(slip.feriepengegrunnlag)}
                  </td>
                </tr>
              )}
              {slip.opptjentFerie > 0 && (
                <tr className="border-b border-border/30">
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">Opptjent ferie</td>
                  <td />
                  <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">
                    {fmtNOK(slip.opptjentFerie)}
                  </td>
                </tr>
              )}
              {slip.gruppelivspremie > 0 && (
                <tr>
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">
                    Gruppelivspremie
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">
                    {fmtNOK(slip.gruppelivspremie)}
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------
// HJELPERE
// ------------------------------------------------------------

function StatCard({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'text-base font-semibold font-mono mt-0.5',
            positive === true ? 'text-green-500' : positive === false ? 'text-red-400' : ''
          )}
        >
          {Math.round(Math.abs(value)).toLocaleString('no-NO')} kr
        </p>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  message,
  action,
  onAction,
}: {
  message: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="text-center py-2">
      <p className="text-xs text-muted-foreground mb-2">{message}</p>
      <Button variant="outline" size="sm" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}


// ------------------------------------------------------------
// FERIEPENGE-SAMMENDRAG (kompakt, lenker til feriepengefanen)
// ------------------------------------------------------------

function FeriepengeSummaryCard({
  monthHistory,
  profile,
  atfEntries,
  currentYear,
  onNavigate,
}: {
  monthHistory: ReturnType<typeof useEconomyStore.getState>['monthHistory']
  profile: NonNullable<ReturnType<typeof useEconomyStore.getState>['profile']>
  atfEntries: ReturnType<typeof useEconomyStore.getState>['atfEntries']
  currentYear: number
  onNavigate?: (page: string) => void
}) {
  const forecast = forecastJune(currentYear, monthHistory, profile, atfEntries)
  if (!forecast) return null

  function fmtNOK(n: number) {
    return Math.round(n).toLocaleString('no-NO') + ' kr'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Feriepenger — juni {currentYear}</CardTitle>
          {onNavigate && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onNavigate('feriepenger')}>
              Detaljer →
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Feriepenger (12%)</span>
          <span className="font-mono text-green-500">+{fmtNOK(forecast.feriepenger)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ferietrekk (25 dager)</span>
          <span className="font-mono text-red-400">-{fmtNOK(forecast.ferietrekk)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 font-medium">
          <span className="text-muted-foreground">Netto ekstra</span>
          <span className={`font-mono ${forecast.nettoEkstra >= 0 ? 'text-green-500' : 'text-red-400'}`}>
            {forecast.nettoEkstra >= 0 ? '+' : ''}{fmtNOK(forecast.nettoEkstra)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimert netto juni</span>
          <span className="font-mono text-green-500">{fmtNOK(forecast.nettoJuni)}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Konfidensgrad: {forecast.confidence === 'høy' ? '✓ Høy' : forecast.confidence === 'middels' ? '~ Middels' : '? Lav'} · {forecast.kilder.feriepengegrunnlag}
        </p>
      </CardContent>
    </Card>
  )
}
