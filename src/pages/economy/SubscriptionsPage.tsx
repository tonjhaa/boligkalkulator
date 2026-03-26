import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEconomyStore } from '@/application/useEconomyStore'
import type { SubscriptionEntry, InsuranceEntry } from '@/types/economy'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

const SUBSCRIPTION_CATEGORY_LABELS: Record<SubscriptionEntry['category'], string> = {
  streaming: 'Streaming',
  software: 'Software',
  spill: 'Spill',
  tjeneste: 'Tjeneste',
  annet: 'Annet',
}

const BILLING_CYCLE_LABELS: Record<SubscriptionEntry['billingCycle'], string> = {
  monthly: 'Månedlig',
  yearly: 'Årlig',
  variable: 'Variabel',
}

export function SubscriptionsPage() {
  const {
    subscriptions,
    insurances,
    addSubscription,
    updateSubscription,
    removeSubscription,
    addInsurance,
    updateInsurance,
    removeInsurance,
  } = useEconomyStore()

  const [showAddSub, setShowAddSub] = useState(false)
  const [showAddIns, setShowAddIns] = useState(false)
  const [editingInsId, setEditingInsId] = useState<string | null>(null)
  const [expandedInsId, setExpandedInsId] = useState<string | null>(null)

  const activeSubscriptions = subscriptions.filter((s) => s.isActive)
  const inactiveSubscriptions = subscriptions.filter((s) => !s.isActive)

  const currentYear = String(new Date().getFullYear())

  const monthlySubTotal = activeSubscriptions.reduce((s, sub) => s + sub.defaultMonthly, 0)
  const yearlyInsTotal = insurances
    .filter((i) => i.isActive)
    .reduce((s, ins) => s + (ins.yearlyAmounts[currentYear] ?? 0), 0)

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h2 className="font-semibold">Abonnement og forsikringer</h2>

      {/* Oversikt */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Abonnement/mnd</p>
            <p className="font-mono font-semibold">{fmtNOK(monthlySubTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Forsikring/år</p>
            <p className="font-mono font-semibold">{fmtNOK(yearlyInsTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Abonnement */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Abonnement</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddSub(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Legg til
        </Button>
      </div>

      {showAddSub && (
        <AddSubscriptionForm
          onSave={(s) => { addSubscription(s); setShowAddSub(false) }}
          onCancel={() => setShowAddSub(false)}
        />
      )}

      {subscriptions.length === 0 && !showAddSub && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Ingen abonnement registrert.</p>
            <Button size="sm" onClick={() => setShowAddSub(true)}>Legg til abonnement</Button>
          </CardContent>
        </Card>
      )}

      {activeSubscriptions.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {activeSubscriptions.map((sub) => (
                  <SubscriptionRow
                    key={sub.id}
                    sub={sub}
                    onToggle={() => updateSubscription(sub.id, { isActive: false })}
                    onRemove={() => removeSubscription(sub.id)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td className="px-3 py-2 font-medium text-xs" colSpan={2}>Sum aktive</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {fmtNOK(monthlySubTotal)}/mnd
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {inactiveSubscriptions.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Inaktive abonnement</p>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm opacity-60">
                <tbody>
                  {inactiveSubscriptions.map((sub) => (
                    <SubscriptionRow
                      key={sub.id}
                      sub={sub}
                      onToggle={() => updateSubscription(sub.id, { isActive: true })}
                      onRemove={() => removeSubscription(sub.id)}
                    />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Forsikringer */}
      <div className="flex items-center justify-between mt-2">
        <h3 className="font-medium text-sm">Forsikringer</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddIns(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Legg til
        </Button>
      </div>

      {showAddIns && (
        <AddInsuranceForm
          onSave={(ins) => { addInsurance(ins); setShowAddIns(false) }}
          onCancel={() => setShowAddIns(false)}
        />
      )}

      {insurances.length === 0 && !showAddIns && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Ingen forsikringer registrert.</p>
          </CardContent>
        </Card>
      )}

      {insurances.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-xs">Forsikring</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Leverandør</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">{currentYear}/år</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {insurances.map((ins) => {
                  const yearlyAmt = ins.yearlyAmounts[currentYear] ?? 0
                  if (editingInsId === ins.id) {
                    return (
                      <tr key={ins.id}>
                        <td colSpan={4} className="px-3 py-2">
                          <EditInsuranceForm
                            ins={ins}
                            currentYear={currentYear}
                            onSave={(updates) => { updateInsurance(ins.id, updates); setEditingInsId(null) }}
                            onCancel={() => setEditingInsId(null)}
                          />
                        </td>
                      </tr>
                    )
                  }
                  const allYears = Object.keys(ins.yearlyAmounts).sort()
                  const prevYear = String(parseInt(currentYear) - 1)
                  const prevAmt = ins.yearlyAmounts[prevYear]
                  const diff = prevAmt != null && yearlyAmt > 0 ? yearlyAmt - prevAmt : null
                  const isExpanded = expandedInsId === ins.id
                  return (
                    <>
                      <tr key={ins.id} className={`border-b border-border/50 ${isExpanded ? '' : 'last:border-0'} ${!ins.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {allYears.length > 1 && (
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setExpandedInsId(isExpanded ? null : ins.id)}
                              >
                                {isExpanded
                                  ? <ChevronDown className="h-3 w-3" />
                                  : <ChevronRight className="h-3 w-3" />}
                              </button>
                            )}
                            {ins.type}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{ins.provider}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          <div>
                            {yearlyAmt > 0 ? fmtNOK(yearlyAmt) : '—'}
                            {diff !== null && (
                              <span className={`ml-1.5 text-xs font-normal ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {diff > 0 ? '+' : ''}{Math.round(diff).toLocaleString('no-NO')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingInsId(ins.id)}
                              title="Rediger"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground"
                              onClick={() => updateInsurance(ins.id, { isActive: !ins.isActive })}
                              title={ins.isActive ? 'Deaktiver' : 'Aktiver'}
                            >
                              {ins.isActive
                                ? <ToggleRight className="h-3.5 w-3.5 text-green-500" />
                                : <ToggleLeft className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                              onClick={() => removeInsurance(ins.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/50 bg-muted/20">
                          <td colSpan={4} className="px-6 py-2">
                            <div className="flex gap-6 text-xs">
                              {allYears.map((yr) => {
                                const amt = ins.yearlyAmounts[yr]
                                const prevAmt = ins.yearlyAmounts[String(parseInt(yr) - 1)]
                                const d = prevAmt != null ? amt - prevAmt : null
                                return (
                                  <div key={yr} className="text-center">
                                    <p className="text-muted-foreground">{yr}</p>
                                    <p className="font-mono font-medium">{Math.round(amt).toLocaleString('no-NO')}</p>
                                    {d !== null && (
                                      <p className={d > 0 ? 'text-red-400' : d < 0 ? 'text-green-500' : 'text-muted-foreground'}>
                                        {d > 0 ? '+' : ''}{Math.round(d).toLocaleString('no-NO')}
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td className="px-3 py-2 font-medium text-xs" colSpan={2}>Sum aktive</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {fmtNOK(yearlyInsTotal)}/år
                    <span className="text-muted-foreground font-normal ml-1 text-xs">
                      ({fmtNOK(Math.round(yearlyInsTotal / 12))}/mnd)
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// SUB-KOMPONENTER
// ------------------------------------------------------------

function SubscriptionRow({
  sub,
  onToggle,
  onRemove,
}: {
  sub: SubscriptionEntry
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="px-3 py-2">
        <div>
          <p className="font-medium">{sub.name}</p>
          <p className="text-xs text-muted-foreground">
            {SUBSCRIPTION_CATEGORY_LABELS[sub.category]} · {BILLING_CYCLE_LABELS[sub.billingCycle]}
          </p>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {Math.round(sub.defaultMonthly).toLocaleString('no-NO')} kr/mnd
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={onToggle}
            title={sub.isActive ? 'Deaktiver' : 'Aktiver'}
          >
            {sub.isActive
              ? <ToggleRight className="h-3.5 w-3.5 text-green-500" />
              : <ToggleLeft className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function AddSubscriptionForm({ onSave, onCancel }: { onSave: (s: SubscriptionEntry) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: '',
    category: 'tjeneste' as SubscriptionEntry['category'],
    defaultMonthly: 0,
    billingCycle: 'monthly' as SubscriptionEntry['billingCycle'],
  })

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Nytt abonnement</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="f.eks. Netflix"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kategori</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as SubscriptionEntry['category'] }))}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(SUBSCRIPTION_CATEGORY_LABELS) as [SubscriptionEntry['category'], string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fakturering</Label>
            <Select
              value={form.billingCycle}
              onValueChange={(v) => setForm((f) => ({ ...f, billingCycle: v as SubscriptionEntry['billingCycle'] }))}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(BILLING_CYCLE_LABELS) as [SubscriptionEntry['billingCycle'], string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Beløp/mnd</Label>
            <Input
              type="number"
              value={form.defaultMonthly}
              onChange={(e) => setForm((f) => ({ ...f, defaultMonthly: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button
            size="sm"
            disabled={!form.name.trim()}
            onClick={() =>
              onSave({
                id: crypto.randomUUID(),
                name: form.name.trim(),
                category: form.category,
                isActive: true,
                monthlyAmounts: {},
                defaultMonthly: form.defaultMonthly,
                billingCycle: form.billingCycle,
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

function EditInsuranceForm({
  ins,
  currentYear,
  onSave,
  onCancel,
}: {
  ins: InsuranceEntry
  currentYear: string
  onSave: (updates: Partial<InsuranceEntry>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    provider: ins.provider,
    type: ins.type,
    yearlyAmount: ins.yearlyAmounts[currentYear] ?? 0,
  })

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium">Rediger forsikring</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Leverandør</Label>
          <Input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Årsbeløp {currentYear}</Label>
          <Input
            type="number"
            value={form.yearlyAmount}
            onChange={(e) => setForm((f) => ({ ...f, yearlyAmount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
        <Button
          size="sm"
          disabled={!form.provider.trim() || !form.type.trim()}
          onClick={() =>
            onSave({
              provider: form.provider.trim(),
              type: form.type.trim(),
              yearlyAmounts: { ...ins.yearlyAmounts, [currentYear]: form.yearlyAmount },
            })
          }
        >
          Lagre
        </Button>
      </div>
    </div>
  )
}

function AddInsuranceForm({ onSave, onCancel }: { onSave: (ins: InsuranceEntry) => void; onCancel: () => void }) {
  const currentYear = String(new Date().getFullYear())
  const [form, setForm] = useState({ provider: '', type: '', yearlyAmount: 0 })

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Ny forsikring</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Leverandør</Label>
            <Input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="f.eks. FREMTIND" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="f.eks. Personforsikring" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Årsbeløp {currentYear}</Label>
            <Input
              type="number"
              value={form.yearlyAmount}
              onChange={(e) => setForm((f) => ({ ...f, yearlyAmount: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button
            size="sm"
            disabled={!form.provider.trim() || !form.type.trim()}
            onClick={() =>
              onSave({
                id: crypto.randomUUID(),
                provider: form.provider.trim(),
                type: form.type.trim(),
                yearlyAmounts: { [currentYear]: form.yearlyAmount },
                isActive: true,
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
