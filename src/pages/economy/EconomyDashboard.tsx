import { useState } from 'react'
import { Home, AlertTriangle, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useEconomyStore } from '@/application/useEconomyStore'
import { calculateGoalProgress } from '@/domain/economy/savingsCalculator'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
import { getDaysUsedLast12Months, getAbsenceStatus, getStatusColor } from '@/domain/economy/absenceCalculator'
import { sumATFByYear } from '@/domain/economy/atfCalculator'
import {
  forecastAllJunes,
  calculateAccruedHolidayBase,
} from '@/domain/economy/holidayPayCalculator'
import { PayslipImporter } from '@/features/payslip/PayslipImporter'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { ParsetLonnsslipp, JuneForecast } from '@/types/economy'

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
  const yearATF = atfEntries.filter((e) => e.year === currentYear)

  const absenceDays = getDaysUsedLast12Months(absenceRecords)
  const absenceStatus = getAbsenceStatus(absenceRecords)

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
          <h1 className="text-lg font-semibold">MIN ØKONOMI</h1>
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

      {/* Feriepenger */}
      {profile && (
        <HolidayPayWidget
          monthHistory={monthHistory}
          profile={profile}
          atfEntries={atfEntries}
          currentYear={currentYear}
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
// FERIEPENGE-WIDGET
// ------------------------------------------------------------

function confidenceLabel(c: 'høy' | 'middels' | 'lav'): string {
  if (c === 'høy') return '✅ Høy'
  if (c === 'middels') return '🟡 Middels'
  return '⚠️ Lav'
}

function HolidayPayWidget({
  monthHistory,
  profile,
  atfEntries,
  currentYear,
}: {
  monthHistory: ReturnType<typeof useEconomyStore.getState>['monthHistory']
  profile: NonNullable<ReturnType<typeof useEconomyStore.getState>['profile']>
  atfEntries: ReturnType<typeof useEconomyStore.getState>['atfEntries']
  currentYear: number
}) {
  const [modalYear, setModalYear] = useState<number | null>(null)

  const forecasts = forecastAllJunes(currentYear, monthHistory, profile, atfEntries, 1)
  const thisYear = forecasts[0]
  const nextYear = forecasts[1]

  // Løpende opptjening: for inneværende år (grunnlag for neste juni)
  const opptjening = calculateAccruedHolidayBase(currentYear, monthHistory, profile)
  const opptjeningProsent = Math.min(100, Math.round((opptjening.monthsWithSlip / 12) * 100))

  if (!thisYear || !nextYear) return null

  const modalForecast = modalYear != null ? forecasts.find((f) => f.year === modalYear) ?? null : null

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Feriepenger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Tokolonne-tabell */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-1/2" />
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                  Juni {thisYear.year}
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                  Juni {nextYear.year}
                </th>
              </tr>
            </thead>
            <tbody>
              <HolidayRow
                label="Feriepengegrunnlag"
                a={thisYear.feriepengegrunnlag}
                b={nextYear.feriepengegrunnlag}
                bIsEstimate={nextYear.confidence === 'lav'}
              />
              <HolidayRow
                label="Feriepenger (12%)"
                a={thisYear.feriepenger}
                b={nextYear.feriepenger}
                bIsEstimate={nextYear.confidence === 'lav'}
                positive
              />
              <HolidayRow
                label="Ferietrekk (25 dager)"
                a={-thisYear.ferietrekk}
                b={-nextYear.ferietrekk}
                negative
              />
              <HolidayRow
                label="Netto ekstra i juni"
                a={thisYear.nettoEkstra}
                b={nextYear.nettoEkstra}
                signed
                bold
              />
              <HolidayRow
                label="Skattetrekk i juni"
                a={-thisYear.skattetrekk}
                b={-nextYear.skattetrekk}
                negative
              />
              <HolidayRow
                label="Estimert netto juni"
                a={thisYear.nettoJuni}
                b={nextYear.nettoJuni}
                bIsEstimate={nextYear.confidence === 'lav'}
                positive
                bold
              />
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td className="px-4 py-2 text-xs text-muted-foreground">Konfidensgrad</td>
                <td className="px-3 py-2 text-right text-xs">
                  <button
                    className="underline hover:text-foreground"
                    onClick={() => setModalYear(thisYear.year)}
                  >
                    {confidenceLabel(thisYear.confidence)}
                  </button>
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  <button
                    className="underline hover:text-foreground"
                    onClick={() => setModalYear(nextYear.year)}
                  >
                    {confidenceLabel(nextYear.confidence)}
                  </button>
                </td>
              </tr>
              <tr>
                <td className="px-4 pb-2 text-xs text-muted-foreground">Kilde grunnlag</td>
                <td className="px-3 pb-2 text-right text-xs text-muted-foreground">
                  {thisYear.kilder.feriepengegrunnlag}
                </td>
                <td className="px-4 pb-2 text-right text-xs text-muted-foreground">
                  {nextYear.kilder.feriepengegrunnlag}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Løpende opptjening */}
          <div className="px-4 pb-4 pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Opptjening {currentYear} (grunnlag for juni {currentYear + 1})
              </span>
              <span className="text-xs text-muted-foreground">
                {opptjening.monthsWithSlip}/12 slipper
              </span>
            </div>
            <Progress value={opptjeningProsent} className="h-1.5" />
            <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
              <div>
                <span className="block">Opptjent (slipper)</span>
                <span className="font-mono font-medium text-foreground">
                  {fmtNOK(opptjening.actual)}
                </span>
              </div>
              <div>
                <span className="block">Estimert rest</span>
                <span className="font-mono font-medium text-foreground">
                  ~{fmtNOK(opptjening.projected)}
                </span>
              </div>
              <div className="col-span-2 mt-1">
                <span className="text-muted-foreground">Prosjektert årsgrunnlag: </span>
                <span className="font-mono font-medium">~{fmtNOK(opptjening.total)}</span>
                <span className="text-muted-foreground ml-2">→ feriepenger: </span>
                <span className="font-mono font-medium">~{fmtNOK(Math.round(opptjening.total * 0.12))}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detaljmodal */}
      {modalForecast && (
        <JuneDetailModal forecast={modalForecast} onClose={() => setModalYear(null)} />
      )}
    </>
  )
}

function HolidayRow({
  label,
  a,
  b,
  positive,
  negative,
  signed,
  bold,
  bIsEstimate,
}: {
  label: string
  a: number
  b: number
  positive?: boolean
  negative?: boolean
  signed?: boolean
  bold?: boolean
  bIsEstimate?: boolean
}) {
  const colorA = positive ? 'text-green-500' : negative ? 'text-red-400' : signed ? (a >= 0 ? 'text-green-500' : 'text-red-400') : ''
  const colorB = positive ? (bIsEstimate ? 'text-green-500/70' : 'text-green-500') : negative ? 'text-red-400' : signed ? (b >= 0 ? 'text-green-500/70' : 'text-red-400/70') : bIsEstimate ? 'text-muted-foreground' : ''
  const prefix = signed ? (a >= 0 ? '+' : '') : ''
  const prefixB = signed ? (b >= 0 ? '+' : '') : ''
  return (
    <tr className={cn('border-b border-border/50 last:border-0', bold && 'bg-muted/20 font-semibold')}>
      <td className="px-4 py-2 text-muted-foreground">{label}</td>
      <td className={cn('px-3 py-2 text-right font-mono', colorA)}>
        {prefix}{fmtNOK(Math.abs(a))}
      </td>
      <td className={cn('px-4 py-2 text-right font-mono', colorB)}>
        {bIsEstimate ? '~' : ''}{prefixB}{fmtNOK(Math.abs(b))}
      </td>
    </tr>
  )
}

function JuneDetailModal({
  forecast,
  onClose,
}: {
  forecast: JuneForecast
  onClose: () => void
}) {
  const rows = [
    { label: 'Feriepengegrunnlag (opptjent forrige år)', value: forecast.feriepengegrunnlag, note: forecast.kilder.feriepengegrunnlag },
    { label: `Feriepenger (${(forecast.feriepengegrunnlag > 0 ? Math.round(forecast.feriepenger / forecast.feriepengegrunnlag * 1000) / 10 : 12)}%)`, value: forecast.feriepenger, positive: true },
    { label: `Ferietrekk (${forecast.ferietrekkDagsats.toLocaleString('no-NO')} kr/dag × 25)`, value: -forecast.ferietrekk, negative: true },
    { label: 'Skattepliktig lønn i juni', value: forecast.skattepliktigJuni, note: forecast.kilder.juneLonn },
    ...(forecast.juneATF > 0 ? [{ label: 'ATF i juni', value: forecast.juneATF, positive: true }] : []),
    { label: 'Skattegrunnlag i juni', value: forecast.skattegrunnlag, note: 'max(0, lønn + ATF − ferietrekk)' },
    { label: 'Skattetrekk i juni', value: -forecast.skattetrekk, negative: true },
    { label: 'Andre trekk i juni', value: -forecast.andreJuneTrekk, negative: true },
    { label: 'Netto ekstra i juni', value: forecast.nettoEkstra, bold: true, signed: true },
    { label: 'Estimert netto juni', value: forecast.nettoJuni, bold: true, positive: true },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Feriepenger — Juni {forecast.year}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm">{confidenceLabel(forecast.confidence)}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={cn('border-b border-border/40 last:border-0', row.bold && 'bg-muted/20 font-semibold')}>
                  <td className="py-2 pr-3 text-muted-foreground">
                    <div>{row.label}</div>
                    {row.note && <div className="text-xs text-muted-foreground/70">{row.note}</div>}
                  </td>
                  <td className={cn(
                    'py-2 text-right font-mono',
                    row.positive ? 'text-green-500' :
                    row.negative ? 'text-red-400' :
                    row.signed ? (row.value >= 0 ? 'text-green-500' : 'text-red-400') : ''
                  )}>
                    {row.signed && row.value >= 0 ? '+' : ''}
                    {fmtSigned(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full">
            Lukk
          </Button>
        </div>
      </div>
    </div>
  )
}
