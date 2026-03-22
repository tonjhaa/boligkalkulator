import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
  calculateRealizedReturn,
  projectSavingsGrowth,
} from '@/domain/economy/savingsCalculator'
import type { SavingsAccount, SavingsGoal, SavingsAccountType, BalanceHistoryEntry, RateHistoryEntry } from '@/types/economy'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

const ACCOUNT_TYPE_LABELS: Record<SavingsAccountType, string> = {
  BSU: 'BSU',
  fond: 'Fond',
  krypto: 'Krypto',
  sparekonto: 'Sparekonto',
  annet: 'Annet',
}

export function SavingsPage() {
  const {
    savingsAccounts,
    savingsGoals,
    addSavingsAccount,
    removeSavingsAccount,
    updateSavingsBalance,
    updateSavingsRate,
    addSavingsGoal,
    removeSavingsGoal,
  } = useEconomyStore()

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [updatingBalanceFor, setUpdatingBalanceFor] = useState<string | null>(null)
  const [updatingRateFor, setUpdatingRateFor] = useState<string | null>(null)

  const now = new Date()

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Sparing</h2>
        <Button size="sm" onClick={() => setShowAddAccount(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Ny konto
        </Button>
      </div>

      {showAddAccount && (
        <AddAccountForm
          onSave={(a) => { addSavingsAccount(a); setShowAddAccount(false) }}
          onCancel={() => setShowAddAccount(false)}
        />
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
          {savingsAccounts.map((account) => {
            const lastBalance = account.balanceHistory.at(-1)
            const currentBalance = lastBalance?.balance ?? account.openingBalance
            const currentRate =
              account.rateHistory.length > 0
                ? account.rateHistory.at(-1)!.rate
                : 0

            const isBSU = account.type === 'BSU'
            const bsuStatus = isBSU ? checkBSULimits(account, now.getFullYear()) : null
            const realReturn =
              account.type === 'fond' || account.type === 'krypto'
                ? calculateRealizedReturn(account)
                : null

            // Prognose: neste 12 måneder
            const projections = projectSavingsGrowth(account, {
              year: now.getFullYear() + 1,
              month: now.getMonth() + 1,
            })
            const chartData = projections.slice(0, 24).map((bal, i) => ({
              month: i + 1,
              saldo: bal,
            }))

            return (
              <Card key={account.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{account.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                      onClick={() => removeSavingsAccount(account.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <MiniStat label="Saldo" value={fmtNOK(currentBalance)} highlight />
                    <MiniStat label="Månedlig innskudd" value={fmtNOK(account.monthlyContribution)} />
                    <MiniStat label="Rentesats" value={`${currentRate.toFixed(2)}%`} />
                    {realReturn && (
                      <MiniStat
                        label="Avkastning"
                        value={`${realReturn.returnPercent >= 0 ? '+' : ''}${realReturn.returnPercent.toFixed(1)}%`}
                      />
                    )}
                  </div>

                  {/* BSU-spesifikk */}
                  {bsuStatus && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>BSU-kvote dette år</span>
                        <span>{fmtNOK(bsuStatus.yearlyContributionSoFar)} / 27 500 kr</span>
                      </div>
                      <Progress
                        value={(bsuStatus.yearlyContributionSoFar / 27500) * 100}
                        className="h-1.5"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Total BSU-tak</span>
                        <span>{fmtNOK(currentBalance)} / 300 000 kr</span>
                      </div>
                      <Progress
                        value={(currentBalance / 300000) * 100}
                        className="h-1.5"
                      />
                      {bsuStatus.warning && (
                        <p className="text-xs text-yellow-400">{bsuStatus.warning}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        BSU: Rente krediteres 31. desember (ikke månedlig)
                      </p>
                    </div>
                  )}

                  {/* Graf */}
                  {chartData.length > 1 && (
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" hide />
                        <YAxis hide />
                        <Tooltip
                          formatter={(v) => [fmtNOK(Number(v)), 'Saldo']}
                          labelFormatter={(l) => `Mnd ${l}`}
                        />
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

                  {/* Handlinger */}
                  <div className="flex gap-2">
                    {updatingBalanceFor === account.id ? (
                      <UpdateBalanceForm
                        onSave={(entry) => {
                          updateSavingsBalance(account.id, entry)
                          setUpdatingBalanceFor(null)
                        }}
                        onCancel={() => setUpdatingBalanceFor(null)}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setUpdatingBalanceFor(account.id)}
                      >
                        Oppdater saldo
                      </Button>
                    )}

                    {updatingRateFor === account.id ? (
                      <UpdateRateForm
                        onSave={(entry) => {
                          updateSavingsRate(account.id, entry)
                          setUpdatingRateFor(null)
                        }}
                        onCancel={() => setUpdatingRateFor(null)}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setUpdatingRateFor(account.id)}
                      >
                        Ny rentesats
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
            const progress = calculateGoalProgress(goal, savingsAccounts)
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
// SUB-KOMPONENTER
// ------------------------------------------------------------

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono font-medium text-sm ${highlight ? 'text-green-500' : ''}`}>{value}</p>
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
            <Label className="text-xs">Månedlig innskudd</Label>
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
  onSave,
  onCancel,
}: {
  accounts: SavingsAccount[]
  onSave: (g: SavingsGoal) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ label: '', icon: '🏠', targetAmount: 0, linkedAccountIds: [] as string[] })

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
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button size="sm" onClick={() => onSave({ id: crypto.randomUUID(), ...form })} disabled={!form.label.trim()}>Lagre</Button>
        </div>
      </CardContent>
    </Card>
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
  const [rate, setRate] = useState(0)
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        type="number"
        step="0.1"
        className="h-8 text-xs flex-1"
        placeholder="Ny rente %"
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
      />
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ fromDate: new Date().toISOString().split('T')[0], rate })}>
        OK
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>×</Button>
    </div>
  )
}
