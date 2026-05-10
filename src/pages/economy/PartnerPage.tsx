import { useState, useRef } from 'react'
import {
  Plus, Trash2, Pencil, Check, X, Upload,
  LayoutDashboard, Receipt, Palmtree, Clipboard,
  PiggyBank, CreditCard, FileText, TrendingUp,
} from 'lucide-react'
import { useEconomyStore } from '@/application/useEconomyStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type {
  PartnerDebt, PartnerAccount, PartnerBudgetLine,
  PartnerBudgetCategory, PartnerAbsenceRecord, PartnerTaxSettlement,
} from '@/types/economy'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return Math.round(n).toLocaleString('no-NO') + '\u00A0kr'
}

const BUDGET_CATEGORIES: { value: PartnerBudgetCategory; label: string }[] = [
  { value: 'bolig',       label: 'Bolig' },
  { value: 'transport',   label: 'Transport' },
  { value: 'mat',         label: 'Mat & dagligvarer' },
  { value: 'helse',       label: 'Helse' },
  { value: 'abonnement',  label: 'Abonnementer' },
  { value: 'forsikring',  label: 'Forsikring' },
  { value: 'klær',        label: 'Klær & sko' },
  { value: 'fritid',      label: 'Fritid & hobby' },
  { value: 'annet',       label: 'Annet' },
]

const ABSENCE_TYPE_LABELS: Record<PartnerAbsenceRecord['type'], string> = {
  syk:         'Sykemelding',
  egenmelding: 'Egenmelding',
  permisjon:   'Permisjon',
  ferie:       'Ferie',
  annet:       'Annet',
}

// ── Dashbord-tab ───────────────────────────────────────────────────────────
function DashbordTab() {
  const p = useEconomyStore((s) => s.partnerVeikart)
  const monthlyGross = p.annualIncome / 12
  const monthlyNet = p.annualNetIncome / 12
  const tax = p.taxWithholding ?? Math.max(0, monthlyGross - monthlyNet)
  const pension = p.pensionPercent ? (monthlyGross * p.pensionPercent) / 100 : 0
  const union = p.unionFee ?? 0
  const totalSavings = p.accounts.reduce((s, a) => s + a.balance, 0) + (p.bsu ?? 0)
  const totalDebt =
    (p.debts ?? []).length > 0
      ? (p.debts ?? []).reduce((s, d) => s + d.currentBalance, 0)
      : (p.debt ?? 0)
  const monthlySavings =
    p.accounts.reduce((s, a) => s + a.monthlyContribution, 0) + (p.bsuMonthlyContribution ?? 0)
  const monthlyDebtPayment = (p.debts ?? []).reduce((s, d) => s + d.monthlyPayment, 0)
  const budgetExpenses = (p.budgetLines ?? []).reduce((s, l) => s + l.amount, 0)
  const netBalance = monthlyNet - monthlyDebtPayment - monthlySavings - budgetExpenses
  const feriepenger = ((p.feriepengerGrunnlag ?? 0) * (p.feriepengerRate ?? 10.2)) / 100

  if (monthlyNet === 0 && totalSavings === 0 && totalDebt === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Fyll inn data i de andre fanene for å se oversikten.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stat-kort */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Årslønn brutto</p>
          <p className="text-sm font-semibold mt-0.5">{p.annualIncome > 0 ? fmt(p.annualIncome) : '—'}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Netto / mnd</p>
          <p className="text-sm font-semibold mt-0.5">{monthlyNet > 0 ? fmt(monthlyNet) : '—'}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total sparing</p>
          <p className={cn('text-sm font-semibold mt-0.5', totalSavings > 0 ? 'text-green-400' : '')}>
            {totalSavings > 0 ? fmt(totalSavings) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Samlet gjeld</p>
          <p className={cn('text-sm font-semibold mt-0.5', totalDebt > 0 ? 'text-red-400' : '')}>
            {totalDebt > 0 ? fmt(totalDebt) : '—'}
          </p>
        </div>
      </div>

      {/* Feriepenger */}
      {feriepenger > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3 flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Feriepenger (estimert)</span>
          <span className="font-semibold text-amber-400">{fmt(feriepenger)}</span>
        </div>
      )}

      {/* Månedsoversikt */}
      {monthlyNet > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Månedlig flyt</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Netto inntekt</span>
              <span className="text-green-400 font-medium">+ {fmt(monthlyNet)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Skatt</span><span>- {fmt(tax)}</span>
              </div>
            )}
            {pension > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Pensjon ({p.pensionPercent}%)</span><span>- {fmt(pension)}</span>
              </div>
            )}
            {union > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Fagforening</span><span>- {fmt(union)}</span>
              </div>
            )}
            {monthlyDebtPayment > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gjeldsbetjening</span>
                <span className="text-red-400">- {fmt(monthlyDebtPayment)}</span>
              </div>
            )}
            {monthlySavings > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sparing</span>
                <span className="text-blue-400">- {fmt(monthlySavings)}</span>
              </div>
            )}
            {budgetExpenses > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faste utgifter</span>
                <span className="text-amber-400">- {fmt(budgetExpenses)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold">
              <span>Disponibelt</span>
              <span className={netBalance >= 0 ? 'text-green-400' : 'text-red-400'}>
                {netBalance >= 0 ? '+' : ''}{fmt(netBalance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lønn-tab ───────────────────────────────────────────────────────────────
function LonnTab() {
  const p = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)
  const fileRef = useRef<HTMLInputElement>(null)

  function update(updates: Partial<typeof p>) {
    setPartnerVeikart({ ...p, ...updates })
  }

  const monthlyGross = Math.round(p.annualIncome / 12)
  const monthlyNet = Math.round(p.annualNetIncome / 12)
  const impliedTax = Math.max(0, monthlyGross - monthlyNet)

  return (
    <div className="space-y-4">
      {/* Slipp-import */}
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/5 p-4 text-center space-y-2">
        <Upload className="h-6 w-6 mx-auto text-muted-foreground/60" />
        <div>
          <p className="text-xs font-medium">Last opp lønnsslipp</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Send slippen til meg, så setter jeg opp automatisk import for hennes format.
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileRef.current?.click()}>
          Velg PDF
        </Button>
      </div>

      {/* Arbeidsgiver */}
      <div className="space-y-1">
        <Label className="text-xs">Arbeidsgiver</Label>
        <Input
          className="h-8 text-sm"
          placeholder="f.eks. Oslo kommune"
          value={p.employer ?? ''}
          onChange={(e) => update({ employer: e.target.value })}
        />
      </div>

      {/* Lønn-felt */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Årslønn brutto</Label>
          <Input
            type="number"
            className="h-8 text-sm"
            placeholder="f.eks. 650000"
            value={p.annualIncome || ''}
            onChange={(e) => update({ annualIncome: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Årslønn netto</Label>
          <Input
            type="number"
            className="h-8 text-sm"
            placeholder={p.annualIncome ? String(Math.round(p.annualIncome * 0.67)) : 'f.eks. 440000'}
            value={p.annualNetIncome || ''}
            onChange={(e) => update({ annualNetIncome: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Månedlig skattetrekk (kr)</Label>
          <Input
            type="number"
            className="h-8 text-sm"
            placeholder={impliedTax > 0 ? String(impliedTax) : 'f.eks. 8000'}
            value={p.taxWithholding || ''}
            onChange={(e) => update({ taxWithholding: parseFloat(e.target.value) || 0 })}
          />
          {impliedTax > 0 && !p.taxWithholding && (
            <p className="text-[10px] text-muted-foreground">Estimert fra brutto − netto: {fmt(impliedTax)}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pensjonsprosent (%)</Label>
          <Input
            type="number"
            step="0.1"
            className="h-8 text-sm"
            placeholder="f.eks. 2"
            value={p.pensionPercent || ''}
            onChange={(e) => update({ pensionPercent: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <Label className="text-xs">Fagforeningskontingent (kr/mnd)</Label>
          <Input
            type="number"
            className="h-8 text-sm"
            placeholder="f.eks. 500"
            value={p.unionFee || ''}
            onChange={(e) => update({ unionFee: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* Månedlig oppsummering */}
      {monthlyGross > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-1.5 text-xs">
          <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Månedlig lønn</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Brutto</span><span>{fmt(monthlyGross)}</span></div>
          {(p.taxWithholding ?? impliedTax) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Skattetrekk</span><span>- {fmt(p.taxWithholding ?? impliedTax)}</span>
            </div>
          )}
          {(p.pensionPercent ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Pensjon</span><span>- {fmt(monthlyGross * (p.pensionPercent ?? 0) / 100)}</span>
            </div>
          )}
          {(p.unionFee ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Fagforening</span><span>- {fmt(p.unionFee ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/40 pt-1 font-semibold">
            <span>Netto utbetalt</span>
            <span className="text-green-400">{fmt(monthlyNet || monthlyGross)}</span>
          </div>
        </div>
      )}

      {/* BSU */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">BSU</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Fødselsår</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              placeholder="f.eks. 1995"
              value={p.bsuBirthYear ?? ''}
              onChange={(e) => update({ bsuBirthYear: parseInt(e.target.value) || undefined })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">BSU-saldo (kr)</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              placeholder="0"
              value={p.bsu || ''}
              onChange={(e) => update({ bsu: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">BSU/mnd (kr)</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              placeholder="maks 2 292"
              value={p.bsuMonthlyContribution || ''}
              onChange={(e) => update({ bsuMonthlyContribution: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Feriepenger-tab ────────────────────────────────────────────────────────
const FERIEPENGER_RATES = [
  { value: 10.2,  label: '10,2 % (standard)' },
  { value: 12,    label: '12 % (60 år+)' },
  { value: 14.3,  label: '14,3 % (off.sektor 60+)' },
]

function FeriepengerTab() {
  const p = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)

  function update(updates: Partial<typeof p>) {
    setPartnerVeikart({ ...p, ...updates })
  }

  const grunnlag = p.feriepengerGrunnlag ?? 0
  const rate = p.feriepengerRate ?? 10.2
  const feriepenger = (grunnlag * rate) / 100
  const ferietrekkMnd = grunnlag / 12
  const skattetrekk = feriepenger * 0.78  // ca. 22 % skatt på feriepenger

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Feriepengegrunnlag (brutto lønn forrige år)</Label>
          <Input
            type="number"
            className="h-8 text-sm"
            placeholder="f.eks. 620000"
            value={grunnlag || ''}
            onChange={(e) => update({ feriepengerGrunnlag: parseFloat(e.target.value) || 0 })}
          />
          {!grunnlag && p.annualIncome > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Tip: Årslønn brutto er {fmt(p.annualIncome)} — bruk dette som estimat.
            </p>
          )}
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Feriepengersats</Label>
          <select
            className="h-8 w-full text-sm rounded border border-border bg-background px-2 outline-none"
            value={rate}
            onChange={(e) => update({ feriepengerRate: parseFloat(e.target.value) })}
          >
            {FERIEPENGER_RATES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {grunnlag > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beregning</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grunnlag</span>
              <span>{fmt(grunnlag)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sats</span>
              <span>{rate} %</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold">
              <span>Feriepenger brutto</span>
              <span className="text-amber-400">{fmt(feriepenger)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Ca. netto (78 %)</span>
              <span>{fmt(skattetrekk)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Ferietrekk / mnd (÷ 12)</span>
              <span>- {fmt(ferietrekkMnd)}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold">
              <span>Netto ekstra juni</span>
              <span className={feriepenger - ferietrekkMnd > 0 ? 'text-green-400' : 'text-red-400'}>
                {fmt(feriepenger - ferietrekkMnd)}
              </span>
            </div>
          </div>
        </div>
      )}

      {!grunnlag && (
        <p className="text-xs text-muted-foreground italic text-center py-4">
          Fyll inn feriepengegrunnlag for å beregne.
        </p>
      )}
    </div>
  )
}

// ── Budsjett-tab ───────────────────────────────────────────────────────────
function BudsjettTab() {
  const p = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newCat, setNewCat] = useState<PartnerBudgetCategory>('bolig')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<PartnerBudgetLine>>({})

  const lines = p.budgetLines ?? []

  function updateLines(next: PartnerBudgetLine[]) {
    setPartnerVeikart({ ...p, budgetLines: next })
  }

  function saveNew() {
    const amt = parseFloat(newAmount)
    if (!newLabel.trim() || !amt) return
    updateLines([
      ...lines,
      { id: crypto.randomUUID(), label: newLabel.trim(), category: newCat, amount: Math.abs(amt) },
    ])
    setAdding(false)
    setNewLabel('')
    setNewAmount('')
  }

  function saveEdit() {
    if (!editingId) return
    updateLines(lines.map((l) => (l.id === editingId ? { ...l, ...editFields } : l)))
    setEditingId(null)
  }

  const monthlyNet = Math.round(p.annualNetIncome / 12)
  const totalExpenses = lines.reduce((s, l) => s + l.amount, 0)
  const debtPayment = (p.debts ?? []).reduce((s, d) => s + d.monthlyPayment, 0)
  const savings =
    p.accounts.reduce((s, a) => s + a.monthlyContribution, 0) + (p.bsuMonthlyContribution ?? 0)
  const available = monthlyNet - totalExpenses - debtPayment - savings

  const byCategory = BUDGET_CATEGORIES.map((cat) => ({
    ...cat,
    lines: lines.filter((l) => l.category === cat.value),
    total: lines.filter((l) => l.category === cat.value).reduce((s, l) => s + l.amount, 0),
  })).filter((c) => c.lines.length > 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      {monthlyNet > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Netto inntekt</span>
            <span className="text-green-400">{fmt(monthlyNet)}</span>
          </div>
          {debtPayment > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Gjeld</span><span>- {fmt(debtPayment)}</span>
            </div>
          )}
          {savings > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Sparing</span><span>- {fmt(savings)}</span>
            </div>
          )}
          {totalExpenses > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Faste utgifter</span><span>- {fmt(totalExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold">
            <span>Disponibelt</span>
            <span className={available >= 0 ? 'text-green-400' : 'text-red-400'}>
              {available >= 0 ? '+' : ''}{fmt(available)}
            </span>
          </div>
        </div>
      )}

      {/* Lines */}
      <div className="space-y-1">
        {lines.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground italic">Ingen budsjettposter.</p>
        )}
        {lines.map((line) =>
          editingId === line.id ? (
            <div key={line.id} className="rounded border border-border bg-muted/10 p-2.5 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    autoFocus
                    className="h-7 text-xs"
                    value={editFields.label ?? line.label}
                    onChange={(e) => setEditFields((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={editFields.amount ?? line.amount}
                    onChange={(e) => setEditFields((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="col-span-3">
                  <select
                    className="h-7 w-full text-xs rounded border border-border bg-background px-2 outline-none"
                    value={editFields.category ?? line.category}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, category: e.target.value as PartnerBudgetCategory }))
                    }
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>
                  Avbryt
                </Button>
                <Button size="sm" className="h-6 text-xs px-2" onClick={saveEdit}>Lagre</Button>
              </div>
            </div>
          ) : (
            <div
              key={line.id}
              className="flex items-center justify-between px-3 py-2 rounded border border-border/30 hover:bg-muted/10 text-xs group"
            >
              <div>
                <span className="font-medium">{line.label}</span>
                <span className="text-muted-foreground ml-2">
                  {BUDGET_CATEGORIES.find((c) => c.value === line.category)?.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">{fmt(line.amount)}/mnd</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(line.id); setEditFields({}) }}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => updateLines(lines.filter((l) => l.id !== line.id))}
                    className="p-0.5 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground">Beskrivelse</label>
              <Input
                autoFocus
                className="h-7 text-xs"
                placeholder="f.eks. Husleie"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNew(); if (e.key === 'Escape') setAdding(false) }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Beløp/mnd</label>
              <Input
                type="number"
                className="h-7 text-xs"
                placeholder="f.eks. 9500"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div className="col-span-3 space-y-1">
              <label className="text-[10px] text-muted-foreground">Kategori</label>
              <select
                className="h-7 w-full text-xs rounded border border-border bg-background px-2 outline-none"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value as PartnerBudgetCategory)}
              >
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button size="sm" className="h-7 text-xs" onClick={saveNew}>Legg til</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Legg til post
        </Button>
        {totalExpenses > 0 && (
          <span className="text-xs text-muted-foreground">
            Totalt: <span className="text-foreground font-medium">{fmt(totalExpenses)}/mnd</span>
          </span>
        )}
      </div>

      {byCategory.length > 3 && (
        <div className="rounded border border-border/30 overflow-hidden">
          <div className="bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Per kategori
          </div>
          {byCategory.map((c) => (
            <div key={c.value} className="flex justify-between px-3 py-1 text-xs border-t border-border/20">
              <span className="text-muted-foreground">{c.label}</span>
              <span>{fmt(c.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sparing-tab ────────────────────────────────────────────────────────────
function SparingTab() {
  const accounts = useEconomyStore((s) => s.partnerVeikart.accounts)
  const addPartnerAccount = useEconomyStore((s) => s.addPartnerAccount)
  const updatePartnerAccount = useEconomyStore((s) => s.updatePartnerAccount)
  const removePartnerAccount = useEconomyStore((s) => s.removePartnerAccount)

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const totalMonthly = accounts.reduce((s, a) => s + a.monthlyContribution, 0)

  return (
    <div className="space-y-2">
      {accounts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Ingen sparekontoer.</p>
      )}
      {accounts.map((acc) => (
        <PartnerAccountRow
          key={acc.id}
          account={acc}
          onUpdate={(u) => updatePartnerAccount(acc.id, u)}
          onRemove={() => removePartnerAccount(acc.id)}
        />
      ))}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() =>
            addPartnerAccount({
              id: crypto.randomUUID(),
              label: 'Ny konto',
              balance: 0,
              monthlyContribution: 0,
              rate: 3.5,
            })
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Ny konto
        </Button>
        {accounts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {fmt(totalBalance)} total · <span className="text-foreground">{fmt(totalMonthly)}/mnd</span>
          </span>
        )}
      </div>
    </div>
  )
}

function PartnerAccountRow({
  account,
  onUpdate,
  onRemove,
}: {
  account: PartnerAccount
  onUpdate: (u: Partial<PartnerAccount>) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<PartnerAccount>>({})

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground block mb-1">Kontonavn</label>
            <Input
              className="h-7 text-xs"
              value={draft.label ?? account.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Saldo (kr)</label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={draft.balance ?? account.balance}
              onChange={(e) => setDraft((d) => ({ ...d, balance: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Rente (%/år)</label>
            <Input
              type="number"
              step="0.1"
              className="h-7 text-xs"
              value={draft.rate ?? account.rate}
              onChange={(e) => setDraft((d) => ({ ...d, rate: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Innskudd/mnd</label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={draft.monthlyContribution ?? account.monthlyContribution}
              onChange={(e) =>
                setDraft((d) => ({ ...d, monthlyContribution: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          <div />
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Fra (mnd)</label>
            <input
              type="month"
              className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none"
              value={draft.fromDate?.slice(0, 7) ?? account.fromDate?.slice(0, 7) ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, fromDate: e.target.value ? `${e.target.value}-01` : undefined }))
              }
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Til (mnd)</label>
            <input
              type="month"
              className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none"
              value={draft.toDate?.slice(0, 7) ?? account.toDate?.slice(0, 7) ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, toDate: e.target.value ? `${e.target.value}-01` : undefined }))
              }
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(false)}>
            <X className="h-3 w-3 mr-1" />Avbryt
          </Button>
          <Button
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => { onUpdate(draft); setEditing(false) }}
          >
            <Check className="h-3 w-3 mr-1" />Lagre
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
      <div>
        <p className="text-xs font-medium">{account.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {fmt(account.balance)} · {account.rate}% · {fmt(account.monthlyContribution)}/mnd
          {(account.fromDate || account.toDate) && (
            <span className="text-amber-400 ml-1">
              {account.fromDate?.slice(0, 7)} → {account.toDate?.slice(0, 7)}
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => { setDraft({}); setEditing(true) }}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Gjeld-tab ──────────────────────────────────────────────────────────────
function GjeldTab() {
  const debts = useEconomyStore((s) => s.partnerVeikart.debts ?? [])
  const addPartnerDebt = useEconomyStore((s) => s.addPartnerDebt)
  const updatePartnerDebt = useEconomyStore((s) => s.updatePartnerDebt)
  const removePartnerDebt = useEconomyStore((s) => s.removePartnerDebt)

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newBalance, setNewBalance] = useState('')
  const [newRate, setNewRate] = useState('')
  const [newPayment, setNewPayment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<PartnerDebt>>({})

  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0)
  const totalPayment = debts.reduce((s, d) => s + d.monthlyPayment, 0)

  function saveNew() {
    const balance = parseFloat(newBalance)
    if (!newLabel.trim() || !balance) return
    addPartnerDebt({
      id: crypto.randomUUID(),
      label: newLabel.trim(),
      currentBalance: balance,
      interestRate: parseFloat(newRate) || 0,
      monthlyPayment: parseFloat(newPayment) || 0,
    })
    setAdding(false)
    setNewLabel('')
    setNewBalance('')
    setNewRate('')
    setNewPayment('')
  }

  return (
    <div className="space-y-2">
      {debts.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">Ingen gjeldsposter.</p>
      )}
      {debts.map((d) =>
        editingId === d.id ? (
          <div key={d.id} className="rounded border border-border bg-muted/10 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {(['label', 'currentBalance', 'interestRate', 'monthlyPayment'] as const).map((field) => (
                <div key={field}>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    {{ label: 'Navn', currentBalance: 'Restgjeld (kr)', interestRate: 'Rente (%)', monthlyPayment: 'Terminbeløp (kr/mnd)' }[field]}
                  </label>
                  <Input
                    type={field === 'label' ? 'text' : 'number'}
                    step={field === 'interestRate' ? '0.1' : undefined}
                    className="h-7 text-xs"
                    value={String(editFields[field] ?? d[field])}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        [field]: field === 'label' ? e.target.value : parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>
                Avbryt
              </Button>
              <Button
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => { updatePartnerDebt(d.id, editFields); setEditingId(null) }}
              >
                Lagre
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/5 px-3 py-2"
          >
            <div>
              <p className="text-xs font-medium">{d.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {fmt(d.currentBalance)} · {d.interestRate.toFixed(1)}% · {fmt(d.monthlyPayment)}/mnd
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setEditingId(d.id); setEditFields({}) }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => removePartnerDebt(d.id)}
                className="p-1 text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      )}
      {adding && (
        <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Navn</label>
              <Input autoFocus className="h-7 text-xs" placeholder="f.eks. Studielån" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Restgjeld (kr)</label>
              <Input type="number" className="h-7 text-xs" placeholder="f.eks. 300000" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Rente (%/år)</label>
              <Input type="number" step="0.1" className="h-7 text-xs" placeholder="f.eks. 5.8" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Terminbeløp (kr/mnd)</label>
              <Input type="number" className="h-7 text-xs" placeholder="f.eks. 3200" value={newPayment} onChange={(e) => setNewPayment(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button size="sm" className="h-7 text-xs" onClick={saveNew}>Legg til</Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Legg til gjeld
        </Button>
        {debts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {fmt(totalDebt)} total · <span className="text-red-400">{fmt(totalPayment)}/mnd</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Fravær-tab ─────────────────────────────────────────────────────────────
function FravaerTab() {
  const p = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)

  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<PartnerAbsenceRecord['type']>('egenmelding')
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const records = p.absenceRecords ?? []

  function updateRecords(next: PartnerAbsenceRecord[]) {
    setPartnerVeikart({ ...p, absenceRecords: next })
  }

  function saveNew() {
    if (!newFrom || !newTo) return
    const fromMs = new Date(newFrom).getTime()
    const toMs = new Date(newTo).getTime()
    const days = Math.max(1, Math.round((toMs - fromMs) / 86400000) + 1)
    updateRecords([
      ...records,
      {
        id: crypto.randomUUID(),
        type: newType,
        fromDate: newFrom,
        toDate: newTo,
        days,
        notes: newNotes || undefined,
      },
    ])
    setAdding(false)
    setNewFrom('')
    setNewTo('')
    setNewNotes('')
  }

  const totalDays = records.reduce((s, r) => s + (r.days ?? 0), 0)
  const byType = Object.entries(ABSENCE_TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    days: records.filter((r) => r.type === type).reduce((s, r) => s + (r.days ?? 0), 0),
  })).filter((t) => t.days > 0)

  return (
    <div className="space-y-3">
      {records.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Oppsummering</p>
          <div className="flex flex-wrap gap-3 text-xs">
            {byType.map((t) => (
              <div key={t.type}>
                <span className="text-muted-foreground">{t.label}: </span>
                <span className="font-medium">{t.days} dager</span>
              </div>
            ))}
            {byType.length > 1 && (
              <div>
                <span className="text-muted-foreground">Totalt: </span>
                <span className="font-medium">{totalDays} dager</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {records.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground italic">Ingen fraværsregistreringer.</p>
        )}
        {records.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded border border-border/30 bg-muted/5 px-3 py-2 text-xs group"
          >
            <div>
              <span className="font-medium">{ABSENCE_TYPE_LABELS[r.type]}</span>
              <span className="text-muted-foreground ml-2">
                {r.fromDate} → {r.toDate}
                {r.days && <span className="ml-1">({r.days} dager)</span>}
              </span>
              {r.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{r.notes}</p>}
            </div>
            <button
              onClick={() => updateRecords(records.filter((x) => x.id !== r.id))}
              className="p-1 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground">Type</label>
              <select
                className="h-7 w-full text-xs rounded border border-border bg-background px-2 outline-none"
                value={newType}
                onChange={(e) => setNewType(e.target.value as PartnerAbsenceRecord['type'])}
              >
                {Object.entries(ABSENCE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Fra</label>
              <input
                type="date"
                className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Til</label>
              <input
                type="date"
                className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground">Notat (valgfritt)</label>
              <Input
                className="h-7 text-xs"
                placeholder="f.eks. nakkeoperasjon"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button size="sm" className="h-7 text-xs" onClick={saveNew}>Legg til</Button>
          </div>
        </div>
      )}

      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Registrer fravær
      </Button>
    </div>
  )
}

// ── Skatt-tab ──────────────────────────────────────────────────────────────
function SkattTab() {
  const p = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)

  const [adding, setAdding] = useState(false)
  const [newYear, setNewYear] = useState(String(new Date().getFullYear() - 1))
  const [newAmount, setNewAmount] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<PartnerTaxSettlement>>({})

  const settlements = p.taxSettlements ?? []

  function updateSettlements(next: PartnerTaxSettlement[]) {
    setPartnerVeikart({ ...p, taxSettlements: next })
  }

  function saveNew() {
    const amount = parseFloat(newAmount)
    if (!newYear || isNaN(amount)) return
    updateSettlements([
      ...settlements,
      { id: crypto.randomUUID(), year: parseInt(newYear), amount },
    ])
    setAdding(false)
    setNewAmount('')
  }

  const avg = settlements.length > 0
    ? settlements.reduce((s, r) => s + r.amount, 0) / settlements.length
    : null

  const sorted = [...settlements].sort((a, b) => b.year - a.year)

  return (
    <div className="space-y-3">
      {avg !== null && (
        <div className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3 flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Snitt per år</span>
          <span className={cn('font-semibold', avg >= 0 ? 'text-green-400' : 'text-red-400')}>
            {avg >= 0 ? '+' : ''}{fmt(avg)}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {sorted.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground italic">Ingen skatteoppgjør registrert.</p>
        )}
        {sorted.map((r) =>
          editingId === r.id ? (
            <div key={r.id} className="rounded border border-border bg-muted/10 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">År</label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={editFields.year ?? r.year}
                    onChange={(e) => setEditFields((f) => ({ ...f, year: parseInt(e.target.value) || r.year }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Beløp (+ = til gode)</label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={editFields.amount ?? r.amount}
                    onChange={(e) => setEditFields((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>Avbryt</Button>
                <Button
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    updateSettlements(settlements.map((s) => (s.id === r.id ? { ...s, ...editFields } : s)))
                    setEditingId(null)
                  }}
                >
                  Lagre
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={r.id}
              className="flex items-center justify-between rounded border border-border/30 bg-muted/5 px-3 py-2 text-xs group"
            >
              <div>
                <span className="font-medium">{r.year}</span>
                <span
                  className={cn('ml-3 font-semibold', r.amount >= 0 ? 'text-green-400' : 'text-red-400')}
                >
                  {r.amount >= 0 ? '+' : ''}{fmt(r.amount)}
                </span>
                <span className="text-muted-foreground ml-1.5 text-[10px]">
                  {r.amount >= 0 ? 'til gode' : 'restskatt'}
                </span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingId(r.id); setEditFields({}) }}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => updateSettlements(settlements.filter((s) => s.id !== r.id))}
                  className="p-1 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">År</label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Beløp (+ = til gode, − = restskatt)</label>
              <Input
                autoFocus
                type="number"
                className="h-7 text-xs"
                placeholder="f.eks. 4200"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button size="sm" className="h-7 text-xs" onClick={saveNew}>Legg til</Button>
          </div>
        </div>
      )}

      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Legg til oppgjør
      </Button>
    </div>
  )
}

// ── Hoved-komponent ────────────────────────────────────────────────────────
type Tab = 'dashbord' | 'lonn' | 'feriepenger' | 'budsjett' | 'sparing' | 'gjeld' | 'fravaer' | 'skatt'

const TABS: { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'dashbord',    label: 'Dashbord',    Icon: LayoutDashboard },
  { key: 'lonn',        label: 'Lønn',        Icon: Receipt },
  { key: 'feriepenger', label: 'Feriepenger', Icon: Palmtree },
  { key: 'budsjett',    label: 'Budsjett',    Icon: Clipboard },
  { key: 'sparing',     label: 'Sparing',     Icon: PiggyBank },
  { key: 'gjeld',       label: 'Gjeld',       Icon: CreditCard },
  { key: 'fravaer',     label: 'Fravær',      Icon: FileText },
  { key: 'skatt',       label: 'Skatt',       Icon: TrendingUp },
]

export function PartnerPage() {
  const partnerVeikart = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)
  const [tab, setTab] = useState<Tab>('dashbord')

  // Aktiver automatisk første gang siden åpnes
  if (!partnerVeikart.enabled) {
    setPartnerVeikart({ ...partnerVeikart, enabled: true })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-nav */}
      <nav className="flex items-center gap-1 border-b border-border bg-card px-3 shrink-0 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
              tab === key
                ? 'border-violet-400 text-violet-400'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <div className="ml-auto pl-3 text-xs text-violet-400/60 font-medium shrink-0">
          {partnerVeikart.employer || 'Partner'}
        </div>
      </nav>

      {/* Innhold */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground/80">
            {TABS.find((t) => t.key === tab)?.label}
          </p>
          {tab === 'dashbord'    && <DashbordTab />}
          {tab === 'lonn'        && <LonnTab />}
          {tab === 'feriepenger' && <FeriepengerTab />}
          {tab === 'budsjett'    && <BudsjettTab />}
          {tab === 'sparing'     && <SparingTab />}
          {tab === 'gjeld'       && <GjeldTab />}
          {tab === 'fravaer'     && <FravaerTab />}
          {tab === 'skatt'       && <SkattTab />}
        </div>
      </div>
    </div>
  )
}
