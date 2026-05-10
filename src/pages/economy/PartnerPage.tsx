import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useEconomyStore } from '@/application/useEconomyStore'
import { useAppStore } from '@/store/useAppStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PartnerDebt, PartnerAccount } from '@/types/economy'

// ── helpers ────────────────────────────────────────────────────────────────
function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + '\u00A0kr'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      <div>
        <Label className="text-xs">{label}</Label>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ── Debt list ──────────────────────────────────────────────────────────────
function DebtList() {
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
    const payment = parseFloat(newPayment) || 0
    const rate = parseFloat(newRate) || 0
    if (!newLabel.trim() || !balance) return
    addPartnerDebt({ id: crypto.randomUUID(), label: newLabel.trim(), currentBalance: balance, interestRate: rate, monthlyPayment: payment })
    setAdding(false)
    setNewLabel(''); setNewBalance(''); setNewRate(''); setNewPayment('')
  }

  function startEdit(d: PartnerDebt) {
    setEditingId(d.id)
    setEditFields({ label: d.label, currentBalance: d.currentBalance, interestRate: d.interestRate, monthlyPayment: d.monthlyPayment })
  }

  function saveEdit() {
    if (!editingId) return
    updatePartnerDebt(editingId, editFields)
    setEditingId(null)
  }

  return (
    <div className="space-y-2">
      {debts.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">Ingen gjeldsposter. Klikk «Legg til» for å starte.</p>
      )}

      {debts.map((d) => (
        <div key={d.id} className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-2">
          {editingId === d.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Navn</label>
                  <Input
                    className="h-7 text-xs"
                    value={editFields.label ?? ''}
                    onChange={(e) => setEditFields((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Restgjeld (kr)</label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={editFields.currentBalance ?? ''}
                    onChange={(e) => setEditFields((f) => ({ ...f, currentBalance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Rente (%/år)</label>
                  <Input
                    type="number"
                    step="0.1"
                    className="h-7 text-xs"
                    value={editFields.interestRate ?? ''}
                    onChange={(e) => setEditFields((f) => ({ ...f, interestRate: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Terminbeløp (kr/mnd)</label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={editFields.monthlyPayment ?? ''}
                    onChange={(e) => setEditFields((f) => ({ ...f, monthlyPayment: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>Avbryt</Button>
                <Button size="sm" className="h-6 text-xs px-2" onClick={saveEdit}>Lagre</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">{d.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtNOK(d.currentBalance)} · {d.interestRate.toFixed(1)}% · {fmtNOK(d.monthlyPayment)}/mnd
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(d)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removePartnerDebt(d.id)}
                  className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding && (
        <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ny gjeldspost</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Navn</label>
              <Input
                autoFocus
                className="h-7 text-xs"
                placeholder="f.eks. Studielån"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNew(); if (e.key === 'Escape') setAdding(false) }}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Restgjeld (kr)</label>
              <Input
                type="number"
                className="h-7 text-xs"
                placeholder="f.eks. 300000"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Rente (%/år)</label>
              <Input
                type="number"
                step="0.1"
                className="h-7 text-xs"
                placeholder="f.eks. 5.8"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Terminbeløp (kr/mnd)</label>
              <Input
                type="number"
                className="h-7 text-xs"
                placeholder="f.eks. 3200"
                value={newPayment}
                onChange={(e) => setNewPayment(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Avbryt</Button>
            <Button size="sm" className="h-7 text-xs" onClick={saveNew}>Legg til</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => { setAdding(true) }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Legg til gjeld
        </Button>
        {debts.length > 0 && (
          <div className="text-xs text-right">
            <span className="text-muted-foreground">Totalt: </span>
            <span className="font-medium text-red-400">{fmtNOK(totalDebt)}</span>
            <span className="text-muted-foreground ml-2">· {fmtNOK(totalPayment)}/mnd</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Savings accounts ───────────────────────────────────────────────────────
function SavingsAccounts() {
  const accounts = useEconomyStore((s) => s.partnerVeikart.accounts)
  const addPartnerAccount = useEconomyStore((s) => s.addPartnerAccount)
  const updatePartnerAccount = useEconomyStore((s) => s.updatePartnerAccount)
  const removePartnerAccount = useEconomyStore((s) => s.removePartnerAccount)

  return (
    <div className="space-y-2">
      {accounts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Ingen sparekontoer. Klikk «Ny konto» for å legge til.</p>
      )}
      {accounts.map((acc) => (
        <PartnerAccountRow
          key={acc.id}
          account={acc}
          onUpdate={(u) => updatePartnerAccount(acc.id, u)}
          onRemove={() => removePartnerAccount(acc.id)}
        />
      ))}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => addPartnerAccount({ id: crypto.randomUUID(), label: 'Ny konto', balance: 0, monthlyContribution: 0, rate: 3.5 })}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Ny konto
      </Button>
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

  function startEdit() {
    setDraft({ label: account.label, balance: account.balance, monthlyContribution: account.monthlyContribution, rate: account.rate, fromDate: account.fromDate, toDate: account.toDate })
    setEditing(true)
  }

  function save() {
    onUpdate(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground block mb-1">Kontonavn</label>
            <Input className="h-7 text-xs" value={draft.label ?? ''} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Saldo (kr)</label>
            <Input type="number" className="h-7 text-xs" value={draft.balance ?? ''} onChange={(e) => setDraft((d) => ({ ...d, balance: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Rente (%/år)</label>
            <Input type="number" step="0.1" className="h-7 text-xs" value={draft.rate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, rate: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Innskudd/mnd (kr)</label>
            <Input type="number" className="h-7 text-xs" value={draft.monthlyContribution ?? ''} onChange={(e) => setDraft((d) => ({ ...d, monthlyContribution: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div />
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Innskudd fra</label>
            <input type="month" className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" value={draft.fromDate?.slice(0, 7) ?? ''} onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value ? `${e.target.value}-01` : undefined }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Innskudd til</label>
            <input type="month" className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" value={draft.toDate?.slice(0, 7) ?? ''} onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value ? `${e.target.value}-01` : undefined }))} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(false)}>
            <X className="h-3 w-3 mr-1" /> Avbryt
          </Button>
          <Button size="sm" className="h-6 text-xs px-2" onClick={save}>
            <Check className="h-3 w-3 mr-1" /> Lagre
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
          {fmtNOK(account.balance)} saldo · {account.rate.toFixed(1)}% rente · {fmtNOK(account.monthlyContribution)}/mnd
          {(account.fromDate || account.toDate) && (
            <span className="text-amber-400 ml-1">
              {account.fromDate ? ` fra ${account.fromDate.slice(0, 7)}` : ''}
              {account.toDate ? ` til ${account.toDate.slice(0, 7)}` : ''}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export function PartnerPage() {
  const partnerVeikart = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)
  const setCurrentEconomyPage = useAppStore((s) => s.setCurrentEconomyPage)

  function updatePartner(updates: Partial<typeof partnerVeikart>) {
    setPartnerVeikart({ ...partnerVeikart, ...updates })
  }

  if (!partnerVeikart.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <p className="text-sm text-muted-foreground">Partner er ikke aktivert.</p>
        <Button size="sm" onClick={() => updatePartner({ enabled: true })}>
          Aktiver partner
        </Button>
        <p className="text-xs text-muted-foreground">
          Du kan også aktivere i{' '}
          <button
            className="underline hover:text-foreground"
            onClick={() => setCurrentEconomyPage('settings')}
          >
            Innstillinger
          </button>
          .
        </p>
      </div>
    )
  }

  const bsuAgeOk = !partnerVeikart.bsuBirthYear || (new Date().getFullYear() - partnerVeikart.bsuBirthYear) <= 33
  const totalSavings = partnerVeikart.accounts.reduce((s, a) => s + a.balance, 0) + (partnerVeikart.bsu ?? 0)
  const totalDebt = (partnerVeikart.debts ?? []).length > 0
    ? (partnerVeikart.debts ?? []).reduce((s, d) => s + d.currentBalance, 0)
    : partnerVeikart.debt ?? 0
  const totalMonthlyPayment = (partnerVeikart.debts ?? []).reduce((s, d) => s + d.monthlyPayment, 0)
  const totalMonthlySavings = partnerVeikart.accounts.reduce((s, a) => s + a.monthlyContribution, 0)
    + (partnerVeikart.bsuMonthlyContribution ?? 0)

  return (
    <div className="overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Årslønn', value: partnerVeikart.annualIncome > 0 ? fmtNOK(partnerVeikart.annualIncome) : '—' },
            { label: 'Sparing', value: totalSavings > 0 ? fmtNOK(totalSavings) : '—' },
            { label: 'Gjeld', value: totalDebt > 0 ? fmtNOK(totalDebt) : '—', red: true },
            { label: 'Netto EK', value: totalSavings - totalDebt > 0 ? fmtNOK(totalSavings - totalDebt) : '—', green: true },
          ].map(({ label, value, red, green }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-muted/10 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${red ? 'text-red-400' : green ? 'text-green-400' : ''}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Inntekt */}
        <Section title="Inntekt">
          <FieldRow label="Årslønn brutto" hint="Brukes til låneevne og maks kjøpesum">
            <Input
              type="number"
              className="h-8 text-sm"
              value={partnerVeikart.annualIncome || ''}
              onChange={(e) => updatePartner({ annualIncome: parseFloat(e.target.value) || 0 })}
              placeholder="f.eks. 650000"
            />
          </FieldRow>
          <FieldRow label="Årslønn netto" hint="Brukes til sparekraft og budsjett">
            <Input
              type="number"
              className="h-8 text-sm"
              value={partnerVeikart.annualNetIncome || ''}
              onChange={(e) => updatePartner({ annualNetIncome: parseFloat(e.target.value) || 0 })}
              placeholder={partnerVeikart.annualIncome ? String(Math.round(partnerVeikart.annualIncome * 0.67)) : 'f.eks. 440000'}
            />
          </FieldRow>
          {totalMonthlySavings > 0 && (
            <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
              Månedlig sparing: <span className="text-foreground font-medium">{fmtNOK(totalMonthlySavings)}/mnd</span>
              {partnerVeikart.annualNetIncome > 0 && (
                <span className="ml-2">
                  ({((totalMonthlySavings / (partnerVeikart.annualNetIncome / 12)) * 100).toFixed(0)}% av nettoinntekt)
                </span>
              )}
            </div>
          )}
        </Section>

        {/* Gjeld */}
        <Section title="Gjeld">
          <DebtList />
          {totalDebt > 0 && totalMonthlyPayment > 0 && partnerVeikart.annualNetIncome > 0 && (
            <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
              Gjeldsbetjening: <span className="text-red-400 font-medium">{fmtNOK(totalMonthlyPayment)}/mnd</span>
              <span className="ml-2">({((totalMonthlyPayment / (partnerVeikart.annualNetIncome / 12)) * 100).toFixed(0)}% av nettoinntekt)</span>
            </div>
          )}
        </Section>

        {/* Sparing */}
        <Section title="Sparekontoer">
          <SavingsAccounts />
        </Section>

        {/* BSU */}
        <Section title="BSU">
          <FieldRow label="Fødselsår" hint="Brukes til BSU-aldersgrense (maks 34 år)">
            <Input
              type="number"
              className="h-8 text-sm"
              value={partnerVeikart.bsuBirthYear ?? ''}
              onChange={(e) => updatePartner({ bsuBirthYear: parseInt(e.target.value) || undefined })}
              placeholder="f.eks. 1995"
            />
          </FieldRow>
          {!bsuAgeOk && (
            <p className="text-xs text-amber-400">Over BSU-aldersgrensen (34 år).</p>
          )}
          <FieldRow label="BSU-saldo (kr)">
            <Input
              type="number"
              className="h-8 text-sm"
              disabled={!bsuAgeOk}
              value={partnerVeikart.bsu || ''}
              onChange={(e) => updatePartner({ bsu: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </FieldRow>
          <FieldRow label="BSU-innskudd/mnd (kr)" hint={bsuAgeOk ? 'Maks 2 292 kr/mnd (27 500 kr/år)' : 'Ikke tilgjengelig over 34 år'}>
            <Input
              type="number"
              className="h-8 text-sm"
              disabled={!bsuAgeOk}
              value={partnerVeikart.bsuMonthlyContribution || ''}
              onChange={(e) => updatePartner({ bsuMonthlyContribution: parseFloat(e.target.value) || 0 })}
              placeholder={bsuAgeOk ? 'maks 2 292' : '0'}
            />
          </FieldRow>
        </Section>

      </div>
    </div>
  )
}
