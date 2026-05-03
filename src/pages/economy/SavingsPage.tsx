import { useState, useMemo, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Plus, Trash2, Upload, ChevronDown, ChevronUp, Repeat2, Pencil, Check, X, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useEconomyStore } from '@/application/useEconomyStore'
import { BSU_MAX_YEARLY } from '@/config/economy.config'
import {
  checkBSULimits,
  calculateGoalProgress,
  projectSavingsGrowth,
  computeMonthlyContributionEstimate,
  computeYTDContributions,
  computeYearlyInterestIncome,
  computeBSUForecast,
  computeEffectiveBalance,
  projectBalanceMonthly,
} from '@/domain/economy/savingsCalculator'
import { calcMaxPurchase, BSU_MAX_TOTAL, EK_KRAV } from '@/hooks/useVeikart'
import type {
  SavingsAccount,
  SavingsGoal,
  SavingsAccountType,
  BalanceHistoryEntry,
  RateHistoryEntry,
  SavingsContribution,
  WithdrawalEntry,
  PartnerVeikart,
  EmploymentProfile,
  DebtAccount,

} from '@/types/economy'
import { SavingsImporter } from '@/features/savings/SavingsImporter'
import { cn } from '@/lib/utils'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// computeEffectiveBalance er eksportert fra savingsCalculator og importert over

const ACCOUNT_TYPE_LABELS: Record<SavingsAccountType, string> = {
  BSU: 'BSU',
  fond: 'Fond',
  krypto: 'Krypto',
  sparekonto: 'Sparekonto',
  annet: 'Annet',
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

type SavingsSubTab = 'kontoer' | 'spareplan'

export function SavingsPage() {
  const {
    savingsAccounts,
    savingsGoals,
    budgetTemplate,
    addSavingsAccount,
    removeSavingsAccount,
    updateSavingsAccount,
    updateSavingsBalance,
    updateSavingsRate,
    addContribution,
    removeContribution,
    addWithdrawal,
    removeWithdrawal,
    addSavingsGoal,
    removeSavingsGoal,
    fondPortfolio,
    partnerVeikart,
    profile,
    debts,
  } = useEconomyStore()

  const SAVINGS_CATS = new Set(['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'])
  const budgetSavingsLines = (budgetTemplate?.lines ?? []).filter(
    (l) => SAVINGS_CATS.has(l.category) && l.isRecurring && Math.abs(l.amount) > 0
  )

  const sortedFondSnapshots = [...(fondPortfolio?.snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const fondCurrentValue = sortedFondSnapshots[0]?.totalValue ?? 0
  const fondMonthlyDeposit = fondPortfolio?.monthlyDeposit ?? 0

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const { savingsSubTab: subTab, setSavingsSubTab: setSubTab } = useAppStore()

  const now = new Date()
  const currentYear = now.getFullYear()

  // Summary stats
  const totalBalance = savingsAccounts.reduce((s, a) => s + computeEffectiveBalance(a, now), 0)

  const bsuAccount = savingsAccounts.find((a) => a.type === 'BSU')
  const bsuStatus = bsuAccount ? checkBSULimits(bsuAccount, currentYear) : null
  const bsuSkattefradrag = bsuAccount
    ? Math.round(Math.min(bsuStatus!.yearlyContributionSoFar, 27500) * 0.1)
    : 0

  const totalInterestIncome = savingsAccounts
    .filter((a) => a.type !== 'fond' && a.type !== 'krypto')
    .reduce((s, a) => s + computeYearlyInterestIncome(a, currentYear), 0)

  const totalInterestForecast = savingsAccounts
    .filter((a) => a.type !== 'fond' && a.type !== 'krypto')
    .reduce((s, a) => s + computeYearlyInterestIncome(a, currentYear, true), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 border-b border-border bg-card/40 px-4 shrink-0">
        {(['kontoer', 'spareplan'] as SavingsSubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize whitespace-nowrap',
              subTab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {t === 'spareplan' && <Users className="h-3 w-3" />}
            {t === 'kontoer' ? 'Kontoer & Mål' : 'Felles spareplan'}
          </button>
        ))}
      </div>

      {subTab === 'spareplan' && (
        <SparePlanTab
          savingsAccounts={savingsAccounts}
          fondCurrentValue={fondCurrentValue}
          fondMonthlyDeposit={fondMonthlyDeposit}
          partnerVeikart={partnerVeikart}
          profile={profile}
          debts={debts}
          now={now}
          onNavigateToAccounts={() => setSubTab('kontoer')}
        />
      )}

      {subTab === 'kontoer' && (
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Sparing</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
            <Upload className="h-4 w-4 mr-1" />
            Importer rapport
          </Button>
          <Button size="sm" onClick={() => setShowAddAccount(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ny konto
          </Button>
        </div>
      </div>

      {showImport && (
        <SavingsImporter onDone={() => setShowImport(false)} />
      )}

      {showAddAccount && (
        <AddAccountForm
          onSave={(a) => { addSavingsAccount(a); setShowAddAccount(false) }}
          onCancel={() => setShowAddAccount(false)}
        />
      )}

      {/* Summary bar */}
      {savingsAccounts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard label="Total saldo" value={fmtNOK(totalBalance)} />
          {bsuStatus && (
            <SummaryCard
              label={`BSU-kvote ${currentYear}`}
              value={`${fmtNOK(bsuStatus.yearlyContributionSoFar)} / 27 500 kr`}
              subvalue={`${Math.round((bsuStatus.yearlyContributionSoFar / 27500) * 100)}%`}
            />
          )}
          {bsuAccount && (
            <SummaryCard
              label="BSU skattefradrag"
              value={fmtNOK(bsuSkattefradrag)}
              subvalue="10% av innskudd"
            />
          )}
          {totalInterestForecast > 0 && (
            <SummaryCard
              label={`Renteinntekter ${currentYear}`}
              value={fmtNOK(totalInterestForecast)}
              subvalue={totalInterestIncome > 0 && totalInterestIncome < totalInterestForecast
                ? `${fmtNOK(totalInterestIncome)} opptjent hittil`
                : 'prognose hele året'}
            />
          )}
        </div>
      )}

      {/* Kontoer */}
      {savingsAccounts.length === 0 && !showAddAccount ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">Ingen sparekontoer registrert.</p>
            <Button size="sm" onClick={() => setShowAddAccount(true)}>Legg til sparekonto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {savingsAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              now={now}
              onRemove={() => removeSavingsAccount(account.id)}
              onUpdate={(patch) => updateSavingsAccount(account.id, patch)}
              onUpdateBalance={(entry) => updateSavingsBalance(account.id, entry)}
              onUpdateRate={(entry) => updateSavingsRate(account.id, entry)}
              onAddContribution={(c) => addContribution(account.id, c)}
              onRemoveContribution={(id) => removeContribution(account.id, id)}
              onAddWithdrawal={(w) => addWithdrawal(account.id, w)}
              onRemoveWithdrawal={(id) => removeWithdrawal(account.id, id)}
              onUpdateBirthYear={(year) => updateSavingsAccount(account.id, { birthYear: year })}
              onUpdateMonthlyContribution={(amount) => updateSavingsAccount(account.id, { monthlyContribution: amount })}
            />
          ))}
        </div>
      )}

      {/* Spareposter fra budsjett */}
      {budgetSavingsLines.length > 0 && (
        <div>
          <h3 className="font-medium text-sm mb-2">Spareposter fra budsjett</h3>
          <div className="rounded-md border border-border bg-muted/10 divide-y divide-border/50">
            {budgetSavingsLines.map((line) => {
              const linkedAccount = savingsAccounts.find((a) => a.id === (line as { linkedSavingsAccountId?: string }).linkedSavingsAccountId)
              return (
                <div key={line.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div>
                    <p className="font-medium">{line.label}</p>
                    {linkedAccount ? (
                      <p className="text-[10px] text-green-500">→ {linkedAccount.label}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Ikke koblet til konto</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Repeat2 className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-foreground">{Math.abs(line.amount).toLocaleString('no-NO')} kr/mnd</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sparemål */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Sparemål</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nytt mål
        </Button>
      </div>

      {showAddGoal && (
        <AddGoalForm
          accounts={savingsAccounts}
          fondMonthlyDeposit={fondMonthlyDeposit}
          onSave={(g) => { addSavingsGoal(g); setShowAddGoal(false) }}
          onCancel={() => setShowAddGoal(false)}
        />
      )}

      {savingsGoals.length === 0 && !showAddGoal ? (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">Ingen sparemål registrert.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {savingsGoals.map((goal) => {
            const progress = calculateGoalProgress(goal, savingsAccounts, fondCurrentValue, fondMonthlyDeposit)
            return (
              <Card key={goal.id}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.icon}</span>
                      <span className="font-medium text-sm">{goal.label}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                      onClick={() => removeSavingsGoal(goal.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Progress value={progress.percent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmtNOK(progress.currentTotal)} / {fmtNOK(progress.targetAmount)}</span>
                    <span>{Math.round(progress.percent)}%</span>
                  </div>
                  {goal.includeFond && (
                    <p className="text-xs text-muted-foreground">Inkl. KRON Fond</p>
                  )}
                  {progress.monthsRemaining !== null && progress.monthsRemaining > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Mangler {fmtNOK(progress.targetAmount - progress.currentTotal)} —
                      spar {fmtNOK(progress.monthlyNeeded ?? 0)}/mnd = {progress.monthsRemaining} mnd
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// SPAREPLAN TAB
// ------------------------------------------------------------

interface SparePlanTabProps {
  savingsAccounts: SavingsAccount[]
  fondCurrentValue: number
  fondMonthlyDeposit: number
  partnerVeikart: PartnerVeikart
  profile: EmploymentProfile | null
  debts: DebtAccount[]
  now: Date
  onNavigateToAccounts?: () => void
}

function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} mill`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)} k`
  return Math.round(n).toLocaleString('no-NO')
}

// ─── Inline-redigerbar celle ─────────────────────────────────
function InlineCell({
  value, onChange, suffix = '', step = 500, min = 0,
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  min?: number
}) {
  const [editing, setEditing] = useState(false)
  const [tmp, setTmp] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  function start() {
    setTmp(String(value || ''))
    setEditing(true)
    setTimeout(() => ref.current?.select(), 10)
  }
  function commit() {
    onChange(parseFloat(tmp) || 0)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={min}
        step={step}
        value={tmp}
        onChange={(e) => setTmp(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-6 w-24 rounded border border-primary bg-background px-2 text-xs text-right font-mono outline-none"
      />
    )
  }
  return (
    <button
      onClick={start}
      title="Klikk for å redigere"
      className="group flex items-center gap-1 border-b border-dashed border-border hover:border-primary transition-colors text-xs font-mono"
    >
      {value ? value.toLocaleString('no-NO') : <span className="text-muted-foreground italic">–</span>}
      {suffix}
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}

// ─── Insight-kort ─────────────────────────────────────────────
type InsightColor = 'green' | 'blue' | 'amber' | 'red'
function InsightCard({ icon, text, color }: { icon: string; text: string; color: InsightColor }) {
  const styles: Record<InsightColor, string> = {
    green: 'bg-green-500/8 border-green-500/20 text-green-400',
    blue: 'bg-blue-500/8 border-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/8 border-amber-500/30 text-amber-400',
    red: 'bg-red-500/8 border-red-500/20 text-red-400',
  }
  return (
    <div className={cn('flex gap-3 items-start rounded-lg border px-3 py-2.5', styles[color])}>
      <span className="text-base mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs leading-relaxed text-foreground">{text}</span>
    </div>
  )
}

// ─── Mini SVG sparkline ────────────────────────────────────────
function Sparkline({ data, color = '#60a5fa', height = 48 }: {
  data: number[]
  color?: string
  height?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const W = 200, H = height
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / (max - min || 1)) * H
    return `${x},${y}`
  }).join(' ')
  const area = `M0,${H} L${pts.split(' ').map(p => p).join(' L')} L${W},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.15} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

// ─── Projiser innskudd med trinnvise endringer ────────────────
function projectWithSteps(
  start: number, baseMonthly: number, rate: number, months: number, isBSU: boolean,
  steps: { fromMonth: number; monthly: number }[]
): number {
  if (!steps.length) return projectBalanceMonthly(start, baseMonthly, rate, months, isBSU)
  const sorted = steps.filter((s) => s.fromMonth < months).sort((a, b) => a.fromMonth - b.fromMonth)
  let bal = start, from = 0, monthly = baseMonthly
  for (const step of sorted) {
    const seg = step.fromMonth - from
    if (seg > 0) bal = projectBalanceMonthly(bal, monthly, rate, seg, isBSU)
    monthly = step.monthly
    from = step.fromMonth
  }
  const rem = months - from
  if (rem > 0) bal = projectBalanceMonthly(bal, monthly, rate, rem, isBSU)
  return bal
}

// ─── Projiser fremtidig gjeldssaldo ───────────────────────────
function projectDebtBalance(debt: DebtAccount, months: number): number {
  if (debt.status === 'nedbetalt') return 0
  const sorted = [...debt.rateHistory].sort((a, b) => b.fromDate.localeCompare(a.fromDate))
  const annualRate = sorted[0]?.nominalRate ?? 0
  const r = annualRate / 100 / 12
  const P = debt.monthlyPayment
  const B = debt.currentBalance
  if (B <= 0) return 0
  if (P <= 0) return B
  let bal: number
  if (r === 0) {
    bal = B - P * months
  } else {
    const f = Math.pow(1 + r, months)
    bal = B * f - P * (f - 1) / r
  }
  return Math.max(0, bal)
}

// ─── TYPES ────────────────────────────────────────────────────
// PlanSubTab er definert i useAppStore som 'plan' | 'kontoer' | 'feedback'

interface AccountRow {
  id: string
  label: string
  type: SavingsAccountType
  accountNumber?: string
  balance: number
  monthly: number
  budgetMonthly: number   // fra budsjettlinjer
  rate: number
  expectedReturn: number
  actualReturn: number | null
  ytd: number
  person: 'meg' | 'partner'
}

type ContribStep = { fromMonth: number; monthly: number }

// ─── SPAREPLAN TAB (full ny versjon) ──────────────────────────
function SparePlanTab({
  savingsAccounts,
  fondCurrentValue: _fondCurrentValue,
  fondMonthlyDeposit: _fondMonthlyDeposit,
  partnerVeikart,
  profile,
  debts,
  now,
  onNavigateToAccounts,
}: SparePlanTabProps) {
  const {
    updateSavingsAccount,
    savingsPlanTarget,
    setSavingsPlanTarget,
    savingsPlanHorizon,
    setSavingsPlanHorizon,
    setPartnerVeikart,
    budgetTemplate,
  } = useEconomyStore()

  // ── Bidragsplan: ulike innskudd til ulike tider (kun egne kontoer) ──
  const [contributionSteps, setContributionSteps] = useState<Record<string, ContribStep[]>>({})
  const [stepForm, setStepForm] = useState<{ accountId: string; fromMonth: number; monthly: number } | null>(null)

  function addContribStep(accountId: string, fromMonth: number, monthly: number) {
    setContributionSteps((prev) => ({
      ...prev,
      [accountId]: [...(prev[accountId] ?? []).filter((s) => s.fromMonth !== fromMonth), { fromMonth, monthly }]
        .sort((a, b) => a.fromMonth - b.fromMonth),
    }))
  }
  function removeContribStep(accountId: string, fromMonth: number) {
    setContributionSteps((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] ?? []).filter((s) => s.fromMonth !== fromMonth),
    }))
  }

  // ── Budget savings: match linjer til kontokategori ────────────
  // Maps SavingsAccountType → budget category string
  const BUDGET_CAT: Partial<Record<SavingsAccountType, string>> = {
    BSU: 'bsu', fond: 'fond', krypto: 'krypto', sparekonto: 'annen_sparing',
  }
  const budgetByCategory = (budgetTemplate?.lines ?? [])
    .filter((l) => ['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'].includes(l.category))
    .reduce((m, l) => ({ ...m, [l.category]: (m[l.category] ?? 0) + Math.abs(l.amount) }), {} as Record<string, number>)
  const budgetTotalSavings = Object.values(budgetByCategory).reduce((s, v) => s + v, 0)

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // ── Sub-tab state (persistert i useAppStore) ───────────────
  const { sparePlanSubTab: subTab, setSparePlanSubTab: setSubTab } = useAppStore()
  const [chartTab, setChartTab] = useState<'vekst' | 'bidrag' | 'avkastning'>('vekst')
  const [showWizard, setShowWizard] = useState(false)


  // ── Income ────────────────────────────────────────────────
  const userMonthlyIncome = profile?.baseMonthly ?? 0
  const partnerMonthlyIncome = (partnerVeikart?.annualIncome ?? 0) / 12
  const combinedIncome = userMonthlyIncome + partnerMonthlyIncome
  const partnerEnabled = partnerVeikart?.enabled ?? false

  // ── Build flat account rows ────────────────────────────────
  const userDebt = debts
    .filter((d) => d.status !== 'nedbetalt')
    .reduce((s, d) => s + d.currentBalance, 0)

  function makeRows(accounts: SavingsAccount[], person: 'meg' | 'partner'): AccountRow[] {
    return accounts.map((a) => {
      const balance = computeEffectiveBalance(a, now)
      const currentRate = [...a.rateHistory].sort((x, y) =>
        y.fromDate.localeCompare(x.fromDate))[0]?.rate ?? 0
      const ytd = computeYTDContributions(a, currentYear)
      const budgetCat = BUDGET_CAT[a.type]
      const budgetMonthly = budgetCat ? (budgetByCategory[budgetCat] ?? 0) : 0
      return {
        id: a.id,
        label: a.label,
        type: a.type,
        accountNumber: a.accountNumber,
        balance,
        monthly: a.monthlyContribution,
        budgetMonthly,
        rate: currentRate,
        expectedReturn: a.expectedReturn ?? (a.type === 'fond' || a.type === 'krypto' ? 6 : currentRate),
        actualReturn: a.actualReturn ?? null,
        ytd,
        person,
      }
    })
  }

  const myRows = makeRows(savingsAccounts, 'meg')
  const partnerRows: AccountRow[] = partnerEnabled ? [
    { id: 'p-bsu', label: 'BSU', type: 'BSU', balance: partnerVeikart?.bsu ?? 0,
      monthly: partnerVeikart?.bsuMonthlyContribution ?? 0, budgetMonthly: 0, rate: 5.5,
      expectedReturn: 5.5, actualReturn: null,
      ytd: (partnerVeikart?.bsuMonthlyContribution ?? 0) * (currentMonth + 1), person: 'partner' },
    { id: 'p-spare', label: 'Sparekonto', type: 'sparekonto',
      balance: partnerVeikart?.equity ?? 0,
      monthly: partnerVeikart?.monthlySavings ?? 0, budgetMonthly: 0, rate: 3.0,
      expectedReturn: 3.0, actualReturn: null,
      ytd: (partnerVeikart?.monthlySavings ?? 0) * (currentMonth + 1), person: 'partner' },
  ] : []

  const allRows = [...myRows, ...partnerRows]

  // ── Simulation engine ────────────────────────────────────
  // expectedReturn overstyrer rate; contributionSteps gir trinnvise innskudd
  function computeEK(rows: AccountRow[], months: number, steps: Record<string, ContribStep[]> = {}): number {
    return rows.reduce((sum, a) => {
      const rate = a.expectedReturn ?? a.rate
      return sum + projectWithSteps(a.balance, a.monthly, rate, months, a.type === 'BSU', steps[a.id] ?? [])
    }, 0)
  }

  // Use store values (declared before useMemo so they're available in the closure)
  const simHorizon = savingsPlanHorizon
  const targetPrice = savingsPlanTarget

  const simData = useMemo(() => {
    const steps = simHorizon + 1
    return Array.from({ length: steps }, (_, i) => {
      const meEK = computeEK(myRows, i, contributionSteps)
      const partnerEK = computeEK(partnerRows, i)
      const combined = meEK + (partnerEnabled ? partnerEK : 0)
      const debtAtMonth = debts
        .filter((d) => d.status !== 'nedbetalt')
        .reduce((s, d) => s + projectDebtBalance(d, i), 0)
      const maxPurchase = combinedIncome > 0
        ? calcMaxPurchase(combined, combinedIncome * 12, debtAtMonth)
        : 0
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = d.toLocaleDateString('no-NO', { month: 'short', year: '2-digit' })

      const meContribAccum = myRows.reduce((s, a) => s + a.balance + a.monthly * i, 0)
      const partnerContribAccum = partnerRows.reduce((s, a) => s + a.balance + a.monthly * i, 0)
      const totalInterest = Math.max(0, combined - meContribAccum - (partnerEnabled ? partnerContribAccum : 0))

      return {
        months: i, label, d,
        meEK: Math.round(meEK),
        partnerEK: Math.round(partnerEK),
        combined: Math.round(combined),
        maxPurchase: Math.round(maxPurchase),
        totalInterest: Math.round(totalInterest),
        meContrib: Math.round(myRows.reduce((s, a) => s + a.monthly * i, 0)),
        partnerContrib: Math.round(partnerRows.reduce((s, a) => s + a.monthly * i, 0)),
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savingsAccounts, partnerVeikart, savingsPlanHorizon, partnerEnabled, contributionSteps])

  // ── Goal calc ────────────────────────────────────────────
  const requiredEK = targetPrice > 0
    ? Math.max(targetPrice * EK_KRAV, targetPrice - combinedIncome * 12 * 5)
    : 0
  const reachIndex = requiredEK > 0
    ? simData.findIndex((d) => d.combined >= requiredEK)
    : -1
  const reachEntry = reachIndex >= 0 ? simData[reachIndex] : null

  const meTotalBalance = myRows.reduce((s, a) => s + a.balance, 0)
  const partnerTotalBalance = partnerRows.reduce((s, a) => s + a.balance, 0)
  const combinedTotal = meTotalBalance + (partnerEnabled ? partnerTotalBalance : 0)
  const meTotalMonthly = myRows.reduce((s, a) => s + a.monthly, 0)
  const partnerTotalMonthly = partnerRows.reduce((s, a) => s + a.monthly, 0)
  const totalMonthly = meTotalMonthly + (partnerEnabled ? partnerTotalMonthly : 0)
  const currentProgress = requiredEK > 0 ? Math.min(100, (combinedTotal / requiredEK) * 100) : 0

  // ── Update handler: inline edit i tabell ────────────────
  function handleAccountChange(row: AccountRow, field: keyof AccountRow, value: number) {
    if (row.person !== 'meg') return
    const patch: Partial<SavingsAccount> = {}
    if (field === 'monthly') patch.monthlyContribution = value
    if (field === 'expectedReturn') patch.expectedReturn = value
    if (field === 'actualReturn') patch.actualReturn = value
    if (Object.keys(patch).length > 0) updateSavingsAccount(row.id, patch)
  }

  function handlePartnerChange(id: string, field: 'monthly' | 'expectedReturn', value: number) {
    if (!partnerVeikart) return
    if (id === 'p-bsu') {
      setPartnerVeikart({ ...partnerVeikart, bsuMonthlyContribution: value })
    } else if (id === 'p-spare') {
      if (field === 'monthly') setPartnerVeikart({ ...partnerVeikart, monthlySavings: value })
    }
  }

  // ── Insights ─────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: string; color: InsightColor; text: string }[] = []
    const pctIncome = combinedIncome > 0 ? (totalMonthly / combinedIncome) * 100 : 0

    if (pctIncome >= 20)
      list.push({ icon: '🏆', color: 'green', text: `Dere sparer ${pctIncome.toFixed(0)} % av samlet inntekt – godt over anbefalt 20 %.` })
    else if (pctIncome >= 10)
      list.push({ icon: '👍', color: 'blue', text: `Dere sparer ${pctIncome.toFixed(0)} % av samlet inntekt. Anbefalt minstemål er 20 % – øk med ${fmtNOK(combinedIncome * 0.2 - totalMonthly)}/mnd for å nå det.` })
    else if (combinedIncome > 0)
      list.push({ icon: '⚠️', color: 'amber', text: `Kun ${pctIncome.toFixed(0)} % av inntekten spares. Vurder å øke månedlig sparing.` })

    const bsuAcc = savingsAccounts.find((a) => a.type === 'BSU')
    if (bsuAcc) {
      const balance = computeEffectiveBalance(bsuAcc, now)
      const maxPerMonth = BSU_MAX_YEARLY / 12
      if (balance >= BSU_MAX_TOTAL)
        list.push({ icon: '✅', color: 'green', text: 'BSU er fylt opp! Flytt BSU-sparingen til fond eller sparekonto.' })
      else if (bsuAcc.monthlyContribution < maxPerMonth * 0.9)
        list.push({ icon: '💡', color: 'blue', text: `Du kan øke BSU til ${fmtNOK(Math.round(maxPerMonth))}/mnd. Skattefradrag: ${fmtNOK(Math.min(bsuAcc.monthlyContribution * 12, BSU_MAX_YEARLY) * 0.1)}/år.` })
    }

    const fondAcc = savingsAccounts.find((a) => a.type === 'fond')
    if (fondAcc?.actualReturn != null) {
      const diff = (fondAcc.actualReturn ?? 0) - (fondAcc.expectedReturn ?? 6)
      if (diff > 1) list.push({ icon: '📈', color: 'green', text: `Fondet leverer ${fondAcc.actualReturn?.toFixed(1)} % – ${diff.toFixed(1)} % over forventet!` })
      if (diff < -2) list.push({ icon: '📉', color: 'amber', text: `Fondet leverer ${fondAcc.actualReturn?.toFixed(1)} % – under forventet. Vurder å justere prognosen.` })
    }

    if (reachEntry)
      list.push({ icon: '🏠', color: 'green', text: `Med nåværende tempo når dere EK-kravet for ${fmtNOK(targetPrice)}-boligen om ${reachEntry.months} måneder (${reachEntry.d.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}).` })
    else if (targetPrice > 0) {
      const gap = requiredEK - (simData[simData.length - 1]?.combined ?? 0)
      list.push({ icon: '🚧', color: 'amber', text: `Dere når ikke EK-kravet innen ${simHorizon / 12} år. Mangler ${fmtNOK(gap)} ved horisonten.` })
    }

    if (userDebt > 0 && totalMonthly > 0) {
      const debtToSavings = userDebt / (totalMonthly * 12)
      if (debtToSavings > 5)
        list.push({ icon: '⚖️', color: 'amber', text: `Gjelden (${fmtNOK(userDebt)}) er høy relativt til sparingen. Vurder ekstra nedbetaling av dyr gjeld.` })
    }

    return list
  }, [savingsAccounts, totalMonthly, combinedIncome, reachEntry, targetPrice, userDebt])

  // ── Chart data ────────────────────────────────────────────
  const chartData = simData.slice(1).filter((_, i) =>
    i % (simHorizon > 36 ? 3 : 1) === 0 || i === simData.length - 2
  )

  // ── Yearly rows ──────────────────────────────────────────
  const monthsLeft = 12 - currentMonth
  const yearRows = [0, 1, 2, 3, 4].map((offset) => {
    const idx = Math.min(offset === 0 ? monthsLeft : monthsLeft + offset * 12, simHorizon)
    const d = simData[idx] ?? simData[simData.length - 1]
    return { year: currentYear + offset, ...d }
  })

  // ── Sparkline data per account ────────────────────────────
  function sparklineForRow(row: AccountRow): number[] {
    return Array.from({ length: 13 }, (_, i) => {
      const isFond = row.type === 'fond' || row.type === 'krypto'
      const rate = isFond ? row.expectedReturn : row.rate
      return projectBalanceMonthly(row.balance, row.monthly, rate, i, row.type === 'BSU')
    })
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0">
        {([['plan', 'Simulering'], ['kontoer', 'Kontoer & innskudd'], ['feedback', 'Råd & varsler']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSubTab(k)}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              subTab === k
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground border border-border'
            )}
          >{l}</button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground" title="Grunnlønn brutto – brukes til maks låneberegning (5× inntekt)">
          Brutto: <span className="text-foreground font-mono">{fmtNOK(userMonthlyIncome)}/mnd</span>
          {partnerEnabled && <span className="font-mono"> + {fmtNOK(partnerMonthlyIncome)}/mnd</span>}
        </span>
      </div>

      {/* ── PLAN TAB ── */}
      {subTab === 'plan' && (
        <div className="flex-1 overflow-hidden flex">
          {/* Left sidebar */}
          <div className="w-72 shrink-0 border-r border-border overflow-y-auto p-3 space-y-3">
            {/* Goal */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-semibold">🏠 Boligmål</p>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Ønsket boligpris</label>
                <input
                  type="number"
                  step={50000}
                  value={targetPrice || ''}
                  placeholder="f.eks. 4 500 000"
                  onChange={(e) => setSavingsPlanTarget(parseFloat(e.target.value) || 0)}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              {targetPrice > 0 && (() => {
                const ekMinimum = targetPrice * EK_KRAV
                const maxLoan = combinedIncome * 12 * 5
                const ekFromIncome = targetPrice - maxLoan
                const incomeIsBinding = ekFromIncome > ekMinimum
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Nødvendig EK:</span>
                      <span className="font-mono font-semibold">{fmtNOK(requiredEK)}</span>
                    </div>
                    {/* Forklaring på hvorfor EK-kravet er høyt */}
                    {incomeIsBinding ? (
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <div className="flex justify-between">
                          <span>10%-regelen alene:</span>
                          <span className="font-mono">{fmtNOK(ekMinimum)}</span>
                        </div>
                        <div className="flex justify-between text-amber-400/80">
                          <span>Maks lån (5× inntekt {fmtNOK(combinedIncome * 12)}/år):</span>
                          <span className="font-mono">{fmtNOK(maxLoan)}</span>
                        </div>
                        <div className="flex justify-between text-amber-400">
                          <span>→ Manglende EK over lånegrensen:</span>
                          <span className="font-mono font-semibold">{fmtNOK(ekFromIncome)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Minimum {(EK_KRAV * 100).toFixed(0)} % egenkapital</p>
                    )}
                    <Progress value={currentProgress} className="h-1.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{fmtNOK(combinedTotal)} av {fmtNOK(requiredEK)}</span>
                      <span>{currentProgress.toFixed(0)} % av mål</span>
                    </div>
                    {reachEntry ? (
                      <div className="rounded border border-green-500/30 bg-green-500/8 px-2 py-1.5 text-[10px] text-green-400">
                        ✓ Mål nås om <b>{reachEntry.months} mnd</b> ({reachEntry.d.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })})
                      </div>
                    ) : (
                      <div className="rounded border border-amber-500/30 bg-amber-500/8 px-2 py-1.5 text-[10px] text-amber-400">
                        Ikke innen {simHorizon / 12} år – juster sparing eller mål
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Horizon */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Simuleringshorisont</span>
                <span className="text-xs font-mono font-semibold">{simHorizon / 12} år</span>
              </div>
              <input
                type="range" min={12} max={120} step={12}
                value={simHorizon}
                onChange={(e) => setSavingsPlanHorizon(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>1 år</span><span>5 år</span><span>10 år</span>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Meg – EK nå', value: fmtM(meTotalBalance), color: 'text-blue-400' },
                { label: 'Partner – EK nå', value: fmtM(partnerTotalBalance), color: 'text-purple-400', hidden: !partnerEnabled },
                { label: 'Samlet EK', value: fmtM(combinedTotal), color: 'text-foreground' },
                { label: 'Max kjøpesum', value: fmtM(simData[0]?.maxPurchase ?? 0), color: 'text-green-400', sub: '5× inntekt, 10% EK' },
              ].filter((k) => !k.hidden).map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-card px-2.5 py-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={cn('text-sm font-bold font-mono', k.color)}>{k.value}</p>
                  {k.sub && <p className="text-[9px] text-muted-foreground mt-0.5">{k.sub}</p>}
                </div>
              ))}
            </div>

          </div>

          {/* Right: chart + table */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Chart tabs */}
            <div className="flex items-center gap-1.5">
              {([['vekst', 'EK-vekst'], ['bidrag', 'Innskudd'], ['avkastning', 'Rente & avk.']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setChartTab(k)}
                  className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    chartTab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground border border-border hover:text-foreground'
                  )}>{l}</button>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-border bg-card p-3">
              <SparePlanChart
                data={chartData}
                tab={chartTab}
                requiredEK={requiredEK}
                partnerEnabled={partnerEnabled}
              />
            </div>

            {/* Yearly table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold">Årsvis prognose</span>
                <span className="text-[10px] text-muted-foreground">Nåværende sparetakt</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">År</th>
                      <th className="px-3 py-1.5 text-right font-medium text-blue-400">Meg</th>
                      {partnerEnabled && <th className="px-3 py-1.5 text-right font-medium text-purple-400">Partner</th>}
                      <th className="px-3 py-1.5 text-right font-medium">Samlet EK</th>
                      <th className="px-3 py-1.5 text-right font-medium text-yellow-400">Rente/avk.</th>
                      {combinedIncome > 0 && <th className="px-3 py-1.5 text-right font-medium text-green-400">Max kjøpesum</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {yearRows.map((y, i) => {
                      const isGoalYear = reachEntry && y.months >= reachEntry.months &&
                        (i === 0 || yearRows[i - 1].months < reachEntry.months)
                      return (
                        <tr key={y.year} className={cn(
                          'border-b border-border last:border-0',
                          isGoalYear && 'bg-green-500/6',
                          i === 0 && 'bg-primary/3'
                        )}>
                          <td className="px-3 py-2 font-semibold">
                            {y.year}
                            {i === 0 && <span className="ml-1.5 text-[9px] text-muted-foreground">i år</span>}
                            {isGoalYear && <span className="ml-1.5 text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">mål</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-blue-400">{fmtM(y.meEK ?? 0)}</td>
                          {partnerEnabled && <td className="px-3 py-2 text-right font-mono text-purple-400">{fmtM(y.partnerEK ?? 0)}</td>}
                          <td className="px-3 py-2 text-right font-mono font-bold">{fmtM(y.combined ?? 0)}</td>
                          <td className="px-3 py-2 text-right font-mono text-yellow-400">+{fmtM(y.totalInterest ?? 0)}</td>
                          {combinedIncome > 0 && <td className="px-3 py-2 text-right font-mono font-bold text-green-400">{fmtM(y.maxPurchase ?? 0)}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KONTOER TAB ── */}
      {subTab === 'kontoer' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Meg totalt', value: fmtNOK(meTotalBalance), sub: `${fmtNOK(meTotalMonthly)}/mnd`, color: 'text-blue-400' },
              { label: 'Partner totalt', value: fmtNOK(partnerTotalBalance), sub: `${fmtNOK(partnerTotalMonthly)}/mnd`, color: 'text-purple-400', hidden: !partnerEnabled },
              { label: 'Samlet EK', value: fmtNOK(combinedTotal), sub: `${fmtNOK(totalMonthly)}/mnd` },
              { label: 'Budsjettert sparing', value: fmtNOK(budgetTotalSavings), sub: budgetTotalSavings !== totalMonthly ? `sim. bruker ${fmtNOK(totalMonthly)}/mnd` : 'matcher simulering', color: budgetTotalSavings > 0 && budgetTotalSavings !== totalMonthly ? 'text-amber-400' : 'text-green-400' },
            ].filter((k) => !k.hidden).map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                <p className={cn('text-base font-bold font-mono', k.color ?? 'text-foreground')}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/20">
              <span className="text-xs font-semibold">Kontoer</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Klikk tall for å redigere</span>
                {onNavigateToAccounts && (
                  <button onClick={onNavigateToAccounts} className="text-[10px] text-primary hover:underline">
                    Administrer kontoer →
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {['Konto', 'Saldo', 'Mnd. innskudd', 'Rente / Avkastning', 'Årets innskudd', '12 mnd prognose'].map((h, i) => (
                      <th key={h} className={cn('px-3 py-1.5 font-medium text-muted-foreground', i > 0 && 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Meg</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{fmtNOK(meTotalBalance)} · {fmtNOK(meTotalMonthly)}/mnd</span>
                      </div>
                    </td>
                  </tr>
                  {myRows.map((row) => (
                    <AccountTableRow
                      key={row.id}
                      row={row}
                      proj12={projectBalanceMonthly(row.balance, row.monthly,
                        row.type === 'fond' || row.type === 'krypto' ? row.expectedReturn : row.rate,
                        12, row.type === 'BSU')}
                      onChangeMonthly={(v) => handleAccountChange(row, 'monthly', v)}
                      onChangeExpectedReturn={(v) => handleAccountChange(row, 'expectedReturn', v)}
                      onChangeActualReturn={(v) => handleAccountChange(row, 'actualReturn', v)}
                      sparkData={sparklineForRow(row)}
                    />
                  ))}

                  {partnerEnabled && (
                    <>
                      <tr className="bg-muted/20">
                        <td colSpan={6} className="px-3 py-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-400" />
                              <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Partner</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">{fmtNOK(partnerTotalBalance)} · {fmtNOK(partnerTotalMonthly)}/mnd</span>
                          </div>
                        </td>
                      </tr>
                      {partnerRows.map((row) => (
                        <AccountTableRow
                          key={row.id}
                          row={row}
                          proj12={projectBalanceMonthly(row.balance, row.monthly, row.expectedReturn, 12, row.type === 'BSU')}
                          onChangeMonthly={(v) => handlePartnerChange(row.id, 'monthly', v)}
                          onChangeExpectedReturn={(v) => handlePartnerChange(row.id, 'expectedReturn', v)}
                          onChangeActualReturn={() => {}}
                          sparkData={sparklineForRow(row)}
                        />
                      ))}
                    </>
                  )}

                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="px-3 py-2 font-bold">Totalt</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmtNOK(combinedTotal)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmtNOK(totalMonthly)}/mnd</td>
                    <td />
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {fmtNOK(allRows.reduce((s, a) => s + a.ytd, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-green-400">
                      {fmtNOK(simData[12]?.combined ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Planlagte innskudd */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <span className="text-xs font-semibold">Planlagte innskudd</span>
                <span className="text-[10px] text-muted-foreground ml-2">Ulike beløp til ulike tidspunkter (kun egne kontoer)</span>
              </div>
            </div>
            <div className="p-3 space-y-3">
              {/* Eksisterende trinn */}
              {myRows.some((r) => (contributionSteps[r.id] ?? []).length > 0) ? (
                <div className="space-y-1.5">
                  {myRows.flatMap((row) =>
                    (contributionSteps[row.id] ?? []).map((step) => (
                      <div key={`${row.id}-${step.fromMonth}`} className="flex items-center gap-2 text-xs bg-muted/20 rounded-lg px-3 py-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="flex-1 font-medium">{row.label}</span>
                        <span className="text-muted-foreground">fra mnd {step.fromMonth}:</span>
                        <span className="font-mono text-foreground">{fmtNOK(step.monthly)}/mnd</span>
                        <button
                          onClick={() => removeContribStep(row.id, step.fromMonth)}
                          className="text-muted-foreground hover:text-red-400 transition-colors ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">Ingen planlagte innskudd lagt til ennå.</p>
              )}

              {/* Legg til nytt trinn */}
              {stepForm !== null ? (
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <p className="text-xs font-medium">Nytt planlagt innskudd</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Konto</label>
                      <select
                        value={stepForm.accountId}
                        onChange={(e) => setStepForm((f) => f && { ...f, accountId: e.target.value })}
                        className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                      >
                        {myRows.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Fra måned nr.</label>
                      <input
                        type="number" min={1} step={1}
                        value={stepForm.fromMonth || ''}
                        onChange={(e) => setStepForm((f) => f && { ...f, fromMonth: parseInt(e.target.value) || 0 })}
                        className="h-7 w-full rounded border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary"
                        placeholder="f.eks. 6"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Beløp/mnd (kr)</label>
                      <input
                        type="number" min={0} step={500}
                        value={stepForm.monthly || ''}
                        onChange={(e) => setStepForm((f) => f && { ...f, monthly: parseFloat(e.target.value) || 0 })}
                        className="h-7 w-full rounded border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary"
                        placeholder="f.eks. 5000"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => setStepForm(null)}
                      className="px-3 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >Avbryt</button>
                    <button
                      onClick={() => {
                        if (stepForm.accountId && stepForm.fromMonth > 0) {
                          addContribStep(stepForm.accountId, stepForm.fromMonth, stepForm.monthly)
                          setStepForm(null)
                        }
                      }}
                      disabled={!stepForm.accountId || stepForm.fromMonth <= 0}
                      className="px-3 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >Legg til</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setStepForm({ accountId: myRows[0]?.id ?? '', fromMonth: 0, monthly: 0 })}
                  disabled={myRows.length === 0}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Legg til planlagt innskudd
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FEEDBACK TAB ── */}
      {subTab === 'feedback' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 className="text-sm font-semibold">Råd & varsler</h3>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <InsightCard key={i} icon={ins.icon} text={ins.text} color={ins.color} />
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3 mt-2">
            <p className="text-xs font-semibold">🔗 Sammenheng med resten av verktøyet</p>
            {[
              { icon: '📊', label: 'Budsjett', value: `${fmtNOK(totalMonthly)} går til sparing` },
              { icon: '💰', label: 'Inntekt', value: `${combinedIncome > 0 ? ((totalMonthly / combinedIncome) * 100).toFixed(0) : 0} % av samlet inntekt` },
              { icon: '🧾', label: 'BSU skattefradrag', value: (() => {
                const bsu = savingsAccounts.find((a) => a.type === 'BSU')
                if (!bsu) return 'Ingen BSU registrert'
                return `Estimert ${fmtNOK(Math.min(bsu.monthlyContribution * 12, BSU_MAX_YEARLY) * 0.1)} refundert`
              })() },
              { icon: '⚖️', label: 'Gjeld', value: userDebt > 0 ? `${fmtNOK(userDebt)} total gjeld` : 'Ingen gjeld registrert' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-base">{row.icon}</span>
                <div>
                  <p className="text-xs font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold">📋 Sparewizard</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Steg-for-steg gjennomgang: koble kontoer mot budsjett, sett BSU-kvote,
              velg fondstrategi, og beregn optimalt oppsett.
            </p>
            <Button size="sm" onClick={() => setShowWizard(true)}>Start wizard</Button>
          </div>
        </div>
      )}

      {showWizard && (
        <SavingsPlanWizard
          accounts={savingsAccounts}
          onClose={() => setShowWizard(false)}
          onUpdateAccount={(id, patch) => updateSavingsAccount(id, patch)}
          onSetTarget={setSavingsPlanTarget}
          currentTarget={targetPrice}
        />
      )}
    </div>
  )
}

// ─── Kontotabell-rad ──────────────────────────────────────────
function AccountTableRow({
  row, proj12, onChangeMonthly, onChangeExpectedReturn, onChangeActualReturn, sparkData,
}: {
  row: AccountRow
  proj12: number
  onChangeMonthly: (v: number) => void
  onChangeExpectedReturn: (v: number) => void
  onChangeActualReturn: (v: number) => void
  sparkData: number[]
}) {
  const isFond = row.type === 'fond' || row.type === 'krypto'
  const isBSU = row.type === 'BSU'
  const color = row.person === 'meg' ? '#60a5fa' : '#a78bfa'
  return (
    <tr className="border-b border-border/60 hover:bg-muted/10 transition-colors">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
          <div>
            <p className="font-medium">{row.label}</p>
            <p className="text-[10px] text-muted-foreground">{row.accountNumber ?? row.type}</p>
          </div>
          <div className="w-16 opacity-60">
            <Sparkline data={sparkData} color={color} height={24} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono" style={{ color }}>
        {fmtNOK(row.balance)}
      </td>
      <td className="px-3 py-2 text-right">
        {isBSU ? (
          <div className="flex flex-col items-end gap-0.5">
            <InlineCell value={Math.round(row.monthly * 12)} onChange={(v) => onChangeMonthly(v / 12)} suffix=" kr/år" step={1000} />
            <span className="text-[10px] text-muted-foreground font-mono">{fmtNOK(row.monthly)}/mnd</span>
          </div>
        ) : (
          <InlineCell value={row.monthly} onChange={onChangeMonthly} suffix="/mnd" step={100} />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {isFond ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">Forv.</span>
              <InlineCell value={row.expectedReturn} onChange={onChangeExpectedReturn} suffix=" %" step={0.5} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">Faktisk</span>
              <InlineCell value={row.actualReturn ?? 0} onChange={onChangeActualReturn} suffix=" %" step={0.5} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <InlineCell value={row.expectedReturn} onChange={onChangeExpectedReturn} suffix=" %" step={0.1} />
            <span className="text-[10px] text-muted-foreground">nå: {row.rate.toFixed(2)} %</span>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtNOK(row.ytd)}</td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtNOK(proj12)}</td>
    </tr>
  )
}

// ─── SparePlan SVG Chart ──────────────────────────────────────
function SparePlanChart({
  data, tab, requiredEK, partnerEnabled,
}: {
  data: { label: string; meEK: number; combined: number; meContrib: number; partnerContrib: number; totalInterest: number }[]
  tab: 'vekst' | 'bidrag' | 'avkastning'
  requiredEK: number
  partnerEnabled: boolean
}) {
  const H = 200, W = 560
  const PAD = { t: 10, r: 10, b: 28, l: 54 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b
  const [tip, setTip] = useState<{ i: number } | null>(null)

  const lines = tab === 'vekst' ? [
    { key: 'meEK', color: '#60a5fa', label: 'Meg', w: 1.5 },
    ...(partnerEnabled ? [{ key: 'combined', color: '#34d399', label: 'Samlet', w: 2 }] : []),
  ] : tab === 'bidrag' ? [
    { key: 'meContrib', color: '#60a5fa', label: 'Meg', w: 2 },
    ...(partnerEnabled ? [{ key: 'partnerContrib', color: '#a78bfa', label: 'Partner', w: 2 }] : []),
  ] : [
    { key: 'totalInterest', color: '#fbbf24', label: 'Rente/avk.', w: 2 },
  ]

  type EnrichedRow = typeof data[0] & { [key: string]: unknown }
  const enriched: EnrichedRow[] = data.map((d) => ({ ...d }))

  const allVals = lines.flatMap((l) => enriched.map((d) => (d[l.key] as number) ?? 0))
  const maxV = Math.max(...allVals, requiredEK || 0) * 1.08 || 1
  const n = enriched.length

  function sx(i: number) { return (i / (n - 1)) * cW }
  function sy(v: number) { return cH - (v / maxV) * cH }

  const yTicks = Array.from({ length: 5 }, (_, i) => (maxV * (i + 1)) / 5)
  const xStep = Math.ceil(n / 7)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} onMouseLeave={() => setTip(null)}>
      <g transform={`translate(${PAD.l},${PAD.t})`}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={0} y1={sy(v)} x2={cW} y2={sy(v)} stroke="hsl(217,32%,14%)" strokeDasharray="3,3" />
            <text x={-5} y={sy(v) + 4} textAnchor="end" fontSize={9} fill="hsl(215,20%,55%)">{fmtM(v)}</text>
          </g>
        ))}
        {enriched.filter((_, i) => i % xStep === 0 || i === n - 1).map((d, ii) => {
          const i = enriched.indexOf(d)
          return <text key={ii} x={sx(i)} y={cH + 16} textAnchor="middle" fontSize={9} fill="hsl(215,20%,55%)">{d.label}</text>
        })}

        {requiredEK > 0 && requiredEK < maxV && (
          <>
            <line x1={0} y1={sy(requiredEK)} x2={cW} y2={sy(requiredEK)} stroke="#22c55e" strokeDasharray="5,3" strokeWidth={1.5} />
            <text x={cW - 2} y={sy(requiredEK) - 4} textAnchor="end" fontSize={9} fill="#22c55e">EK-mål</text>
          </>
        )}

        {lines.map((l) => {
          const pts = enriched.map((d, i) => `${sx(i)},${sy((d[l.key] as number) ?? 0)}`).join(' ')
          const areaPath = `M0,${cH} L${enriched.map((d, i) => `${sx(i)},${sy((d[l.key] as number) ?? 0)}`).join(' L')} L${cW},${cH} Z`
          return (
            <g key={l.key}>
              {!('dashed' in l) && <path d={areaPath} fill={l.color} opacity={0.1} />}
              <polyline points={pts} fill="none" stroke={l.color} strokeWidth={l.w}
                strokeDasharray={'dashed' in l && l.dashed ? '5,3' : undefined} />
            </g>
          )
        })}

        {enriched.map((_, i) => (
          <rect key={i} x={sx(i) - cW / n / 2} y={0} width={cW / n} height={cH}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setTip({ i })} />
        ))}
        {tip && (() => {
          const d = enriched[tip.i]
          const tx = Math.min(sx(tip.i) + 6, cW - 120)
          return (
            <g>
              <line x1={sx(tip.i)} y1={0} x2={sx(tip.i)} y2={cH} stroke="hsl(217,32%,40%)" />
              <rect x={tx} y={4} width={120} height={14 + lines.length * 14} rx={4}
                fill="hsl(240,6%,8%)" stroke="hsl(217,32%,18%)" />
              <text x={tx + 8} y={16} fontSize={9} fill="hsl(215,20%,65%)">{d.label}</text>
              {lines.map((l, li) => (
                <text key={l.key} x={tx + 8} y={16 + 14 * (li + 1)} fontSize={10} fill={l.color}>
                  {l.label}: {fmtNOK((d[l.key] as number) ?? 0)}
                </text>
              ))}
            </g>
          )
        })()}
      </g>
    </svg>
  )
}

// ─── Sparewizard ──────────────────────────────────────────────
function SavingsPlanWizard({
  accounts, onClose, onUpdateAccount, onSetTarget, currentTarget,
}: {
  accounts: SavingsAccount[]
  onClose: () => void
  onUpdateAccount: (id: string, patch: Partial<SavingsAccount>) => void
  onSetTarget: (price: number) => void
  currentTarget: number
}) {
  const [step, setStep] = useState(0)
  const steps = ['BSU-optimering', 'Fondstrategi', 'Buffer', 'Boligmål']
  const bsu = accounts.find((a) => a.type === 'BSU')
  const fond = accounts.find((a) => a.type === 'fond')
  const buffer = accounts.find((a) => a.type === 'sparekonto')
  const [bsuMonthly, setBsuMonthly] = useState(bsu?.monthlyContribution ?? 0)
  const [fondReturn, setFondReturn] = useState(fond?.expectedReturn ?? 6)
  const [bufferTarget, setBufferTarget] = useState(buffer?.monthlyContribution ?? 0)
  const [targetInput, setTargetInput] = useState(String(currentTarget || ''))

  function finish() {
    if (bsu) onUpdateAccount(bsu.id, { monthlyContribution: bsuMonthly })
    if (fond) onUpdateAccount(fond.id, { expectedReturn: fondReturn })
    if (buffer) onUpdateAccount(buffer.id, { monthlyContribution: bufferTarget })
    onSetTarget(parseFloat(targetInput) || 0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-sm">Sparewizard</h3>
            <p className="text-xs text-muted-foreground">Steg {step + 1} av {steps.length}: {steps[step]}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 px-5 py-3">
          {steps.map((s, i) => (
            <div key={s} className={cn('h-1 flex-1 rounded-full transition-all',
              i < step ? 'bg-green-500' : i === step ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>

        <div className="px-5 py-4 space-y-4 min-h-40">
          {step === 0 && (
            <>
              <p className="text-sm font-medium">BSU-optimering</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Du kan sette inn opptil <b>27 500 kr/år</b> på BSU og få <b>10 % skattefradrag</b>.
                Anbefalt månedlig innskudd: {fmtNOK(Math.round(27500 / 12))}.
              </p>
              {bsu ? (
                <div className="space-y-1">
                  <Label className="text-xs">Månedlig BSU-innskudd</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" step={100} value={bsuMonthly}
                      onChange={(e) => setBsuMonthly(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs w-32" />
                    <span className="text-xs text-muted-foreground">
                      → skattefradrag: <span className="text-green-400 font-mono">{fmtNOK(Math.min(bsuMonthly * 12, 27500) * 0.1)}/år</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400">Ingen BSU-konto registrert. Legg til i «Kontoer».</p>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <p className="text-sm font-medium">Fondstrategi</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sett forventet gjennomsnittlig avkastning for simulering. Norsk historisk børssnitt er ca. 8–10 %, globalt ca. 6–8 %.
              </p>
              {fond ? (
                <div className="space-y-1">
                  <Label className="text-xs">Forventet avkastning</Label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={2} max={14} step={0.5} value={fondReturn}
                      onChange={(e) => setFondReturn(parseFloat(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="font-mono text-sm w-12 text-right">{fondReturn.toFixed(1)} %</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Konservativ (2 %)</span><span>Historisk snitt (8 %)</span><span>Aggressiv (14 %)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400">Ingen fondkonto registrert. Legg til i «Kontoer».</p>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm font-medium">Buffer-konto</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Anbefalt buffer er 3–6 måneders faste utgifter. Sett månedlig innskudd til bufferkontoen.
              </p>
              {buffer ? (
                <div className="space-y-1">
                  <Label className="text-xs">Månedlig innskudd buffer</Label>
                  <Input type="number" step={100} value={bufferTarget}
                    onChange={(e) => setBufferTarget(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs w-32" />
                </div>
              ) : (
                <p className="text-xs text-amber-400">Ingen sparekonto registrert.</p>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <p className="text-sm font-medium">Boligmål</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sett ønsket boligpris. Simulatoren beregner når dere har nok egenkapital.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Ønsket boligpris</Label>
                <Input type="number" step={50000} placeholder="f.eks. 4 500 000"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="h-8 text-xs" />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}>
            Forrige
          </Button>
          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>Neste</Button>
          ) : (
            <Button size="sm" className="bg-green-600 hover:bg-green-500" onClick={finish}>
              <Check className="h-3.5 w-3.5 mr-1" /> Ferdig
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// ACCOUNT CARD
// ------------------------------------------------------------

type AccountTab = 'innskudd' | 'uttak' | 'saldo' | 'rente'

function AccountCard({
  account,
  now,
  onRemove,
  onUpdate,
  onUpdateBalance,
  onUpdateRate,
  onAddContribution,
  onRemoveContribution,
  onAddWithdrawal,
  onRemoveWithdrawal,
  onUpdateBirthYear,
  onUpdateMonthlyContribution,
}: {
  account: SavingsAccount
  now: Date
  onRemove: () => void
  onUpdate: (patch: Partial<SavingsAccount>) => void
  onUpdateBalance: (e: BalanceHistoryEntry) => void
  onUpdateRate: (e: RateHistoryEntry) => void
  onAddContribution: (c: SavingsContribution) => void
  onRemoveContribution: (id: string) => void
  onAddWithdrawal: (w: WithdrawalEntry) => void
  onRemoveWithdrawal: (id: string) => void
  onUpdateBirthYear: (year: number) => void
  onUpdateMonthlyContribution: (amount: number) => void
}) {
  const [activeTab, setActiveTab] = useState<AccountTab | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [editingAccount, setEditingAccount] = useState(false)
  const [editingMonthlySaving, setEditingMonthlySaving] = useState(false)
  const [monthlySavingInput, setMonthlySavingInput] = useState('')
  const [bsuPickYear, setBsuPickYear] = useState<string>(String(now.getFullYear() + 2))
  const [bsuPickMonth, setBsuPickMonth] = useState<number>(now.getMonth() + 1)
  const [bsuPostRate, setBsuPostRate] = useState(3.0)
  const [editingBirthYear, setEditingBirthYear] = useState(false)
  const [birthYearInput, setBirthYearInput] = useState('')

  const currentYear = now.getFullYear()
  const currentBalance = computeEffectiveBalance(account, now)
  const sortedRates = [...account.rateHistory].sort((a, b) => b.fromDate.localeCompare(a.fromDate))
  const currentRate = sortedRates[0]?.rate ?? 0
  const isBSU = account.type === 'BSU'
  const bsuStatus = isBSU ? checkBSULimits(account, currentYear) : null
  const monthlyEstimate = computeMonthlyContributionEstimate(account)
  const ytdContribs = computeYTDContributions(account, currentYear)
  const bsuForecast = (isBSU && account.birthYear)
    ? computeBSUForecast(account, account.birthYear, currentBalance, bsuPostRate)
    : null
  const bsuMaxForecast = (isBSU && account.birthYear)
    ? computeBSUForecast(account, account.birthYear, currentBalance, bsuPostRate, BSU_MAX_YEARLY / 12)
    : null
  const interestIncome = (account.type !== 'fond' && account.type !== 'krypto')
    ? computeYearlyInterestIncome(account, currentYear)
    : 0
  const interestForecast = (account.type !== 'fond' && account.type !== 'krypto')
    ? computeYearlyInterestIncome(account, currentYear, true)
    : 0

  // Prognose: neste 24 måneder
  const projections = projectSavingsGrowth(account, {
    year: now.getFullYear() + 1,
    month: now.getMonth() + 1,
  })
  const chartData = projections.slice(0, 24).map((bal, i) => ({ month: i + 1, saldo: bal }))

  // Contributions sorted newest first
  const sortedContribs = [...(account.contributions ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const sortedWithdrawals = [...(account.withdrawals ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  function handleTabClick(tab: AccountTab) {
    setActiveTab((v) => (v === tab ? null : tab))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{account.label}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]}
              {account.accountNumber && ` · ${account.accountNumber}`}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditingAccount(v => !v)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editingAccount && (
          <EditAccountForm
            account={account}
            onSave={(patch) => { onUpdate(patch); setEditingAccount(false) }}
            onCancel={() => setEditingAccount(false)}
          />
        )}
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <MiniStat label="Saldo" value={fmtNOK(currentBalance)} highlight />
          <MiniStat
            label="Rentesats"
            value={`${currentRate.toFixed(2)} %`}
            subvalue={isBSU ? 'krediteres 31. des' : 'månedlig kreditering'}
          />
          <MiniStat label="Årets innskudd" value={fmtNOK(ytdContribs || 0)} />
          {interestForecast > 0 ? (
            <MiniStat
              label={`Renteinntekter ${currentYear}`}
              value={fmtNOK(interestForecast)}
              subvalue={
                isBSU
                  ? `${fmtNOK(interestIncome)} opptjent hittil`
                  : interestIncome < interestForecast
                    ? `${fmtNOK(interestIncome)} kreditert hittil`
                    : 'prognose hele året'
              }
            />
          ) : (
            <MiniStat
              label="Est. månedsspar"
              value={fmtNOK(monthlyEstimate)}
              subvalue={ytdContribs > 0 ? 'snitt siste 12 mnd' : 'planlagt bidrag'}
            />
          )}
        </div>

        {/* Fast sparebeløp med periode */}
        <div className="border-t border-border/30 pt-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Repeat2 className="h-3 w-3" />
              <span>Fast sparebeløp/mnd</span>
            </div>
            {!editingMonthlySaving && (
              <button
                className="flex items-center gap-1.5 hover:text-foreground text-muted-foreground transition-colors group"
                onClick={() => {
                  setMonthlySavingInput(String(Math.round(account.monthlyContribution) || ''))
                  setEditingMonthlySaving(true)
                }}
              >
                <span className={account.monthlyContribution > 0 ? 'text-foreground font-mono' : 'italic'}>
                  {account.monthlyContribution > 0
                    ? `${account.monthlyContribution.toLocaleString('no-NO', { maximumFractionDigits: 0 })} kr`
                    : 'Ikke satt'}
                </span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )}
          </div>

          {/* Periode-visning (når ikke redigerer) */}
          {!editingMonthlySaving && (account.monthlyContributionFromDate || account.monthlyContributionToDate) && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-4">
              <span>
                {account.monthlyContributionFromDate
                  ? `Fra ${new Date(account.monthlyContributionFromDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}`
                  : 'Alltid'}
                {account.monthlyContributionToDate
                  ? ` → ${new Date(account.monthlyContributionToDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}`
                  : ' → ingen sluttdato'}
              </span>
            </div>
          )}

          {/* Redigering */}
          {editingMonthlySaving && (
            <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Rediger fast spareplan</p>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Beløp per måned (kr)</label>
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step={100}
                  placeholder="f.eks. 2292"
                  className="h-7 w-full rounded border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary"
                  value={monthlySavingInput}
                  onChange={(e) => setMonthlySavingInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingMonthlySaving(false) }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Fra dato (valgfri)</label>
                  <input
                    type="month"
                    className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                    value={account.monthlyContributionFromDate?.slice(0, 7) ?? ''}
                    onChange={(e) => onUpdate({ monthlyContributionFromDate: e.target.value ? `${e.target.value}-01` : undefined })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Til dato (valgfri)</label>
                  <input
                    type="month"
                    className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                    value={account.monthlyContributionToDate?.slice(0, 7) ?? ''}
                    onChange={(e) => onUpdate({ monthlyContributionToDate: e.target.value ? `${e.target.value}-01` : undefined })}
                  />
                </div>
              </div>
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setEditingMonthlySaving(false)}
                  className="px-3 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground transition-colors"
                >Avbryt</button>
                <button
                  onClick={() => {
                    onUpdateMonthlyContribution(parseFloat(monthlySavingInput) || 0)
                    setEditingMonthlySaving(false)
                  }}
                  className="px-3 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >Lagre</button>
              </div>
            </div>
          )}
        </div>

        {/* Rentehistorikk */}
        {sortedRates.length > 1 && (
          <div className="rounded-md border border-border/50 overflow-hidden">
            <div className="bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground">Rentehistorikk</div>
            {sortedRates.map((r, i) => (
              <div key={r.fromDate} className="flex items-center justify-between px-3 py-1.5 text-xs border-t border-border/30">
                <span className="text-muted-foreground">Fra {fmtDate(r.fromDate)}</span>
                <span className={i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {r.rate.toFixed(2)} %
                </span>
              </div>
            ))}
          </div>
        )}

        {/* BSU-spesifikk */}
        {bsuStatus && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>BSU-kvote {currentYear}</span>
              <span>{fmtNOK(bsuStatus.yearlyContributionSoFar)} / 27 500 kr</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total BSU-tak</span>
              <span>{fmtNOK(currentBalance)} / 300 000 kr</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Skattefradrag {currentYear}: <span className="text-green-500 font-medium">{fmtNOK(Math.round(Math.min(bsuStatus.yearlyContributionSoFar, 27500) * 0.1))}</span>
              </span>
            </div>
            {bsuStatus.warning && (
              <p className="text-xs text-yellow-400">{bsuStatus.warning}</p>
            )}

            {/* BSU aldersprognose */}
            {bsuForecast && (() => {
              const pickY = parseInt(bsuPickYear)
              const validPickY = pickY && pickY >= currentYear && pickY <= 2060 ? pickY : null
              const displayYear = validPickY ?? bsuForecast.cutoffYear
              const displayMonth = bsuPickMonth // 1–12

              // Lineær interpolasjon mellom år-slutt verdier for månedlig prognose
              function interpolate(atYear: (y: number) => number, year: number, month: number) {
                const prev = year === currentYear ? currentBalance : atYear(year - 1)
                const next = atYear(year)
                return Math.round(prev + (next - prev) * (month / 12))
              }

              const balance = interpolate(bsuForecast.balanceAtYear, displayYear, displayMonth)
              const contribs = interpolate(bsuForecast.contributionsAtYear, displayYear, displayMonth)
              const interest = interpolate(bsuForecast.interestAtYear, displayYear, displayMonth)
              const maxBalance = interpolate(bsuMaxForecast!.balanceAtYear, displayYear, displayMonth)
              const maxContribs = interpolate(bsuMaxForecast!.contributionsAtYear, displayYear, displayMonth)
              const maxInterest = interpolate(bsuMaxForecast!.interestAtYear, displayYear, displayMonth)

              const MONTH_NAMES_NO = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
              return (
                <div className="rounded-md border border-border/50 mt-2 overflow-hidden">
                  <div className="bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>BSU-prognose</span>
                    <div className="flex items-center gap-1.5 text-muted-foreground font-normal">
                      <span>Sparerente etter {bsuForecast.rateDropYear}:</span>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={10}
                        className="h-5 w-12 text-xs rounded border border-border/60 bg-background px-1.5"
                        value={bsuPostRate}
                        onChange={(e) => setBsuPostRate(parseFloat(e.target.value) || 0)}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left px-3 py-1.5 font-normal text-muted-foreground w-1/2">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span>Per</span>
                            <select
                              className="h-5 text-xs rounded border border-border bg-background px-1 font-normal text-foreground"
                              value={bsuPickMonth}
                              onChange={(e) => setBsuPickMonth(parseInt(e.target.value))}
                            >
                              {MONTH_NAMES_NO.map((mn, i) => (
                                <option key={i + 1} value={i + 1}>{mn}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={currentYear}
                              max={2060}
                              className="h-5 w-14 rounded border border-border bg-background px-1.5 font-normal text-foreground text-xs"
                              value={bsuPickYear}
                              onChange={(e) => setBsuPickYear(e.target.value)}
                            />
                          </div>
                        </th>
                        <th className="text-right px-3 py-1.5 font-normal text-muted-foreground">Ditt tempo</th>
                        <th className="text-right px-3 py-1.5 font-normal text-muted-foreground">Maks (27 500/år)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-1 text-muted-foreground">Innskudd</td>
                        <td className="px-3 py-1 text-right">+ {fmtNOK(contribs)}</td>
                        <td className="px-3 py-1 text-right text-muted-foreground">+ {fmtNOK(maxContribs)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1 text-muted-foreground">
                          Renter
                          {displayYear >= bsuForecast.rateDropYear && (
                            <span className="ml-1 text-yellow-500/80">(inkl. lavere sats fra {bsuForecast.rateDropYear})</span>
                          )}
                        </td>
                        <td className="px-3 py-1 text-right text-green-500">+ {fmtNOK(interest)}</td>
                        <td className="px-3 py-1 text-right text-green-500/70">+ {fmtNOK(maxInterest)}</td>
                      </tr>
                      <tr className="border-t border-border/30 font-medium">
                        <td className="px-3 py-1.5">Saldo ved {displayYear}</td>
                        <td className="px-3 py-1.5 text-right">{fmtNOK(balance)}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtNOK(maxBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })()}
            {!account.birthYear && !editingBirthYear && (
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 text-left hover:text-foreground"
                onClick={() => setEditingBirthYear(true)}
              >
                + Legg til fødselsår for BSU-aldersprognose
              </button>
            )}
            {!account.birthYear && editingBirthYear && (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  placeholder="f.eks. 1995"
                  className="h-7 w-24 text-xs rounded border border-border bg-background px-2"
                  value={birthYearInput}
                  onChange={(e) => setBirthYearInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const y = parseInt(birthYearInput)
                      if (y > 1900 && y < 2100) { onUpdateBirthYear(y); setEditingBirthYear(false) }
                    }
                    if (e.key === 'Escape') setEditingBirthYear(false)
                  }}
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  const y = parseInt(birthYearInput)
                  if (y > 1900 && y < 2100) { onUpdateBirthYear(y); setEditingBirthYear(false) }
                }}>OK</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingBirthYear(false)}>×</Button>
              </div>
            )}
          </div>
        )}

        {/* Mini-chart */}
        {chartData.length > 1 && (
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip formatter={(v) => [fmtNOK(Number(v)), 'Saldo']} labelFormatter={(l) => `Mnd ${l}`} />
              <Area
                type="monotone"
                dataKey="saldo"
                stroke="#22C55E"
                fill="#22C55E20"
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Action tabs */}
        <div className="flex gap-2">
          {(['innskudd', 'uttak', 'saldo', 'rente'] as AccountTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              size="sm"
              className="text-xs capitalize"
              onClick={() => handleTabClick(tab)}
            >
              {tab === 'innskudd' ? 'Legg til innskudd' :
               tab === 'uttak' ? 'Registrer uttak' :
               tab === 'saldo' ? 'Oppdater saldo' : 'Ny rentesats'}
            </Button>
          ))}
        </div>

        {activeTab === 'innskudd' && (
          <AddContributionForm
            onSave={(c) => { onAddContribution(c); setActiveTab(null) }}
            onCancel={() => setActiveTab(null)}
          />
        )}
        {activeTab === 'uttak' && (
          <AddWithdrawalForm
            onSave={(w) => { onAddWithdrawal(w); setActiveTab(null) }}
            onCancel={() => setActiveTab(null)}
          />
        )}
        {activeTab === 'saldo' && (
          <UpdateBalanceForm
            onSave={(e) => { onUpdateBalance(e); setActiveTab(null) }}
            onCancel={() => setActiveTab(null)}
          />
        )}
        {activeTab === 'rente' && (
          <UpdateRateForm
            onSave={(e) => { onUpdateRate(e); setActiveTab(null) }}
            onCancel={() => setActiveTab(null)}
          />
        )}

        {/* Transaction log toggle */}
        {(sortedContribs.length > 0 || sortedWithdrawals.length > 0 || account.monthlyContribution > 0) && (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowLog((v) => !v)}
          >
            {showLog ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showLog ? 'Skjul' : 'Vis'} transaksjonslogg
            ({sortedContribs.length + sortedWithdrawals.length})
          </button>
        )}

        {showLog && (
          <TransactionLog
            contributions={sortedContribs}
            withdrawals={sortedWithdrawals}
            monthlyContribution={account.monthlyContribution}
            onRemoveContribution={onRemoveContribution}
            onRemoveWithdrawal={onRemoveWithdrawal}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------
// TRANSACTION LOG
// ------------------------------------------------------------

function TransactionLog({
  contributions,
  withdrawals,
  monthlyContribution,
  onRemoveContribution,
  onRemoveWithdrawal,
}: {
  contributions: SavingsContribution[]
  withdrawals: WithdrawalEntry[]
  monthlyContribution: number
  onRemoveContribution: (id: string) => void
  onRemoveWithdrawal: (id: string) => void
}) {
  // Merge and sort all entries newest first
  type Entry =
    | { kind: 'contribution'; data: SavingsContribution }
    | { kind: 'withdrawal'; data: WithdrawalEntry }

  const entries: Entry[] = [
    ...contributions.map((c) => ({ kind: 'contribution' as const, data: c })),
    ...withdrawals.map((w) => ({ kind: 'withdrawal' as const, data: w })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  return (
    <div className="rounded-md border border-border overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-2 py-1 text-left font-medium text-muted-foreground">Dato</th>
            <th className="px-2 py-1 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-2 py-1 text-right font-medium text-muted-foreground">Beløp</th>
            <th className="px-2 py-1 text-left font-medium text-muted-foreground">Notat</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {monthlyContribution > 0 && (
            <tr className="border-b border-border/50 bg-muted/10">
              <td className="px-2 py-1 text-muted-foreground italic">Månedlig</td>
              <td className="px-2 py-1">
                <span className="flex items-center gap-1 text-blue-400">
                  <Repeat2 className="h-3 w-3" />
                  Fast bidrag
                </span>
              </td>
              <td className="px-2 py-1 text-right font-mono text-blue-400">
                +{monthlyContribution.toLocaleString('no-NO')} kr
              </td>
              <td className="px-2 py-1 text-muted-foreground text-[10px]">Planlagt · vises i budsjett</td>
              <td />
            </tr>
          )}
          {entries.map((entry) => {
            const isContrib = entry.kind === 'contribution'
            const amount = isContrib ? entry.data.amount : entry.data.amount
            return (
              <tr key={entry.data.id} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1 text-muted-foreground">{fmtDate(entry.data.date)}</td>
                <td className="px-2 py-1">
                  <span className={isContrib ? 'text-green-500' : 'text-red-400'}>
                    {isContrib ? 'Innskudd' : 'Uttak'}
                  </span>
                </td>
                <td className={`px-2 py-1 text-right font-mono ${isContrib ? 'text-green-500' : 'text-red-400'}`}>
                  {isContrib ? '+' : ''}{fmtNOK(amount)}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{entry.data.note ?? ''}</td>
                <td className="px-1 py-1">
                  <button
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                    onClick={() =>
                      isContrib
                        ? onRemoveContribution(entry.data.id)
                        : onRemoveWithdrawal(entry.data.id)
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------
// FORMS
// ------------------------------------------------------------

function MiniStat({
  label,
  value,
  highlight,
  subvalue,
}: {
  label: string
  value: string
  highlight?: boolean
  subvalue?: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono font-medium text-sm ${highlight ? 'text-green-500' : ''}`}>{value}</p>
      {subvalue && <p className="text-xs text-muted-foreground">{subvalue}</p>}
    </div>
  )
}

function SummaryCard({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold text-sm">{value}</p>
      {subvalue && <p className="text-xs text-muted-foreground">{subvalue}</p>}
    </div>
  )
}

function AddContributionForm({ onSave, onCancel }: { onSave: (c: SavingsContribution) => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
      <div className="space-y-0.5">
        <Label className="text-xs">Dato</Label>
        <Input type="date" className="h-8 text-xs w-36" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs">Beløp (kr)</Label>
        <Input type="number" className="h-8 text-xs w-28" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </div>
      <div className="space-y-0.5 flex-1">
        <Label className="text-xs">Notat (valgfritt)</Label>
        <Input className="h-8 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="f.eks. lønning" />
      </div>
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ id: crypto.randomUUID(), date, amount: parseFloat(amount) || 0, note: note || undefined })}>
        Lagre
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Avbryt</Button>
    </div>
  )
}

function AddWithdrawalForm({ onSave, onCancel }: { onSave: (w: WithdrawalEntry) => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
      <div className="space-y-0.5">
        <Label className="text-xs">Dato</Label>
        <Input type="date" className="h-8 text-xs w-36" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs">Beløp (kr)</Label>
        <Input type="number" className="h-8 text-xs w-28" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </div>
      <div className="space-y-0.5 flex-1">
        <Label className="text-xs">Notat (valgfritt)</Label>
        <Input className="h-8 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Årsak" />
      </div>
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ id: crypto.randomUUID(), date, amount: -(parseFloat(amount) || 0), note: note || undefined })}>
        Lagre
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Avbryt</Button>
    </div>
  )
}

function UpdateBalanceForm({ onSave, onCancel }: { onSave: (e: BalanceHistoryEntry) => void; onCancel: () => void }) {
  const now = new Date()
  const [balance, setBalance] = useState('')
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        type="number"
        className="h-8 text-xs flex-1"
        placeholder="Ny saldo"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
      />
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ year: now.getFullYear(), month: now.getMonth() + 1, balance: parseFloat(balance) || 0, isManual: true })}>
        OK
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>×</Button>
    </div>
  )
}

function UpdateRateForm({ onSave, onCancel }: { onSave: (e: RateHistoryEntry) => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [rate, setRate] = useState(0)
  const [fromDate, setFromDate] = useState(today)
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
      <div className="space-y-0.5">
        <Label className="text-xs">Gyldig fra</Label>
        <Input type="date" className="h-8 text-xs w-36" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <div className="space-y-0.5">
        <Label className="text-xs">Ny rente %</Label>
        <Input
          type="number"
          step="0.01"
          className="h-8 text-xs w-24"
          placeholder="f.eks. 5.25"
          value={rate || ''}
          onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
        />
      </div>
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ fromDate, rate })} disabled={!rate || !fromDate}>
        Lagre
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Avbryt</Button>
    </div>
  )
}

function AddAccountForm({ onSave, onCancel }: { onSave: (a: SavingsAccount) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    label: '',
    type: 'BSU' as SavingsAccountType,
    openingBalance: 0,
    monthlyContribution: 0,
    rate: 5.5,
    birthYear: '' as string | number,
  })

  function handleSave() {
    if (!form.label.trim()) return
    const isBSU = form.type === 'BSU'
    const birthYear = typeof form.birthYear === 'string' ? parseInt(form.birthYear) || undefined : form.birthYear || undefined
    onSave({
      id: crypto.randomUUID(),
      type: form.type,
      label: form.label.trim(),
      openingBalance: form.openingBalance,
      openingDate: new Date().toISOString().split('T')[0],
      monthlyContribution: form.monthlyContribution,
      interestCreditFrequency: isBSU ? 'yearly' : 'monthly',
      rateHistory: [{ fromDate: new Date().toISOString().split('T')[0], rate: form.rate }],
      balanceHistory: [],
      withdrawals: [],
      contributions: [],
      ...(isBSU ? { maxYearlyContribution: 27500, maxTotalBalance: 300000 } : {}),
      ...(birthYear ? { birthYear } : {}),
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Ny sparekonto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as SavingsAccountType }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ACCOUNT_TYPE_LABELS) as SavingsAccountType[]).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {ACCOUNT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rentesats %</Label>
            <Input
              type="number"
              step="0.1"
              value={form.rate}
              onChange={(e) => setForm((f) => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nåværende saldo</Label>
            <Input
              type="number"
              placeholder="0"
              value={form.openingBalance || ''}
              onChange={(e) => setForm((f) => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Månedlig innskudd (planlagt)</Label>
            <Input
              type="number"
              placeholder="0"
              value={form.monthlyContribution || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthlyContribution: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          {form.type === 'BSU' && (
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Fødselsår (for aldersgrense)</Label>
              <Input
                type="number"
                placeholder="f.eks. 1995"
                value={form.birthYear || ''}
                onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button size="sm" onClick={handleSave} disabled={!form.label.trim()}>Lagre</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EditAccountForm({ account, onSave, onCancel }: {
  account: SavingsAccount
  onSave: (patch: Partial<SavingsAccount>) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(account.label)
  const [accountNumber, setAccountNumber] = useState(account.accountNumber ?? '')
  const [type, setType] = useState<SavingsAccountType>(account.type)

  return (
    <Card className="border-primary/20 bg-primary/3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Rediger konto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={v => setType(v as SavingsAccountType)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ACCOUNT_TYPE_LABELS) as SavingsAccountType[]).map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kontonummer</Label>
            <Input
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="xxxx.xx.xxxxx"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button size="sm" onClick={() => onSave({ label: label.trim(), accountNumber: accountNumber || undefined, type })} disabled={!label.trim()}>
            Lagre
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AddGoalForm({
  accounts,
  fondMonthlyDeposit,
  onSave,
  onCancel,
}: {
  accounts: SavingsAccount[]
  fondMonthlyDeposit: number
  onSave: (g: SavingsGoal) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    label: '', icon: '🏠', targetAmount: 0,
    linkedAccountIds: [] as string[], includeFond: false,
  })

  function toggleAccount(id: string) {
    setForm((f) => ({
      ...f,
      linkedAccountIds: f.linkedAccountIds.includes(id)
        ? f.linkedAccountIds.filter((x) => x !== id)
        : [...f.linkedAccountIds, id],
    }))
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Nytt sparemål</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Ikon</Label>
            <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="text-center" />
          </div>
          <div className="col-span-3 space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Målbeløp</Label>
          <Input
            type="number"
            placeholder="0"
            value={form.targetAmount || ''}
            onChange={(e) => setForm((f) => ({ ...f, targetAmount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        {accounts.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Koblede kontoer</Label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAccount(a.id)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    form.linkedAccountIds.includes(a.id)
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {fondMonthlyDeposit > 0 && (
          <button
            onClick={() => setForm((f) => ({ ...f, includeFond: !f.includeFond }))}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              form.includeFond
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:border-border/80'
            }`}
          >
            📈 KRON Fond ({fondMonthlyDeposit.toLocaleString('no-NO')} kr/mnd)
          </button>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button size="sm" onClick={() => onSave({ id: crypto.randomUUID(), ...form })} disabled={!form.label.trim()}>Lagre</Button>
        </div>
      </CardContent>
    </Card>
  )
}


