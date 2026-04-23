import { Home, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap, CalendarDays, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useEconomyStore } from '@/application/useEconomyStore'
import { calculateGoalProgress } from '@/domain/economy/savingsCalculator'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
import { getDaysUsedLast12Months, getDaysUsedFromEvents, getAbsenceStatus, getAbsenceStatusFromEvents, getStatusColor } from '@/domain/economy/absenceCalculator'
import { sumATFByYear } from '@/domain/economy/atfCalculator'
import { forecastJune } from '@/domain/economy/holidayPayCalculator'
import { computeBudgetTable } from '@/domain/economy/budgetTableComputer'
import { useAppStore } from '@/store/useAppStore'
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from '@/lib/syncEconomyData'
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

// ── Norske helligdager ─────────────────────────────────────
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
  const addDays = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return new Set([
    `${year}-01-01`, // Nyttår
    `${year}-05-01`, // 1. mai
    `${year}-05-17`, // 17. mai
    `${year}-12-25`, // 1. juledag
    `${year}-12-26`, // 2. juledag
    fmt(addDays(easter, -3)),  // Skjærtorsdag
    fmt(addDays(easter, -2)),  // Langfredag
    fmt(easter),               // 1. påskedag
    fmt(addDays(easter, 1)),   // 2. påskedag
    fmt(addDays(easter, 39)),  // Kristi Himmelfartsdag
    fmt(addDays(easter, 49)),  // 1. pinsedag
    fmt(addDays(easter, 50)),  // 2. pinsedag
  ])
}

function getNextPayday(from: Date): Date {
  const tryMonth = (year: number, month: number): Date => {
    const holidays = getNorwegianHolidays(year)
    let d = new Date(year, month, 12)
    // Flytt bakover forbi helg og helligdager
    while (d.getDay() === 0 || d.getDay() === 6 || holidays.has(d.toISOString().slice(0, 10))) {
      d.setDate(d.getDate() - 1)
    }
    return d
  }
  const thisMonthPayday = tryMonth(from.getFullYear(), from.getMonth())
  // Bruk neste måned hvis lønningsdagen allerede har vært
  if (thisMonthPayday <= from) {
    const next = new Date(from.getFullYear(), from.getMonth() + 1, 1)
    return tryMonth(next.getFullYear(), next.getMonth())
  }
  return thisMonthPayday
}

// Isolert klokke-komponent — re-renderer hvert sekund uten å påvirke Dashboard
function LiveKlokke() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums text-foreground">
        {now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-xs text-muted-foreground">
        {now.toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

// Viser synkroniseringsstatus mot Supabase
function SyncStatusIndikator() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus)
  useEffect(() => onSyncStatusChange(setStatus), [])
  if (status === 'idle') return null
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground pb-0.5">
      {status === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Lagrer…</>}
      {status === 'saved' && <><Cloud className="h-3 w-3 text-green-500" /> Lagret</>}
      {status === 'error' && <><CloudOff className="h-3 w-3 text-red-400" /> Lagringsfeil</>}
    </span>
  )
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
    fondPortfolio,
    subscriptions,
    insurances,
    temporaryPayEntries,
    budgetOverrides,
    ivfTransactions,
  } = useEconomyStore()

  // Klokken isoleres i <LiveKlokke /> — her trenger vi bare dato for beregninger
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // ── Nedtellinger ──────────────────────────────────────────
  const nextPayday = getNextPayday(now)
  const daysToPayday = Math.ceil((nextPayday.getTime() - now.getTime()) / 86400000)

  // Neste kommende ferieperiode (siste arbeidsdag ennå ikke passert, eller pågående)
  const nextVacation = (profile?.vacationPeriods ?? [])
    .filter((p) => new Date(p.firstWorkDayAfter) > now)
    .sort((a, b) => new Date(a.lastWorkDayBefore).getTime() - new Date(b.lastWorkDayBefore).getTime())[0] ?? null

  const daysToVacation = nextVacation
    ? Math.ceil((new Date(nextVacation.lastWorkDayBefore).getTime() - now.getTime()) / 86400000)
    : null
  const daysBackFromVacation = nextVacation
    ? Math.ceil((new Date(nextVacation.firstWorkDayAfter).getTime() - now.getTime()) / 86400000)
    : null
  const isOnVacation = daysToVacation !== null && daysToVacation <= 0

  const currentMonthRecord = monthHistory.find(
    (m) => m.year === currentYear && m.month === currentMonth
  )

  const nettoInn = currentMonthRecord?.nettoUtbetalt ?? 0

  const fasteUt = budgetTemplate.lines
    .filter((l) => l.isRecurring && (EXPENSE_CATEGORIES as readonly string[]).includes(l.category))
    .reduce((s, l) => s + Math.abs(l.amount), 0)

  const harBudsjettLinjer = budgetTemplate.lines.some(
    (l) => l.isRecurring && (EXPENSE_CATEGORIES as readonly string[]).includes(l.category)
  )

  const disponibelt = nettoInn - fasteUt

  const latestSlipRecord = monthHistory
    .filter((m) => m.year === currentYear && m.slipData != null)
    .sort((a, b) => b.month - a.month)[0]

  const atfSum = sumATFByYear(atfEntries, currentYear)
  const yearATF = atfEntries.filter((e) => (e.payoutYear ?? e.year) === currentYear)

  const absenceDays = absenceEvents.length > 0 ? getDaysUsedFromEvents(absenceEvents) : getDaysUsedLast12Months(absenceRecords)
  const absenceStatus = absenceEvents.length > 0 ? getAbsenceStatusFromEvents(absenceEvents) : getAbsenceStatus(absenceRecords)

  const taxAnalysis = analyzeTaxSettlements(taxSettlements, profile?.extraTaxWithholding ?? 0)

  const appScenarios = useAppStore((s) => s.scenarios)
  const appActiveScenarioId = useAppStore((s) => s.activeScenarioId)
  const appAnalyses = useAppStore((s) => s.analyses)
  const activeScenario = appScenarios.find((s) => s.id === appActiveScenarioId)
  const maxKjøpesum = activeScenario
    ? appAnalyses[activeScenario.id]?.maxPurchase?.maxPurchasePrice
    : null

  // ── KPI-beregninger ────────────────────────────────────────
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

  // ── Inntektstrend — siste 6 måneder med slipp ─────────────
  const trendData = [...monthHistory]
    .filter((m) => m.slipData != null)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .slice(-6)
    .map((m) => ({
      mnd: MONTH_NAMES[m.month],
      netto: m.nettoUtbetalt,
    }))

  const trendAvg = trendData.length > 0
    ? trendData.reduce((s, d) => s + d.netto, 0) / trendData.length
    : 0

  // Sammenlign siste to måneder for trend-indikator
  const trendDir: 'opp' | 'ned' | 'flat' = trendData.length >= 2
    ? trendData[trendData.length - 1].netto > trendData[trendData.length - 2].netto * 1.01
      ? 'opp'
      : trendData[trendData.length - 1].netto < trendData[trendData.length - 2].netto * 0.99
        ? 'ned'
        : 'flat'
    : 'flat'

  // ── Innsiktstekst ─────────────────────────────────────────
  const innsikt: string[] = []
  if (trendData.length >= 3) {
    innsikt.push(`Snitt netto siste ${trendData.length} mnd: ${fmtNOK(trendAvg)}`)
  }
  if (atfSum > 0) {
    innsikt.push(`ATF registrert i ${currentYear}: ${fmtNOK(atfSum)}`)
  }
  if (nettoFormue > 0) {
    innsikt.push(`Netto formue (sparing minus gjeld): ${fmtNOK(nettoFormue)}`)
  }
  if (taxAnalysis.recommendation === 'reduce_extra') {
    innsikt.push(
      `Skatteoppgjøret tyder på at du kan redusere ekstra trekk med ${fmtNOK(taxAnalysis.recommendedExtraAdjustment)}/mnd.`
    )
  }

  const juneForecast = profile ? forecastJune(currentYear, monthHistory, profile, atfEntries) : null

  // ── Budsjettabell (samme motor som Budsjett-fanen) ─────────
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
  const nettoRow = allBudgetRows.find((r) => r.id === 'netto')
  const overskuddRow = allBudgetRows.find((r) => r.id === 'overskudd')
  const monthIdx = currentMonth - 1
  const nettoCell = nettoRow?.cells[monthIdx]
  const overskuddCell = overskuddRow?.cells[monthIdx]
  const nettoFraBudsjett = nettoCell ? (nettoCell.actual ?? nettoCell.budget) : 0
  const overskuddFraBudsjett = overskuddCell ? (overskuddCell.actual ?? overskuddCell.budget) : null

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">

      {/* ── Topprad: klokke + nedtellinger ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-end gap-3">
          <LiveKlokke />
          <SyncStatusIndikator />
        </div>
        <div className="flex flex-wrap gap-2">
          <CountdownChip
            icon="💰"
            label="Neste lønning"
            days={daysToPayday}
            detail={nextPayday.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
          />
          {nextVacation && !isOnVacation && daysToVacation !== null && daysToVacation > 0 && (
            <CountdownChip
              icon="🏖️"
              label={nextVacation.label}
              days={daysToVacation}
              detail={new Date(nextVacation.lastWorkDayBefore).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
            />
          )}
          {nextVacation && isOnVacation && daysBackFromVacation !== null && (
            <CountdownChip
              icon="🏖️"
              label={`${nextVacation.label} — tilbake`}
              days={daysBackFromVacation}
              detail={new Date(nextVacation.firstWorkDayAfter).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
            />
          )}
          {!nextVacation && (
            <button
              onClick={() => onNavigate('vacation')}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-muted/40 border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
            >
              <CalendarDays className="h-3 w-3" />
              Planlegg ferie
            </button>
          )}
        </div>
      </div>

      {/* ── KPI-strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard
          label="Netto formue"
          value={nettoFormue}
          color={nettoFormue >= 0 ? 'green' : 'red'}
          sub={totalGjeld > 0 ? `Gjeld: ${fmtNOK(totalGjeld)}` : undefined}
        />
        <KpiCard
          label="Total sparing"
          value={totalSparing}
          color="blue"
          sub={
            fondVerdi > 0 && savingsAccounts.length > 0
              ? `${savingsAccounts.length} kontoer + fond`
              : fondVerdi > 0
              ? `inkl. fond ${Math.round(fondVerdi).toLocaleString('no-NO')} kr`
              : savingsAccounts.length > 0
              ? `${savingsAccounts.length} kontoer`
              : undefined
          }
        />
        <KpiCard
          label="Netto inn"
          value={nettoInn}
          color={nettoInn > 0 ? 'green' : 'default'}
          sub={currentMonthRecord ? undefined : 'Ingen slipp lastet'}
        />
        <KpiCard
          label="Feriepenger juni"
          value={juneForecast?.nettoJuni ?? 0}
          color="purple"
          sub={juneForecast ? `Ekstra: ${fmtNOK(juneForecast.nettoEkstra)}` : 'Trenger profil'}
        />
      </div>

      {/* ── Inntektstrend-chart ── */}
      {trendData.length >= 2 && (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Nettoinntekt</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {trendDir === 'opp' && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
              {trendDir === 'ned' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
              {trendDir === 'flat' && <Minus className="h-3.5 w-3.5" />}
              <span>snitt {fmtNOK(trendAvg)}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={trendData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id="nettoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mnd" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v) => [fmtNOK(Number(v)), 'Netto']}
                contentStyle={{
                  fontSize: 11,
                  background: 'hsl(240 10% 10%)',
                  border: '1px solid hsl(240 5% 20%)',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
                labelStyle={{ color: '#94a3b8' }}
                cursor={{ stroke: 'hsl(240 5% 30%)', strokeWidth: 1 }}
              />
              <ReferenceLine y={trendAvg} stroke="hsl(240 5% 40%)" strokeDasharray="4 3" strokeOpacity={0.6} />
              <Area
                type="monotone"
                dataKey="netto"
                stroke="#22c55e"
                strokeWidth={1.5}
                fill="url(#nettoGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Pengepuls ── */}
      <PengePuls
        trendData={trendData}
        trendAvg={trendAvg}
        nettoInn={nettoFraBudsjett}
        overskudd={overskuddFraBudsjett}
        juneForecast={juneForecast}
        savingsGoals={savingsGoals}
        savingsAccounts={savingsAccounts}
        atfSum={atfSum}
        absenceDays={absenceDays}
        fondVerdi={fondVerdi}
        fondMonthlyDeposit={fondPortfolio?.monthlyDeposit ?? 0}
      />

      {/* ── Månedsstatus (disponibelt) — vises kun ved ingen trend-data ── */}
      {trendData.length < 2 && currentMonthRecord && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Netto inn" value={nettoInn} positive />
            <StatCard label="Faste ut" value={fasteUt} />
            <StatCard label="Disponibelt" value={disponibelt} positive={disponibelt >= 0} />
          </div>
          {!harBudsjettLinjer && (
            <p className="text-xs text-muted-foreground text-center">
              <button className="underline hover:text-foreground" onClick={() => onNavigate('budget')}>
                Legg til faste utgifter i Budsjett
              </button>
            </p>
          )}
        </>
      )}

      {!currentMonthRecord && trendData.length === 0 && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ingen data for {MONTH_NAMES[currentMonth]}. Last opp lønnsslippen din for å komme i gang.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── 2-kolonne grid: Sparemål / ATF / Gjeld / Egenmelding ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sparemål</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savingsGoals.length === 0 ? (
              <EmptyState message="Ingen sparemål registrert" action="Legg til mål" onAction={() => onNavigate('savings')} />
            ) : (
              savingsGoals.slice(0, 3).map((goal) => {
                const progress = calculateGoalProgress(goal, savingsAccounts, fondVerdi, fondPortfolio?.monthlyDeposit ?? 0)
                return (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <span>{goal.icon}</span>
                        <span className="font-medium">{goal.label}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">{Math.round(progress.percent)}%</span>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ATF dette året</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {yearATF.length === 0 ? (
              <EmptyState message={`Ingen øvelser registrert for ${currentYear}`} action="Legg til øvelse" onAction={() => onNavigate('atf')} />
            ) : (
              <>
                {yearATF.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{e.øvelsesnavn}</span>
                    <span className="font-mono font-medium ml-2 shrink-0">{fmtNOK(e.beregnetBeløp)}</span>
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
                absenceStatus === 'ok' ? '[&>div]:bg-green-500'
                : absenceStatus === 'warning' ? '[&>div]:bg-yellow-500'
                : '[&>div]:bg-red-500'
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Skattevarsel ── */}
      {taxAnalysis.recommendation === 'reduce_extra' && (
        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-sm text-yellow-400 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Du får tilbake ~{fmtNOK(taxAnalysis.avgYearlyRefund)}/år.
            Vurder å redusere ekstra trekk med {fmtNOK(taxAnalysis.recommendedExtraAdjustment)}/mnd.
          </span>
        </div>
      )}

      {/* ── Feriepenger ── */}
      {profile && (
        <FeriepengeSummaryCard
          juneForecast={juneForecast}
          currentYear={currentYear}
          onNavigate={onNavigate}
        />
      )}

      {/* ── Lønn og skatt ── */}
      <SlipWidget slip={latestSlipRecord?.slipData ?? null} onNavigate={onNavigate} />

      {/* ── Boligscenario ── */}
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
            <Button size="sm" variant="outline" onClick={() => useAppStore.getState().setCurrentView('calculator')}>
              Åpne kalkulator
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// KPI-KORT
// ------------------------------------------------------------

function KpiCard({
  label,
  value,
  color = 'default',
  sub,
}: {
  label: string
  value: number
  color?: 'green' | 'red' | 'blue' | 'purple' | 'default'
  sub?: string
}) {
  const colorClass = {
    green: 'text-green-500',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-violet-400',
    default: 'text-foreground',
  }[color]

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm font-semibold font-mono mt-0.5 tabular-nums', colorClass)}>
        {Math.round(Math.abs(value)).toLocaleString('no-NO')} kr
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}

// ------------------------------------------------------------
// PENGEPULS
// ------------------------------------------------------------

function PengePuls({
  trendData: _trendData,
  trendAvg,
  nettoInn,
  overskudd,
  juneForecast,
  savingsGoals,
  savingsAccounts,
  atfSum,
  absenceDays,
  fondVerdi,
  fondMonthlyDeposit,
}: {
  trendData: { mnd: string; netto: number }[]
  trendAvg: number
  nettoInn: number
  overskudd: number | null
  juneForecast: ReturnType<typeof forecastJune> | null
  savingsGoals: ReturnType<typeof useEconomyStore.getState>['savingsGoals']
  savingsAccounts: ReturnType<typeof useEconomyStore.getState>['savingsAccounts']
  atfSum: number
  absenceDays: number
  fondVerdi: number
  fondMonthlyDeposit: number
}) {
  const chips: { icon: string; text: string; accent?: string }[] = []

  // Sparerate — basert på budsjettmotoren (inkl. sparing, gjeld, abonnementer)
  if (nettoInn > 0 && overskudd !== null) {
    const sparerate = Math.round((overskudd / nettoInn) * 100)
    chips.push({
      icon: '💰',
      text: `Sparerate: ${sparerate}% av netto`,
      accent: sparerate >= 20 ? 'green' : sparerate >= 10 ? 'yellow' : 'red',
    })
  } else if (trendAvg > 0) {
    chips.push({ icon: '📈', text: `Snitt netto: ${Math.round(trendAvg).toLocaleString('no-NO')} kr/mnd` })
  }

  // Dager til feriepenger
  if (juneForecast) {
    const now = new Date()
    const juneFirst = new Date(now.getFullYear(), 5, 24)
    if (juneFirst < now) juneFirst.setFullYear(now.getFullYear() + 1)
    const days = Math.ceil((juneFirst.getTime() - now.getTime()) / 86400000)
    chips.push({
      icon: '🏖️',
      text: `${days} dager til feriepenger (${Math.round(juneForecast.nettoJuni).toLocaleString('no-NO')} kr)`,
    })
  }

  // Sparemål ETA — basert på faktisk månedlig sparing på tilknyttede kontoer
  if (savingsGoals.length > 0) {
    const goal = savingsGoals[0]
    const prog = calculateGoalProgress(goal, savingsAccounts, fondVerdi, fondMonthlyDeposit)
    if (prog.percent >= 100) {
      chips.push({ icon: '✅', text: `«${goal.label}» er nådd!`, accent: 'green' })
    } else if (prog.monthsRemaining !== null && prog.monthsRemaining > 0) {
      chips.push({
        icon: '🎯',
        text: `«${goal.label}» nås om ca. ${prog.monthsRemaining} mnd`,
      })
    }
  }

  // ATF bonus
  if (atfSum > 0) {
    chips.push({ icon: '🎖️', text: `ATF-bonus i år: ${Math.round(atfSum).toLocaleString('no-NO')} kr` })
  }

  // Egenmelding
  if (absenceDays >= 16) {
    chips.push({ icon: '⚠️', text: `${absenceDays}/24 egenmeldingsdager brukt`, accent: 'red' })
  }

  if (chips.length === 0) return null

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Zap className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pengepuls</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, i) => (
          <span
            key={i}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border',
              chip.accent === 'green' && 'bg-green-500/10 border-green-500/20 text-green-400',
              chip.accent === 'yellow' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
              chip.accent === 'red' && 'bg-red-500/10 border-red-500/20 text-red-400',
              !chip.accent && 'bg-muted/40 border-border/40 text-muted-foreground',
            )}
          >
            <span>{chip.icon}</span>
            <span>{chip.text}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// LØNN OG SKATT WIDGET
// ------------------------------------------------------------

function SlipWidget({ slip, onNavigate }: { slip: ParsetLonnsslipp | null; onNavigate: (page: string) => void }) {
  if (!slip) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Lønn og skatt</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4 space-y-2">
          <p className="text-sm text-muted-foreground">Last opp lønnsslippen din for å se tall</p>
          <Button variant="outline" size="sm" onClick={() => onNavigate('salary')}>Last opp slipp</Button>
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
    { label: 'Skattetrekk', denne: -slip.skattetrekk, hittil: slip.hittilForskuddstrekk ? -slip.hittilForskuddstrekk : null },
    { label: 'Pensjonstrekk SPK', denne: -slip.pensjonstrekk, hittil: slip.hittilPensjon ? -slip.hittilPensjon : null },
    ...(slip.husleietrekk > 0 ? [{ label: 'Husleietrekk', denne: -slip.husleietrekk, hittil: null as null }] : []),
    ...(slip.ekstraTrekk > 0 ? [{ label: 'Ekstra trekk', denne: -slip.ekstraTrekk, hittil: null as null }] : []),
    ...(slip.fagforeningskontingent > 0 ? [{ label: 'Fagforeningskont.', denne: -slip.fagforeningskontingent, hittil: null as null }] : []),
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
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-1/2">Post</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Denne mnd</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Hittil i år</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn('border-b border-border/50 last:border-0', row.bold && 'bg-muted/20 font-semibold')}>
                <td className="px-4 py-2 text-muted-foreground">{row.label}</td>
                <td className={cn('px-4 py-2 text-right font-mono', row.denne < 0 ? 'text-red-400' : '')}>
                  {fmtSigned(row.denne)}
                </td>
                <td className={cn('px-4 py-2 text-right font-mono text-muted-foreground', row.hittil !== null && row.hittil < 0 ? 'text-red-400/70' : '')}>
                  {fmtSigned(row.hittil)}
                </td>
              </tr>
            ))}
          </tbody>
          {(slip.feriepengegrunnlag > 0 || slip.opptjentFerie > 0 || slip.gruppelivspremie > 0) && (
            <tfoot className="border-t-2 border-border">
              {slip.feriepengegrunnlag > 0 && (
                <tr className="border-b border-border/30">
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">Feriepengegrunnlag</td>
                  <td />
                  <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">{fmtNOK(slip.feriepengegrunnlag)}</td>
                </tr>
              )}
              {slip.opptjentFerie > 0 && (
                <tr className="border-b border-border/30">
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">Opptjent ferie</td>
                  <td />
                  <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">{fmtNOK(slip.opptjentFerie)}</td>
                </tr>
              )}
              {slip.gruppelivspremie > 0 && (
                <tr>
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">Gruppelivspremie</td>
                  <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">{fmtNOK(slip.gruppelivspremie)}</td>
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
        <p className={cn('text-base font-semibold font-mono mt-0.5', positive === true ? 'text-green-500' : positive === false ? 'text-red-400' : '')}>
          {Math.round(Math.abs(value)).toLocaleString('no-NO')} kr
        </p>
      </CardContent>
    </Card>
  )
}

function CountdownChip({ icon, label, days, detail }: { icon: string; label: string; days: number; detail: string }) {
  const accent = days <= 3 ? 'green' : days <= 7 ? 'yellow' : undefined
  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border',
      accent === 'green' && 'bg-green-500/10 border-green-500/20 text-green-400',
      accent === 'yellow' && 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
      !accent && 'bg-muted/40 border-border/40 text-muted-foreground',
    )}>
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="opacity-70">{days} dager · {detail}</span>
    </div>
  )
}

function EmptyState({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="text-center py-2">
      <p className="text-xs text-muted-foreground mb-2">{message}</p>
      <Button variant="outline" size="sm" onClick={onAction}>{action}</Button>
    </div>
  )
}

// ------------------------------------------------------------
// FERIEPENGE-SAMMENDRAG
// ------------------------------------------------------------

function FeriepengeSummaryCard({
  juneForecast: forecast,
  currentYear,
  onNavigate,
}: {
  juneForecast: ReturnType<typeof forecastJune> | null
  currentYear: number
  onNavigate?: (page: string) => void
}) {
  if (!forecast) return null

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
