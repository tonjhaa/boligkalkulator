import { useState, useMemo, Fragment } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Plus, Trash2, Upload, ChevronDown, ChevronUp, Repeat2, Pencil, Check, X } from 'lucide-react'
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
} from '@/domain/economy/savingsCalculator'
import { calcMaxPurchase, BSU_MAX_TOTAL } from '@/hooks/useVeikart'
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
  BudgetTemplate,
} from '@/types/economy'
import { SavingsImporter } from '@/features/savings/SavingsImporter'
import { FondPage } from '@/pages/economy/FondPage'
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
    savingsPlanTarget,
    setSavingsPlanTarget,
  } = useEconomyStore()

  const { savingsTab: tab, setSavingsTab: setTab } = useAppStore()

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const now = new Date()
  const currentYear = now.getFullYear()

  const sortedFondSnapshots = [...(fondPortfolio?.snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const fondCurrentValue = sortedFondSnapshots[0]?.totalValue ?? 0
  const fondMonthlyDeposit = fondPortfolio?.monthlyDeposit ?? 0

  // Summary stats for Kontoer tab
  const totalBalance = savingsAccounts.reduce((s, a) => s + computeEffectiveBalance(a, now), 0)
  const bsuAccount = savingsAccounts.find((a) => a.type === 'BSU')
  const bsuStatus = bsuAccount ? checkBSULimits(bsuAccount, currentYear) : null
  const bsuSkattefradrag = bsuAccount
    ? Math.round(Math.min(bsuStatus!.yearlyContributionSoFar, 27500) * 0.1) : 0
  const totalInterestIncome = savingsAccounts
    .filter((a) => a.type !== 'fond' && a.type !== 'krypto')
    .reduce((s, a) => s + computeYearlyInterestIncome(a, currentYear), 0)
  const totalInterestForecast = savingsAccounts
    .filter((a) => a.type !== 'fond' && a.type !== 'krypto')
    .reduce((s, a) => s + computeYearlyInterestIncome(a, currentYear, true), 0)

  const SAVINGS_CATS = new Set(['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'])
  const budgetSavingsLines = (budgetTemplate?.lines ?? []).filter(
    (l) => SAVINGS_CATS.has(l.category) && l.isRecurring && Math.abs(l.amount) > 0
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Flat 4-tab bar with contextual actions */}
      <div className="flex items-center gap-1 border-b border-border bg-card/40 px-4 shrink-0">
        {([
          ['kontoer', 'Kontoer & mål'],
          ['fond', 'Fond'],
          ['måneder', 'Månedsoversikt'],
          ['råd', 'Råd & varsler'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >{label}</button>
        ))}
        {/* Contextual action buttons */}
        <div className="ml-auto flex items-center gap-2 py-1">
          {tab === 'kontoer' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
                <Upload className="h-3.5 w-3.5 mr-1" />Importer
              </Button>
              <Button size="sm" onClick={() => setShowAddAccount(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Ny konto
              </Button>
            </>
          )}
          {tab === 'kontoer' && (
            <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Nytt mål
            </Button>
          )}
        </div>
      </div>

      {/* ── KONTOER TAB ── */}
      {tab === 'kontoer' && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {showImport && <SavingsImporter onDone={() => setShowImport(false)} />}
          {showAddAccount && (
            <AddAccountForm
              onSave={(a) => { addSavingsAccount(a); setShowAddAccount(false) }}
              onCancel={() => setShowAddAccount(false)}
            />
          )}

          {/* Summary bar */}
          {savingsAccounts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SummaryCard label="Total saldo" value={fmtNOK(totalBalance)} />
              {bsuStatus && (
                <SummaryCard
                  label={`BSU-kvote ${currentYear}`}
                  value={`${fmtNOK(bsuStatus.yearlyContributionSoFar)} / 27 500 kr`}
                  subvalue={`${Math.round((bsuStatus.yearlyContributionSoFar / 27500) * 100)}%`}
                />
              )}
              {bsuAccount && (
                <SummaryCard label="BSU skattefradrag" value={fmtNOK(bsuSkattefradrag)} subvalue="10% av innskudd" />
              )}
              {totalInterestForecast > 0 && (
                <SummaryCard
                  label={`Renteinntekter ${currentYear}`}
                  value={fmtNOK(totalInterestForecast)}
                  subvalue={totalInterestIncome > 0 && totalInterestIncome < totalInterestForecast
                    ? `${fmtNOK(totalInterestIncome)} opptjent hittil` : 'prognose hele året'}
                />
              )}
            </div>
          )}

          {/* Account cards */}
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

          {/* Budget savings lines */}
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
                        {linkedAccount
                          ? <p className="text-[10px] text-green-500">→ {linkedAccount.label}</p>
                          : <p className="text-[10px] text-muted-foreground">Ikke koblet til konto</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Repeat2 className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{Math.abs(line.amount).toLocaleString('no-NO')} kr/mnd</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Goals */}
          <div>
            <h3 className="font-medium text-sm mb-2">Sparemål</h3>
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
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            onClick={() => removeSavingsGoal(goal.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Progress value={progress.percent} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{fmtNOK(progress.currentTotal)} / {fmtNOK(progress.targetAmount)}</span>
                          <span>{Math.round(progress.percent)}%</span>
                        </div>
                        {goal.includeFond && <p className="text-xs text-muted-foreground">Inkl. KRON Fond</p>}
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
        </div>
      )}

      {/* ── FOND TAB ── */}
      {tab === 'fond' && <FondPage />}

      {/* ── MÅNEDSOVERSIKT TAB ── */}
      {tab === 'måneder' && (
        <MånedsoversiktTable
          accounts={savingsAccounts}
          fondCurrentValue={fondCurrentValue}
          fondMonthlyDeposit={fondMonthlyDeposit}
          debts={debts}
          profile={profile}
          partnerVeikart={partnerVeikart}
          now={now}
        />
      )}

      {/* ── RÅD TAB ── */}
      {tab === 'råd' && (
        <RådTab
          savingsAccounts={savingsAccounts}
          profile={profile}
          partnerVeikart={partnerVeikart}
          debts={debts}
          fondCurrentValue={fondCurrentValue}
          budgetTemplate={budgetTemplate}
          updateSavingsAccount={updateSavingsAccount}
          savingsPlanTarget={savingsPlanTarget}
          setSavingsPlanTarget={setSavingsPlanTarget}
        />
      )}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────

type InsightColor = 'green' | 'blue' | 'amber' | 'red'

function InsightCard({ icon, text, color }: { icon: string; text: string; color: InsightColor }) {
  const bg = { green: 'bg-green-950/40 border-green-800/40', blue: 'bg-blue-950/40 border-blue-800/40', amber: 'bg-amber-950/40 border-amber-800/40', red: 'bg-red-950/40 border-red-800/40' }[color]
  const txt = { green: 'text-green-300', blue: 'text-blue-300', amber: 'text-amber-300', red: 'text-red-300' }[color]
  return (
    <div className={`rounded-lg border p-3 flex items-start gap-2 ${bg}`}>
      <span className="text-sm">{icon}</span>
      <p className={`text-xs leading-relaxed ${txt}`}>{text}</p>
    </div>
  )
}

function projectDebtBalance(d: DebtAccount, months: number): number {
  if (d.currentBalance <= 0) return 0
  const rate = [...d.rateHistory].sort((a, b) => b.fromDate.localeCompare(a.fromDate))[0]?.nominalRate ?? 0
  const monthly = d.monthlyPayment
  if (monthly <= 0) return d.currentBalance
  const r = rate / 100 / 12
  if (r === 0) return Math.max(0, d.currentBalance - monthly * months)
  let bal = d.currentBalance
  for (let i = 0; i < months; i++) {
    bal = bal * (1 + r) - monthly
    if (bal <= 0) return 0
  }
  return Math.max(0, bal)
}

// ─── Råd & varsler ───────────────────────────────────────────

function RådTab({
  savingsAccounts, profile, partnerVeikart, debts, fondCurrentValue, budgetTemplate,
  updateSavingsAccount, savingsPlanTarget, setSavingsPlanTarget,
}: {
  savingsAccounts: SavingsAccount[]
  profile: EmploymentProfile | null
  partnerVeikart: PartnerVeikart
  debts: DebtAccount[]
  fondCurrentValue: number
  budgetTemplate: BudgetTemplate | null
  updateSavingsAccount: (id: string, patch: Partial<SavingsAccount>) => void
  savingsPlanTarget: number
  setSavingsPlanTarget: (v: number) => void
}) {
  const [showWizard, setShowWizard] = useState(false)
  const now = new Date()

  const userMonthly = profile?.baseMonthly ?? 0
  const partnerMonthly = (partnerVeikart?.annualIncome ?? 0) / 12
  const combinedMonthly = userMonthly + (partnerVeikart?.enabled ? partnerMonthly : 0)

  const totalSavingsMonthly = savingsAccounts.reduce((s, a) => s + (a.monthlyContribution ?? 0), 0)
  const totalDebt = debts.filter(d => d.status !== 'nedbetalt').reduce((s, d) => s + d.currentBalance, 0)

  const SAVINGS_CATS = new Set(['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'])
  const budgetSavingsTotal = (budgetTemplate?.lines ?? [])
    .filter(l => SAVINGS_CATS.has(l.category) && l.isRecurring)
    .reduce((s, l) => s + Math.abs(l.amount), 0)

  const insights: { icon: string; color: InsightColor; text: string }[] = []
  const pctIncome = combinedMonthly > 0 ? (totalSavingsMonthly / combinedMonthly) * 100 : 0

  if (pctIncome >= 20)
    insights.push({ icon: '🏆', color: 'green', text: `Dere sparer ${pctIncome.toFixed(0)} % av samlet inntekt – over anbefalt 20 %.` })
  else if (pctIncome >= 10)
    insights.push({ icon: '👍', color: 'blue', text: `Dere sparer ${pctIncome.toFixed(0)} % av samlet inntekt. Anbefalt minstemål er 20 % – øk med ${fmtNOK(combinedMonthly * 0.2 - totalSavingsMonthly)}/mnd.` })
  else if (combinedMonthly > 0)
    insights.push({ icon: '⚠️', color: 'amber', text: `Kun ${pctIncome.toFixed(0)} % av inntekten spares. Vurder å øke månedlig sparing.` })

  const bsuAcc = savingsAccounts.find(a => a.type === 'BSU')
  if (bsuAcc) {
    const balance = computeEffectiveBalance(bsuAcc, now)
    if (balance >= BSU_MAX_TOTAL)
      insights.push({ icon: '✅', color: 'green', text: 'BSU er fylt opp! Flytt BSU-sparingen til fond eller sparekonto.' })
    else if ((bsuAcc.monthlyContribution ?? 0) < BSU_MAX_YEARLY / 12 * 0.9)
      insights.push({ icon: '💡', color: 'blue', text: `Du kan øke BSU til ${fmtNOK(Math.round(BSU_MAX_YEARLY / 12))}/mnd. Skattefradrag: ${fmtNOK(Math.min((bsuAcc.monthlyContribution ?? 0) * 12, BSU_MAX_YEARLY) * 0.1)}/år.` })
  }

  if (budgetSavingsTotal > 0 && Math.abs(budgetSavingsTotal - totalSavingsMonthly) > 500)
    insights.push({ icon: '📊', color: 'amber', text: `Budsjettet sier ${fmtNOK(budgetSavingsTotal)}/mnd til sparing, men kontoene har ${fmtNOK(totalSavingsMonthly)}/mnd. Sjekk at tallene stemmer overens.` })

  if (totalDebt > 0 && totalSavingsMonthly > 0 && totalDebt / (totalSavingsMonthly * 12) > 5)
    insights.push({ icon: '⚖️', color: 'amber', text: `Gjelden (${fmtNOK(totalDebt)}) er høy relativt til sparingen. Vurder ekstra nedbetaling av dyr gjeld.` })

  const totalEKNow = savingsAccounts.reduce((s, a) => s + computeEffectiveBalance(a, now), 0) + fondCurrentValue
    + (partnerVeikart?.enabled ? (partnerVeikart.equity ?? 0) + (partnerVeikart.bsu ?? 0) : 0)
  const requiredEK = savingsPlanTarget > 0 ? Math.max(savingsPlanTarget * 0.1, 0) : 0
  if (requiredEK > 0) {
    const pctGoal = Math.min(100, (totalEKNow / requiredEK) * 100)
    insights.push({
      icon: pctGoal >= 100 ? '🏠' : '🚧',
      color: pctGoal >= 100 ? 'green' : 'blue',
      text: pctGoal >= 100
        ? `Dere har nok EK til ${fmtNOK(savingsPlanTarget)}-boligen (${fmtNOK(totalEKNow)} ≥ ${fmtNOK(requiredEK)}).`
        : `EK-fremgang mot ${fmtNOK(savingsPlanTarget)}-boligen: ${fmtNOK(totalEKNow)} av ${fmtNOK(requiredEK)} (${pctGoal.toFixed(0)} %).`,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Boligmål */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold">🏠 Boligmål</p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Ønsket boligpris</label>
          <input
            type="number"
            step={50000}
            value={savingsPlanTarget || ''}
            placeholder="f.eks. 4 500 000"
            onChange={e => setSavingsPlanTarget(parseFloat(e.target.value) || 0)}
            className="h-8 flex-1 rounded border border-border bg-background px-2 text-xs font-mono outline-none focus:border-primary"
          />
        </div>
        {savingsPlanTarget > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Nødvendig EK (10 %):</span>
              <span className="font-mono font-semibold">{fmtNOK(requiredEK)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Nåværende samlet EK:</span>
              <span className="font-mono font-semibold text-blue-400">{fmtNOK(totalEKNow)}</span>
            </div>
            <Progress value={Math.min(100, (totalEKNow / requiredEK) * 100)} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="space-y-2">
        <p className="text-xs font-semibold">Råd & varsler</p>
        {insights.length === 0
          ? <p className="text-xs text-muted-foreground">Ingen varsler. Alt ser bra ut!</p>
          : insights.map((ins, i) => <InsightCard key={i} icon={ins.icon} text={ins.text} color={ins.color} />)
        }
      </div>

      {/* Cross-tool links */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold">🔗 Sammenheng med resten av verktøyet</p>
        {[
          { icon: '📊', label: 'Budsjett', value: `${fmtNOK(budgetSavingsTotal)}/mnd satt av til sparing` },
          { icon: '💰', label: 'Inntekt', value: combinedMonthly > 0 ? `${pctIncome.toFixed(0)} % av samlet inntekt spares` : 'Ingen inntekt registrert' },
          { icon: '🧾', label: 'BSU skattefradrag', value: (() => {
            if (!bsuAcc) return 'Ingen BSU registrert'
            return `Estimert ${fmtNOK(Math.min((bsuAcc.monthlyContribution ?? 0) * 12, BSU_MAX_YEARLY) * 0.1)} refundert`
          })() },
          { icon: '⚖️', label: 'Gjeld', value: totalDebt > 0 ? `${fmtNOK(totalDebt)} total gjeld` : 'Ingen gjeld registrert' },
          { icon: '🗺️', label: 'Veikart', value: `${fmtNOK(totalEKNow)} samlet EK` },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <span className="text-base">{row.icon}</span>
            <div>
              <p className="text-xs font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Wizard */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold">📋 Sparewizard</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Steg-for-steg: koble kontoer mot budsjett, sett BSU-kvote, velg fondstrategi og beregn optimalt oppsett.
        </p>
        <Button size="sm" onClick={() => setShowWizard(true)}>Start wizard</Button>
      </div>

      {showWizard && (
        <SavingsPlanWizard
          accounts={savingsAccounts}
          onClose={() => setShowWizard(false)}
          onUpdateAccount={updateSavingsAccount}
          onSetTarget={setSavingsPlanTarget}
          currentTarget={savingsPlanTarget}
        />
      )}
    </div>
  )
}
// ─── Månedsoversikt ───────────────────────────────────────────

const FOND_RATE_TABLE = 7.0
const SAVINGS_RATE_TABLE = 3.5
const FULL_MONTH_NAMES = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']

function InnskuddCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [tmp, setTmp] = useState('')
  const rounded = Math.round(value)
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={tmp}
        onChange={e => setTmp(e.target.value)}
        onBlur={() => { onChange(parseFloat(tmp) || 0); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onChange(parseFloat(tmp) || 0); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full text-right bg-primary/10 border border-primary rounded px-1 py-0.5 text-xs font-mono outline-none"
      />
    )
  }
  return (
    <button
      onClick={() => { setTmp(String(rounded)); setEditing(true) }}
      title="Klikk for å endre planlagt innskudd"
      className="w-full text-right text-muted-foreground hover:text-foreground hover:underline decoration-dashed underline-offset-2 transition-colors"
    >
      {rounded.toLocaleString('no-NO')}
    </button>
  )
}

function MånedsoversiktTable({
  accounts, fondCurrentValue, fondMonthlyDeposit, debts, profile, partnerVeikart, now,
}: {
  accounts: SavingsAccount[]
  fondCurrentValue: number
  fondMonthlyDeposit: number
  debts: DebtAccount[]
  profile: EmploymentProfile | null
  partnerVeikart: PartnerVeikart
  now: Date
}) {
  const HORIZON = 72
  const { setSavingsTab, setCurrentEconomyPage } = useAppStore()

  const [contribOverrides, setContribOverrides] = useState<Record<string, number>>({})
  const [fondOverride, setFondOverride] = useState<number | null>(null)

  const hasFond = fondCurrentValue > 0 || fondMonthlyDeposit > 0
  const hasPartner = partnerVeikart.enabled

  const annualIncome =
    ((profile?.baseMonthly ?? 0) + (profile?.fixedAdditions?.reduce((s, a) => s + a.amount, 0) ?? 0)) * 12
    + (hasPartner ? partnerVeikart.annualIncome : 0)

  const { accMeta, monthRows } = useMemo(() => {
    const effectiveFondMnd = fondOverride ?? fondMonthlyDeposit

    const accMeta = accounts.map(acc => ({
      id: acc.id,
      label: acc.label,
      type: acc.type,
      startBalance: computeEffectiveBalance(acc, now),
      monthly: Math.round(contribOverrides[acc.id] ?? acc.monthlyContribution ?? 0),
      rate: [...acc.rateHistory].sort((a, b) => b.fromDate.localeCompare(a.fromDate))[0]?.rate ?? 0,
    }))

    // Month-by-month simulation — handles BSU cap correctly
    const runningBals = accMeta.map(a => a.startBalance)
    let fondBal = fondCurrentValue
    let partnerSparingBal = hasPartner ? (partnerVeikart.equity ?? 0) : 0
    let partnerBsuBal = hasPartner ? (partnerVeikart.bsu ?? 0) : 0

    const monthRows = Array.from({ length: HORIZON }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1

      // User accounts
      const accountBalances = accMeta.map((acc, j) => {
        const bal0 = runningBals[j]
        let contrib = acc.monthly
        let bal: number
        if (acc.type === 'BSU') {
          const room = Math.max(0, BSU_MAX_TOTAL - bal0)
          contrib = Math.min(contrib, room)
          bal = bal0 + contrib
        } else {
          bal = bal0 * (1 + acc.rate / 100 / 12) + contrib
        }
        runningBals[j] = bal
        return { id: acc.id, balance: bal, contribution: contrib }
      })

      // Fond — compound at FOND_RATE_TABLE
      fondBal = fondBal * (1 + FOND_RATE_TABLE / 100 / 12) + effectiveFondMnd

      // Partner sparing — compound at SAVINGS_RATE_TABLE
      const partnerMndSparing = hasPartner ? Math.round(partnerVeikart.monthlySavings ?? 0) : 0
      if (hasPartner) {
        partnerSparingBal = partnerSparingBal * (1 + SAVINGS_RATE_TABLE / 100 / 12) + partnerMndSparing
      }

      // Partner BSU — simple deposit, capped at BSU_MAX_TOTAL
      const rawPartnerBsuMnd = hasPartner ? Math.round(partnerVeikart.bsuMonthlyContribution ?? 0) : 0
      const partnerBsuRoom = Math.max(0, BSU_MAX_TOTAL - partnerBsuBal)
      const partnerBsuMnd = Math.min(rawPartnerBsuMnd, partnerBsuRoom)
      if (hasPartner) partnerBsuBal = partnerBsuBal + partnerBsuMnd

      const totalEK =
        accountBalances.reduce((s, a) => s + a.balance, 0) +
        (hasFond ? fondBal : 0) +
        (hasPartner ? partnerSparingBal + partnerBsuBal : 0)

      const debtBalance = debts
        .filter(d => d.status !== 'nedbetalt')
        .reduce((s, d) => s + projectDebtBalance(d, i + 1), 0)
      const maxKjøpesum = annualIncome > 0 ? calcMaxPurchase(totalEK, annualIncome, debtBalance) : 0

      return {
        year, month,
        accountBalances,
        fondBalance: fondBal,
        fondContrib: Math.round(effectiveFondMnd),
        partnerSparingBalance: partnerSparingBal,
        partnerSparingContrib: partnerMndSparing,
        partnerBsuBalance: partnerBsuBal,
        partnerBsuContrib: partnerBsuMnd,
        totalEK,
        maxKjøpesum,
      }
    })

    return { accMeta, monthRows }
  }, [accounts, fondCurrentValue, fondMonthlyDeposit, fondOverride, debts, annualIncome, hasFond, hasPartner, partnerVeikart, now, contribOverrides])

  const years = [...new Set(monthRows.map(r => r.year))]

  // Column spans for group headers
  const userCols = accMeta.length * 2 + (hasFond ? 2 : 0)
  const partnerCols = hasPartner ? 4 : 0 // BSU(2) + Sparing(2)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/20 shrink-0 text-xs">
        <span className="text-muted-foreground">Legg til data:</span>
        <button
          onClick={() => setSavingsTab('kontoer')}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/40 transition-colors text-foreground"
        >
          + Min konto
        </button>
        <button
          onClick={() => setSavingsTab('fond')}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/40 transition-colors text-foreground"
        >
          + Fond
        </button>
        <button
          onClick={() => setCurrentEconomyPage('settings')}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/40 transition-colors text-violet-400"
        >
          Rediger partner →
        </button>
        {!partnerVeikart.enabled && (
          <span className="text-muted-foreground italic ml-1">Partner ikke aktivert — aktiver i Innstillinger</span>
        )}
      </div>
      <div className="overflow-auto flex-1 text-xs">
      <table className="border-collapse w-full min-w-max">
        <thead className="sticky top-0 z-10">
          {/* Row 1: Person groups */}
          <tr className="bg-background border-b border-border/40">
            <th className="sticky left-0 bg-background z-20 px-3 py-1 border-r border-border" />
            <th colSpan={userCols} className="px-3 py-1 text-center border-r border-border text-xs font-bold tracking-wide text-primary/80 uppercase">
              Meg
            </th>
            {hasPartner && (
              <th colSpan={partnerCols} className="px-3 py-1 text-center border-r border-border text-xs font-bold tracking-wide text-violet-400/80 uppercase">
                Partner
              </th>
            )}
            <th colSpan={2} />
          </tr>
          {/* Row 2: Account names */}
          <tr className="bg-background border-b border-border">
            <th className="sticky left-0 bg-background z-20 px-3 py-1.5 text-left border-r border-border w-24" />
            {accMeta.map(acc => (
              <th key={acc.id} colSpan={2} className="px-3 py-1.5 text-center border-r border-border font-semibold whitespace-nowrap">
                {acc.label}
                {acc.rate > 0 && <span className="ml-1 text-[10px] text-muted-foreground font-normal">{acc.rate}%</span>}
              </th>
            ))}
            {hasFond && (
              <th colSpan={2} className="px-3 py-1.5 text-center border-r border-border text-teal-400 font-semibold whitespace-nowrap">
                Fond <span className="text-[10px] text-muted-foreground font-normal">{FOND_RATE_TABLE}%</span>
              </th>
            )}
            {hasPartner && (
              <>
                <th colSpan={2} className="px-3 py-1.5 text-center border-r border-border text-violet-300 font-semibold whitespace-nowrap">BSU</th>
                <th colSpan={2} className="px-3 py-1.5 text-center border-r border-border text-violet-300 font-semibold whitespace-nowrap">
                  Sparing <span className="text-[10px] text-muted-foreground font-normal">{SAVINGS_RATE_TABLE}%</span>
                </th>
              </>
            )}
            <th className="px-3 py-1.5 text-right border-r border-border text-blue-400 font-semibold whitespace-nowrap">Total EK</th>
            <th className="px-3 py-1.5 text-right text-green-400 font-semibold whitespace-nowrap">Max kjøpesum</th>
          </tr>
          {/* Row 3: Innskudd / Saldo sub-headers */}
          <tr className="bg-background border-b-2 border-border">
            <th className="sticky left-0 bg-background z-20 px-3 py-1 text-left text-muted-foreground border-r border-border">Måned</th>
            {accMeta.map(acc => (
              <th key={acc.id} colSpan={2} className="border-r border-border p-0">
                <div className="flex">
                  <span className="flex-1 px-3 py-1 text-right text-muted-foreground font-normal">Innskudd</span>
                  <span className="flex-1 px-3 py-1 text-right font-medium">Saldo</span>
                </div>
              </th>
            ))}
            {hasFond && (
              <th colSpan={2} className="border-r border-border p-0">
                <div className="flex">
                  <span className="flex-1 px-3 py-1 text-right text-muted-foreground font-normal">Innskudd</span>
                  <span className="flex-1 px-3 py-1 text-right text-teal-400 font-medium">Saldo</span>
                </div>
              </th>
            )}
            {hasPartner && (
              <>
                <th colSpan={2} className="border-r border-border p-0">
                  <div className="flex">
                    <span className="flex-1 px-3 py-1 text-right text-muted-foreground font-normal">Innskudd</span>
                    <span className="flex-1 px-3 py-1 text-right text-violet-300 font-medium">Saldo</span>
                  </div>
                </th>
                <th colSpan={2} className="border-r border-border p-0">
                  <div className="flex">
                    <span className="flex-1 px-3 py-1 text-right text-muted-foreground font-normal">Innskudd</span>
                    <span className="flex-1 px-3 py-1 text-right text-violet-300 font-medium">Saldo</span>
                  </div>
                </th>
              </>
            )}
            <th className="px-3 py-1 border-r border-border" />
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {years.map(year => {
            const yearData = monthRows.filter(r => r.year === year)
            const last = yearData[yearData.length - 1]
            return (
              <Fragment key={year}>
                {/* Year summary row */}
                <tr className="bg-muted/60 border-y-2 border-border">
                  <td className="sticky left-0 bg-muted/60 px-3 py-2 font-bold text-sm border-r border-border">{year}</td>
                  {accMeta.map(acc => {
                    const ab = last.accountBalances.find(a => a.id === acc.id)!
                    const yearInnskudd = yearData.reduce((s, row) => s + (row.accountBalances.find(a => a.id === acc.id)?.contribution ?? 0), 0)
                    return (
                      <td key={acc.id} colSpan={2} className="border-r border-border p-0">
                        <div className="flex">
                          <span className="flex-1 px-3 py-2 text-right text-muted-foreground">{Math.round(yearInnskudd).toLocaleString('no-NO')}</span>
                          <span className="flex-1 px-3 py-2 text-right font-semibold">{fmtNOK(ab.balance)}</span>
                        </div>
                      </td>
                    )
                  })}
                  {hasFond && (
                    <td colSpan={2} className="border-r border-border p-0">
                      <div className="flex">
                        <span className="flex-1 px-3 py-2 text-right text-muted-foreground">
                          {yearData.reduce((s, r) => s + r.fondContrib, 0).toLocaleString('no-NO')}
                        </span>
                        <span className="flex-1 px-3 py-2 text-right text-teal-400 font-semibold">{fmtNOK(last.fondBalance)}</span>
                      </div>
                    </td>
                  )}
                  {hasPartner && (
                    <>
                      <td colSpan={2} className="border-r border-border p-0">
                        <div className="flex">
                          <span className="flex-1 px-3 py-2 text-right text-muted-foreground">
                            {yearData.reduce((s, r) => s + r.partnerBsuContrib, 0).toLocaleString('no-NO')}
                          </span>
                          <span className="flex-1 px-3 py-2 text-right text-violet-300 font-semibold">{fmtNOK(last.partnerBsuBalance)}</span>
                        </div>
                      </td>
                      <td colSpan={2} className="border-r border-border p-0">
                        <div className="flex">
                          <span className="flex-1 px-3 py-2 text-right text-muted-foreground">
                            {yearData.reduce((s, r) => s + r.partnerSparingContrib, 0).toLocaleString('no-NO')}
                          </span>
                          <span className="flex-1 px-3 py-2 text-right text-violet-300 font-semibold">{fmtNOK(last.partnerSparingBalance)}</span>
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right text-blue-400 font-semibold border-r border-border">{fmtNOK(last.totalEK)}</td>
                  <td className="px-3 py-2 text-right text-green-400 font-semibold">{last.maxKjøpesum > 0 ? fmtNOK(last.maxKjøpesum) : '—'}</td>
                </tr>
                {/* Monthly rows */}
                {yearData.map(row => (
                  <tr key={`${row.year}-${row.month}`} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="sticky left-0 bg-background px-3 py-1 text-muted-foreground border-r border-border whitespace-nowrap">
                      {FULL_MONTH_NAMES[row.month - 1]}
                    </td>
                    {accMeta.map(acc => {
                      const ab = row.accountBalances.find(a => a.id === acc.id)!
                      return (
                        <td key={acc.id} colSpan={2} className="border-r border-border p-0">
                          <div className="flex items-center">
                            <span className="flex-1 px-3 py-1">
                              <InnskuddCell
                                value={ab.contribution}
                                onChange={v => setContribOverrides(prev => ({ ...prev, [acc.id]: v }))}
                              />
                            </span>
                            <span className="flex-1 px-3 py-1 text-right font-mono">{fmtNOK(ab.balance)}</span>
                          </div>
                        </td>
                      )
                    })}
                    {hasFond && (
                      <td colSpan={2} className="border-r border-border p-0">
                        <div className="flex items-center">
                          <span className="flex-1 px-3 py-1">
                            <InnskuddCell
                              value={row.fondContrib}
                              onChange={v => setFondOverride(v)}
                            />
                          </span>
                          <span className="flex-1 px-3 py-1 text-right font-mono text-teal-400">{fmtNOK(row.fondBalance)}</span>
                        </div>
                      </td>
                    )}
                    {hasPartner && (
                      <>
                        <td colSpan={2} className="border-r border-border p-0">
                          <div className="flex items-center">
                            <span className="flex-1 px-3 py-1 text-right text-muted-foreground">{Math.round(row.partnerBsuContrib).toLocaleString('no-NO')}</span>
                            <span className="flex-1 px-3 py-1 text-right font-mono text-violet-300">{fmtNOK(row.partnerBsuBalance)}</span>
                          </div>
                        </td>
                        <td colSpan={2} className="border-r border-border p-0">
                          <div className="flex items-center">
                            <span className="flex-1 px-3 py-1 text-right text-muted-foreground">{Math.round(row.partnerSparingContrib).toLocaleString('no-NO')}</span>
                            <span className="flex-1 px-3 py-1 text-right font-mono text-violet-300">{fmtNOK(row.partnerSparingBalance)}</span>
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-1 text-right font-mono text-blue-300 border-r border-border">{fmtNOK(row.totalEK)}</td>
                    <td className="px-3 py-1 text-right text-green-300/60">{row.maxKjøpesum > 0 ? fmtNOK(row.maxKjøpesum) : '—'}</td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
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


