import { useState } from 'react'
import { Plus, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react'
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
import {
  checkBSULimits,
  calculateGoalProgress,
  projectSavingsGrowth,
  computeMonthlyContributionEstimate,
  computeYTDContributions,
  computeETA,
  computeYearlyInterestIncome,
} from '@/domain/economy/savingsCalculator'
import type {
  SavingsAccount,
  SavingsGoal,
  SavingsAccountType,
  BalanceHistoryEntry,
  RateHistoryEntry,
  SavingsContribution,
  WithdrawalEntry,
} from '@/types/economy'
import { SavingsImporter } from '@/features/savings/SavingsImporter'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

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
    addSavingsAccount,
    removeSavingsAccount,
    updateSavingsBalance,
    updateSavingsRate,
    addContribution,
    removeContribution,
    addWithdrawal,
    removeWithdrawal,
    addSavingsGoal,
    removeSavingsGoal,
    fondPortfolio,
  } = useEconomyStore()

  const sortedFondSnapshots = [...fondPortfolio.snapshots].sort((a, b) => b.date.localeCompare(a.date))
  const fondCurrentValue = sortedFondSnapshots[0]?.totalValue ?? 0
  const fondMonthlyDeposit = fondPortfolio.monthlyDeposit

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  const now = new Date()
  const currentYear = now.getFullYear()

  // Summary stats
  const totalBalance = savingsAccounts.reduce((s, a) => {
    const last = a.balanceHistory.at(-1)
    return s + (last?.balance ?? a.openingBalance)
  }, 0)

  const bsuAccount = savingsAccounts.find((a) => a.type === 'BSU')
  const bsuStatus = bsuAccount ? checkBSULimits(bsuAccount, currentYear) : null
  const bsuSkattefradrag = bsuAccount
    ? Math.round(Math.min(bsuStatus!.yearlyContributionSoFar, 27500) * 0.1)
    : 0

  const totalInterestIncome = savingsAccounts
    .filter((a) => a.type !== 'fond' && a.type !== 'krypto')
    .reduce((s, a) => s + computeYearlyInterestIncome(a, currentYear), 0)

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
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
          {totalInterestIncome > 0 && (
            <SummaryCard
              label={`Renteinntekter ${currentYear}`}
              value={fmtNOK(totalInterestIncome)}
              subvalue="opptjent hittil"
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
              onUpdateBalance={(entry) => updateSavingsBalance(account.id, entry)}
              onUpdateRate={(entry) => updateSavingsRate(account.id, entry)}
              onAddContribution={(c) => addContribution(account.id, c)}
              onRemoveContribution={(id) => removeContribution(account.id, id)}
              onAddWithdrawal={(w) => addWithdrawal(account.id, w)}
              onRemoveWithdrawal={(id) => removeWithdrawal(account.id, id)}
            />
          ))}
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
  onUpdateBalance,
  onUpdateRate,
  onAddContribution,
  onRemoveContribution,
  onAddWithdrawal,
  onRemoveWithdrawal,
}: {
  account: SavingsAccount
  now: Date
  onRemove: () => void
  onUpdateBalance: (e: BalanceHistoryEntry) => void
  onUpdateRate: (e: RateHistoryEntry) => void
  onAddContribution: (c: SavingsContribution) => void
  onRemoveContribution: (id: string) => void
  onAddWithdrawal: (w: WithdrawalEntry) => void
  onRemoveWithdrawal: (id: string) => void
}) {
  const [activeTab, setActiveTab] = useState<AccountTab | null>(null)
  const [showLog, setShowLog] = useState(false)

  const currentYear = now.getFullYear()
  const lastBalance = account.balanceHistory.at(-1)
  const currentBalance = lastBalance?.balance ?? account.openingBalance
  const sortedRates = [...account.rateHistory].sort((a, b) => b.fromDate.localeCompare(a.fromDate))
  const currentRate = sortedRates[0]?.rate ?? 0
  const isBSU = account.type === 'BSU'
  const bsuStatus = isBSU ? checkBSULimits(account, currentYear) : null
  const monthlyEstimate = computeMonthlyContributionEstimate(account)
  const ytdContribs = computeYTDContributions(account, currentYear)
  const eta = isBSU ? computeETA(account, 300000) : null
  const interestIncome = (account.type !== 'fond' && account.type !== 'krypto')
    ? computeYearlyInterestIncome(account, currentYear)
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
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <MiniStat label="Saldo" value={fmtNOK(currentBalance)} highlight />
          <MiniStat
            label="Rentesats"
            value={`${currentRate.toFixed(2)} %`}
            subvalue={isBSU ? 'krediteres 31. des' : 'månedlig kreditering'}
          />
          <MiniStat label="Årets innskudd" value={fmtNOK(ytdContribs || 0)} />
          {interestIncome > 0 ? (
            <MiniStat
              label={`Renteinntekter ${currentYear}`}
              value={fmtNOK(interestIncome)}
              subvalue={isBSU ? 'opptjent (krediteres des)' : 'kreditert hittil'}
            />
          ) : (
            <MiniStat
              label="Est. månedsspar"
              value={fmtNOK(monthlyEstimate)}
              subvalue={ytdContribs > 0 ? '(snitt 12 mnd)' : '(planlagt)'}
            />
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
            <Progress value={Math.min(100, (bsuStatus.yearlyContributionSoFar / 27500) * 100)} className="h-1.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total BSU-tak</span>
              <span>{fmtNOK(currentBalance)} / 300 000 kr</span>
            </div>
            <Progress value={Math.min(100, (currentBalance / 300000) * 100)} className="h-1.5" />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Skattefradrag {currentYear}: <span className="text-green-500 font-medium">{fmtNOK(Math.round(Math.min(bsuStatus.yearlyContributionSoFar, 27500) * 0.1))}</span>
              </span>
              {eta && <span className="text-muted-foreground">Maks saldo: ~{eta}</span>}
            </div>
            {bsuStatus.warning && (
              <p className="text-xs text-yellow-400">{bsuStatus.warning}</p>
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
        {(sortedContribs.length > 0 || sortedWithdrawals.length > 0) && (
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
  onRemoveContribution,
  onRemoveWithdrawal,
}: {
  contributions: SavingsContribution[]
  withdrawals: WithdrawalEntry[]
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
  const [amount, setAmount] = useState(0)
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
        <Input type="number" className="h-8 text-xs w-28" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="space-y-0.5 flex-1">
        <Label className="text-xs">Notat (valgfritt)</Label>
        <Input className="h-8 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="f.eks. lønning" />
      </div>
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ id: crypto.randomUUID(), date, amount, note: note || undefined })}>
        Lagre
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Avbryt</Button>
    </div>
  )
}

function AddWithdrawalForm({ onSave, onCancel }: { onSave: (w: WithdrawalEntry) => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState(0)
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
        <Input type="number" className="h-8 text-xs w-28" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="space-y-0.5 flex-1">
        <Label className="text-xs">Notat (valgfritt)</Label>
        <Input className="h-8 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Årsak" />
      </div>
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ id: crypto.randomUUID(), date, amount: -Math.abs(amount), note: note || undefined })}>
        Lagre
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Avbryt</Button>
    </div>
  )
}

function UpdateBalanceForm({ onSave, onCancel }: { onSave: (e: BalanceHistoryEntry) => void; onCancel: () => void }) {
  const now = new Date()
  const [balance, setBalance] = useState(0)
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        type="number"
        className="h-8 text-xs flex-1"
        placeholder="Ny saldo"
        value={balance}
        onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
      />
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ year: now.getFullYear(), month: now.getMonth() + 1, balance, isManual: true })}>
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
  })

  function handleSave() {
    if (!form.label.trim()) return
    const isBSU = form.type === 'BSU'
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
              value={form.openingBalance}
              onChange={(e) => setForm((f) => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Månedlig innskudd (planlagt)</Label>
            <Input
              type="number"
              value={form.monthlyContribution}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthlyContribution: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button size="sm" onClick={handleSave} disabled={!form.label.trim()}>Lagre</Button>
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
            value={form.targetAmount}
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


