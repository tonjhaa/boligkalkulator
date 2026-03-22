import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useEconomyStore } from '@/application/useEconomyStore'
import {
  buildRepaymentPlan,
  calculateTotalMonthlyDebtCost,
  getCurrentRate,
} from '@/domain/economy/debtCalculator'
import type { DebtAccount, DebtRateHistory } from '@/types/economy'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

const DEBT_TYPE_LABELS: Record<DebtAccount['type'], string> = {
  studielaan: 'Studielån',
  billaan: 'Billån',
  kredittkort: 'Kredittkort',
  boliglaan: 'Boliglån',
  annet: 'Annet',
}

export function DebtPage() {
  const { debts, addDebt, removeDebt, updateDebtRate } = useEconomyStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [updatingRateFor, setUpdatingRateFor] = useState<string | null>(null)

  const totalMonthly = calculateTotalMonthlyDebtCost(debts)
  const totalBalance = debts.reduce((s, d) => s + d.currentBalance, 0)

  // Graf: samlet gjeld over tid (neste 5 år)
  const maxMonths = 60
  const chartData = Array.from({ length: maxMonths + 1 }, (_, i) => {
    const totalBal = debts.reduce((s, d) => {
      const plan = buildRepaymentPlan(d)
      const row = plan.rows[i - 1]
      return s + (i === 0 ? d.currentBalance : (row?.balance ?? 0))
    }, 0)
    return { month: i, totalBalance: Math.round(totalBal) }
  })

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Gjeld</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Legg til lån
        </Button>
      </div>

      {showAddForm && (
        <AddDebtForm
          onSave={(d) => { addDebt(d); setShowAddForm(false) }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Oversikt */}
      {debts.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Total gjeld</p>
                <p className="font-mono font-semibold text-red-400">{fmtNOK(totalBalance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Månedlig kostnad</p>
                <p className="font-mono font-semibold">{fmtNOK(totalMonthly)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Graf */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Samlet gjeld over tid</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v % 12 === 0 ? `År ${v / 12}` : ''}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => [fmtNOK(Number(v)), 'Gjeld']} labelFormatter={(l) => `Mnd ${l}`} />
                  <Line type="monotone" dataKey="totalBalance" stroke="#EF4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Lån-kort */}
      {debts.length === 0 && !showAddForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">Ingen lån registrert.</p>
            <Button size="sm" onClick={() => setShowAddForm(true)}>Legg til lån</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => {
            const currentRate = getCurrentRate(debt)
            const plan = buildRepaymentPlan(debt)
            const payoffYear = plan.payoffDate.getFullYear()
            const payoffMonth = plan.payoffDate.getMonth() + 1

            return (
              <Card key={debt.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{debt.creditor}</CardTitle>
                      <p className="text-xs text-muted-foreground">{DEBT_TYPE_LABELS[debt.type]}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                      onClick={() => removeDebt(debt.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <MiniStat label="Saldo" value={fmtNOK(debt.currentBalance)} />
                    <MiniStat label="Rente" value={`${currentRate.toFixed(2)}%`} />
                    <MiniStat label="Terminbeløp" value={fmtNOK(debt.monthlyPayment)} />
                    <MiniStat label="Innfris" value={`${String(payoffMonth).padStart(2, '0')}/${payoffYear}`} />
                  </div>

                  {/* Rentehistorikk */}
                  {debt.rateHistory.length > 1 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Rentehistorikk:</p>
                      {debt.rateHistory.map((r) => (
                        <div key={r.fromDate} className="text-xs text-muted-foreground flex gap-2">
                          <span>{r.fromDate}</span>
                          <span>{r.nominalRate}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {updatingRateFor === debt.id ? (
                      <UpdateRateForm
                        onSave={(entry) => {
                          updateDebtRate(debt.id, entry)
                          setUpdatingRateFor(null)
                        }}
                        onCancel={() => setUpdatingRateFor(null)}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setUpdatingRateFor(debt.id)}
                      >
                        Registrer renteendring
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Total rentekostnad: {fmtNOK(plan.totalInterestCost)}
                  </p>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono font-medium text-sm">{value}</p>
    </div>
  )
}

function AddDebtForm({ onSave, onCancel }: { onSave: (d: DebtAccount) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    creditor: '',
    type: 'studielaan' as DebtAccount['type'],
    originalAmount: 0,
    currentBalance: 0,
    rate: 5.5,
    monthlyPayment: 0,
    termFee: 0,
    startDate: new Date().toISOString().split('T')[0],
  })

  function f(k: keyof typeof form) {
    return {
      value: String(form[k]),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [k]: e.target.value })),
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Legg til lån</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Kreditor / navn</Label>
            <Input {...f('creditor')} placeholder="f.eks. Lånekassen" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as DebtAccount['type'] }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DEBT_TYPE_LABELS) as DebtAccount['type'][]).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{DEBT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rente %</Label>
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
              value={form.currentBalance}
              onChange={(e) => setForm((f) => ({ ...f, currentBalance: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Terminbeløp/mnd</Label>
            <Input
              type="number"
              value={form.monthlyPayment}
              onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Termingebyr</Label>
            <Input
              type="number"
              value={form.termFee}
              onChange={(e) => setForm((f) => ({ ...f, termFee: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Startdato</Label>
            <Input type="date" {...f('startDate')} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button
            size="sm"
            disabled={!form.creditor.trim() || form.currentBalance === 0}
            onClick={() =>
              onSave({
                id: crypto.randomUUID(),
                creditor: form.creditor.trim(),
                type: form.type,
                originalAmount: form.originalAmount || form.currentBalance,
                currentBalance: form.currentBalance,
                rateHistory: [{ fromDate: form.startDate, nominalRate: form.rate }],
                monthlyPayment: form.monthlyPayment,
                termFee: form.termFee,
                startDate: form.startDate,
              })
            }
          >
            Lagre
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UpdateRateForm({ onSave, onCancel }: { onSave: (e: DebtRateHistory) => void; onCancel: () => void }) {
  const [rate, setRate] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input type="date" className="h-8 text-xs w-36" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input
        type="number"
        step="0.1"
        className="h-8 text-xs w-20"
        placeholder="Rente %"
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
      />
      <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ fromDate: date, nominalRate: rate })}>OK</Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>×</Button>
    </div>
  )
}
