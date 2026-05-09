import { useState, useMemo } from 'react'
import {
  Gift, Plus, Trash2, Pencil, AlertTriangle, Info,
  Calendar, Users, Settings, TrendingUp, Wallet, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGiftStore } from '@/application/useGiftStore'
import {
  OCCASION_LABELS, RELATIONSHIP_LABELS, CLOSENESS_LABELS,
  LIFE_PHASE_LABELS, OWNERSHIP_LABELS, STATUS_LABELS, DISTRIBUTION_LABELS,
  DEFAULT_WEIGHT_RULES,
} from '@/domain/gifts/defaultWeights'
import {
  calculateGiftAmount, calculateGiftResult, calculateActualVsPlanned,
  giftAmountExplanation, roundGiftAmount,
} from '@/domain/gifts/giftCalculator'
import type {
  GiftRecipient, GiftEvent, Occasion, RelationshipType,
  ClosenessLevel, LifePhase, Ownership, EventStatus,
} from '@/types/gifts'

// ─── Formattering ───────────────────────────────────────────────

function fmtNOK(v: number) {
  return Math.round(v).toLocaleString('no-NO') + ' kr'
}

function fmtMonth(m: number) {
  const names = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']
  return names[m - 1] ?? ''
}

// ─── Interne tabs ───────────────────────────────────────────────

type GiftTab = 'oversikt' | 'mottakere' | 'hendelser' | 'fordeling' | 'spareplan' | 'satser'

const TABS: { id: GiftTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'oversikt', label: 'Oversikt', Icon: TrendingUp },
  { id: 'mottakere', label: 'Mottakere', Icon: Users },
  { id: 'hendelser', label: 'Hendelser', Icon: Calendar },
  { id: 'fordeling', label: 'Fordeling', Icon: Wallet },
  { id: 'spareplan', label: 'Spareplan', Icon: Gift },
  { id: 'satser', label: 'Satser', Icon: Settings },
]

// ─── Oversikt ───────────────────────────────────────────────────

function OverviewTab() {
  const events = useGiftStore((s) => s.events)
  const settings = useGiftStore((s) => s.settings)
  const recipients = useGiftStore((s) => s.recipients)

  const result = useMemo(() => calculateGiftResult(events, settings), [events, settings])
  const avp = useMemo(() => calculateActualVsPlanned(events), [events])

  const recipientMap = useMemo(
    () => new Map(recipients.map((r) => [r.id, r])),
    [recipients]
  )

  const upcoming = useMemo(() => {
    const today = new Date()
    const in60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
    return events
      .filter((e) => e.status === 'planlagt' && e.date)
      .filter((e) => { const d = new Date(e.date!); return d >= today && d <= in60 })
      .sort((a, b) => a.date!.localeCompare(b.date!))
      .slice(0, 5)
  }, [events])

  const nameA = settings.memberA.name
  const nameB = settings.memberB.name
  const hasIncome = settings.memberA.monthlyNetIncome > 0 || settings.memberB.monthlyNetIncome > 0

  return (
    <div className="space-y-4 p-4">
      {/* Advarsler */}
      {result.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {w}
        </div>
      ))}

      {/* Innsikter */}
      {result.insights.map((ins, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {ins}
        </div>
      ))}

      {/* Nøkkeltall */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard label="Årsbudsjett" value={fmtNOK(result.annualTotal)} sub="uten buffer" />
        <MetricCard label="Med buffer" value={fmtNOK(result.annualTotalWithBuffer)} sub={`${settings.bufferPercent}% ekstra`} />
        <MetricCard label="Månedlig sparing" value={fmtNOK(result.personAMonthlySaving + result.personBMonthlySaving)} sub="totalt" />
        <MetricCard label={`${nameA} per mnd`} value={fmtNOK(result.personAMonthlySaving)} colorClass="text-blue-400" />
        <MetricCard label={`${nameB} per mnd`} value={fmtNOK(result.personBMonthlySaving)} colorClass="text-violet-400" />
        {avp.planned > 0 && (
          <MetricCard
            label="Avvik (kjøpt)"
            value={fmtNOK(Math.abs(avp.deviation))}
            sub={avp.deviation > 0 ? 'over plan' : avp.deviation < 0 ? 'under plan' : 'på plan'}
            colorClass={avp.deviation > 0 ? 'text-red-400' : avp.deviation < 0 ? 'text-green-400' : 'text-foreground'}
          />
        )}
      </div>

      {!hasIncome && (
        <p className="text-xs text-muted-foreground bg-muted/20 rounded px-3 py-2">
          Tips: Legg inn nettoinntekt under <b>Fordeling</b> for å beregne rettferdig månedlig sparing per person.
        </p>
      )}

      {/* Kommende hendelser */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Kommende (60 dager)</p>
          <div className="space-y-1.5">
            {upcoming.map((e) => {
              const rec = recipientMap.get(e.recipientId)
              const amount = e.manualAmount ?? e.calculatedAmount
              return (
                <div key={e.id} className="flex items-center justify-between rounded border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                  <div>
                    <span className="font-medium">{rec?.name ?? '—'}</span>
                    <span className="text-muted-foreground ml-2">{OCCASION_LABELS[e.occasion]}</span>
                    {e.date && <span className="text-muted-foreground ml-2">{e.date}</span>}
                  </div>
                  <span className="font-mono text-foreground">{fmtNOK(amount)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gaveintensive måneder */}
      {result.monthlyBreakdown.some((m) => m.isHeavy) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Gaveintensive måneder</p>
          <div className="flex flex-wrap gap-2">
            {result.monthlyBreakdown.filter((m) => m.isHeavy).map((m) => (
              <div key={m.month} className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400">
                <Gift className="h-3 w-3" />
                {fmtMonth(m.month)} — {fmtNOK(m.totalCost)}
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Gift className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>Legg til mottakere og hendelser for å beregne gavebudsjettet.</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, colorClass }: {
  label: string; value: string; sub?: string; colorClass?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-lg font-bold font-mono', colorClass ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Mottakere ──────────────────────────────────────────────────

function RecipientsTab() {
  const recipients = useGiftStore((s) => s.recipients)
  const addRecipient = useGiftStore((s) => s.addRecipient)
  const updateRecipient = useGiftStore((s) => s.updateRecipient)
  const removeRecipient = useGiftStore((s) => s.removeRecipient)
  const events = useGiftStore((s) => s.events)

  const [editing, setEditing] = useState<GiftRecipient | null>(null)
  const [adding, setAdding] = useState(false)

  function handleSave(r: GiftRecipient) {
    if (r.id && recipients.find((x) => x.id === r.id)) {
      updateRecipient(r.id, r)
    } else {
      addRecipient({ ...r, id: crypto.randomUUID() })
    }
    setEditing(null)
    setAdding(false)
  }

  function nextEvent(id: string): string {
    const today = new Date().toISOString().split('T')[0]
    const ev = events
      .filter((e) => e.recipientId === id && e.status === 'planlagt')
      .filter((e) => (e.date ?? '9999') >= today)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]
    if (!ev) return '—'
    return `${OCCASION_LABELS[ev.occasion]}${ev.date ? ' · ' + ev.date : ''}`
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{recipients.length} mottakere</p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Legg til
        </Button>
      </div>

      <div className="space-y-2">
        {recipients.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card/30 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{r.name}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
                  r.ownership === 'A' ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' :
                  r.ownership === 'B' ? 'border-violet-500/40 text-violet-400 bg-violet-500/10' :
                  'border-border text-muted-foreground'
                )}>
                  {OWNERSHIP_LABELS[r.ownership]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {RELATIONSHIP_LABELS[r.relationshipType]} · {CLOSENESS_LABELS[r.closeness]} · {LIFE_PHASE_LABELS[r.lifePhase]}
              </p>
              <p className="text-[11px] text-muted-foreground">Neste: {nextEvent(r.id)}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-400"
                onClick={() => removeRecipient(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {recipients.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Ingen mottakere ennå</p>
        )}
      </div>

      <RecipientModal
        open={adding || editing !== null}
        initial={editing ?? undefined}
        onSave={handleSave}
        onClose={() => { setAdding(false); setEditing(null) }}
      />
    </div>
  )
}

function RecipientModal({
  open, initial, onSave, onClose,
}: {
  open: boolean
  initial?: GiftRecipient
  onSave: (r: GiftRecipient) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [relType, setRelType] = useState<RelationshipType>(initial?.relationshipType ?? 'venn')
  const [closeness, setCloseness] = useState<ClosenessLevel>(initial?.closeness ?? 'normal')
  const [lifePhase, setLifePhase] = useState<LifePhase>(initial?.lifePhase ?? 'voksen')
  const [ownership, setOwnership] = useState<Ownership>(initial?.ownership ?? 'felles')
  const [birthYear, setBirthYear] = useState(initial?.birthYear ? String(initial.birthYear) : '')
  const [birthMonth, setBirthMonth] = useState(initial?.birthMonth ? String(initial.birthMonth) : '')
  const [birthday, setBirthday] = useState(initial?.receivesBirthdayGift ?? true)
  const [christmas, setChristmas] = useState(initial?.receivesChristmasGift ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  // Reset when initial changes
  useState(() => {
    setName(initial?.name ?? '')
    setRelType(initial?.relationshipType ?? 'venn')
    setCloseness(initial?.closeness ?? 'normal')
    setLifePhase(initial?.lifePhase ?? 'voksen')
    setOwnership(initial?.ownership ?? 'felles')
    setBirthYear(initial?.birthYear ? String(initial.birthYear) : '')
    setBirthMonth(initial?.birthMonth ? String(initial.birthMonth) : '')
    setBirthday(initial?.receivesBirthdayGift ?? true)
    setChristmas(initial?.receivesChristmasGift ?? false)
    setNotes(initial?.notes ?? '')
  })

  function handleSave() {
    if (!name.trim()) return
    const r: GiftRecipient = {
      id: initial?.id ?? '',
      name: name.trim(),
      relationshipType: relType,
      closeness,
      lifePhase,
      ownership,
      birthYear: birthYear ? parseInt(birthYear) : undefined,
      birthMonth: birthMonth ? parseInt(birthMonth) : undefined,
      receivesBirthdayGift: birthday,
      receivesChristmasGift: christmas,
      notes: notes.trim() || undefined,
    }
    onSave(r)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Rediger mottaker' : 'Ny mottaker'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="f.eks. Mamma" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Relasjon</Label>
              <Select value={relType} onValueChange={(v) => setRelType(v as RelationshipType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(RELATIONSHIP_LABELS) as RelationshipType[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{RELATIONSHIP_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nærhet</Label>
              <Select value={closeness} onValueChange={(v) => setCloseness(v as ClosenessLevel)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLOSENESS_LABELS) as ClosenessLevel[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{CLOSENESS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Livsfase</Label>
              <Select value={lifePhase} onValueChange={(v) => setLifePhase(v as LifePhase)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LIFE_PHASE_LABELS) as LifePhase[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{LIFE_PHASE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Eierskap</Label>
              <Select value={ownership} onValueChange={(v) => setOwnership(v as Ownership)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['A', 'B', 'felles'] as Ownership[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{OWNERSHIP_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Fødselsår</Label>
              <Input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="f.eks. 1955"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bursdagsmåned</Label>
              <Select value={birthMonth} onValueChange={setBirthMonth}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{fmtMonth(i + 1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={birthday} onCheckedChange={setBirthday} />
              Bursdagsgave
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={christmas} onCheckedChange={setChristmas} />
              Julegave
            </label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notater</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Valgfritt" className="h-8 text-xs" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Avbryt</Button>
          <Button size="sm" disabled={!name.trim()} onClick={handleSave}>Lagre</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Hendelser ──────────────────────────────────────────────────

function EventsTab() {
  const events = useGiftStore((s) => s.events)
  const recipients = useGiftStore((s) => s.recipients)
  const settings = useGiftStore((s) => s.settings)
  const weightRules = useGiftStore((s) => s.weightRules)
  const addEvent = useGiftStore((s) => s.addEvent)
  const updateEvent = useGiftStore((s) => s.updateEvent)
  const removeEvent = useGiftStore((s) => s.removeEvent)

  const [editing, setEditing] = useState<GiftEvent | null>(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<EventStatus | 'alle'>('alle')

  const recipientMap = useMemo(() => new Map(recipients.map((r) => [r.id, r])), [recipients])

  const filtered = useMemo(() => {
    const evs = filter === 'alle' ? events : events.filter((e) => e.status === filter)
    return [...evs].sort((a, b) => {
      const da = a.date ?? `9999-${String(a.month ?? 12).padStart(2, '0')}-01`
      const db = b.date ?? `9999-${String(b.month ?? 12).padStart(2, '0')}-01`
      return da.localeCompare(db)
    })
  }, [events, filter])

  function handleSave(ev: GiftEvent) {
    if (events.find((e) => e.id === ev.id)) {
      updateEvent(ev.id, ev)
    } else {
      addEvent({ ...ev, id: crypto.randomUUID() })
    }
    setEditing(null)
    setAdding(false)
  }

  const totalPlanned = filtered.reduce((s, e) => s + (e.manualAmount ?? e.calculatedAmount), 0)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['alle', 'planlagt', 'kjøpt', 'droppet'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'text-xs px-2.5 py-1 rounded border transition-colors',
                filter === s
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'alle' ? 'Alle' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <Button size="sm" disabled={recipients.length === 0} onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Legg til
        </Button>
      </div>

      {recipients.length === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/20 rounded px-3 py-2">
          Legg til mottakere først for å registrere gavehendelser.
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((ev) => {
          const rec = recipientMap.get(ev.recipientId)
          const amount = ev.manualAmount ?? ev.calculatedAmount
          return (
            <div key={ev.id} className={cn(
              'rounded-lg border px-3 py-2.5',
              ev.status === 'kjøpt' ? 'border-green-500/30 bg-green-500/5' :
              ev.status === 'droppet' ? 'border-border/30 opacity-50 bg-muted/10' :
              'border-border bg-card/30'
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{rec?.name ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{OCCASION_LABELS[ev.occasion]}</span>
                    <span className={cn(
                      'text-[10px] px-1 py-0.5 rounded border',
                      ev.ownership === 'A' ? 'border-blue-500/40 text-blue-400' :
                      ev.ownership === 'B' ? 'border-violet-500/40 text-violet-400' :
                      'border-border text-muted-foreground'
                    )}>
                      {OWNERSHIP_LABELS[ev.ownership]}
                    </span>
                    {ev.isLocked && <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1 rounded">Låst</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">
                      {ev.date ?? (ev.month ? fmtMonth(ev.month) : 'Udatert')}
                    </span>
                    <span className="text-[11px] font-mono text-foreground">{fmtNOK(amount)}</span>
                    {ev.manualAmount !== undefined && (
                      <span className="text-[10px] text-amber-400">Manuelt</span>
                    )}
                    {ev.actualAmount !== undefined && (
                      <span className={cn('text-[11px] font-mono', ev.actualAmount > amount ? 'text-red-400' : 'text-green-400')}>
                        Faktisk: {fmtNOK(ev.actualAmount)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(ev)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => removeEvent(ev.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Ingen hendelser</p>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex justify-end pt-1 border-t border-border/40">
          <span className="text-xs text-muted-foreground">Total: <span className="font-mono text-foreground">{fmtNOK(totalPlanned)}</span></span>
        </div>
      )}

      <EventModal
        open={adding || editing !== null}
        initial={editing ?? undefined}
        recipients={recipients}
        settings={settings}
        weightRules={weightRules}
        onSave={handleSave}
        onClose={() => { setAdding(false); setEditing(null) }}
      />
    </div>
  )
}

function EventModal({
  open, initial, recipients, settings, weightRules, onSave, onClose,
}: {
  open: boolean
  initial?: GiftEvent
  recipients: GiftRecipient[]
  settings: ReturnType<typeof useGiftStore.getState>['settings']
  weightRules: ReturnType<typeof useGiftStore.getState>['weightRules']
  onSave: (ev: GiftEvent) => void
  onClose: () => void
}) {
  const [recipientId, setRecipientId] = useState(initial?.recipientId ?? (recipients[0]?.id ?? ''))
  const [occasion, setOccasion] = useState<Occasion>(initial?.occasion ?? 'bursdag')
  const [date, setDate] = useState(initial?.date ?? '')
  const [month, setMonth] = useState(initial?.month ? String(initial.month) : '')
  const [ownership, setOwnership] = useState<Ownership>(initial?.ownership ?? 'felles')
  const [manualAmount, setManualAmount] = useState(initial?.manualAmount != null ? String(initial.manualAmount) : '')
  const [isLocked, setIsLocked] = useState(initial?.isLocked ?? false)
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? 'planlagt')
  const [actualAmount, setActualAmount] = useState(initial?.actualAmount != null ? String(initial.actualAmount) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const recipient = recipients.find((r) => r.id === recipientId)

  const suggestedAmount = useMemo(() => {
    if (!recipient) return 0
    const tempEvent: GiftEvent = {
      id: '', recipientId, occasion,
      ownership, calculatedAmount: 0, isLocked: false, status: 'planlagt',
      date: date || undefined, month: month ? parseInt(month) : undefined,
    }
    const raw = calculateGiftAmount(tempEvent, recipient, weightRules)
    return roundGiftAmount(raw, settings.roundingNearest)
  }, [recipient, occasion, ownership, date, month, weightRules, settings.roundingNearest, recipientId])

  function handleSave() {
    if (!recipientId) return
    const ev: GiftEvent = {
      id: initial?.id ?? '',
      recipientId,
      occasion,
      date: date || undefined,
      month: month ? parseInt(month) : undefined,
      ownership,
      calculatedAmount: suggestedAmount,
      manualAmount: manualAmount ? parseFloat(manualAmount) : undefined,
      isLocked,
      status,
      actualAmount: actualAmount ? parseFloat(actualAmount) : undefined,
      notes: notes.trim() || undefined,
    }
    onSave(ev)
  }

  const finalAmount = manualAmount ? parseFloat(manualAmount) || 0 : suggestedAmount

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Rediger hendelse' : 'Ny gavehendelse'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Mottaker</Label>
            <Select value={recipientId} onValueChange={(v) => {
              setRecipientId(v)
              const r = recipients.find((x) => x.id === v)
              if (r) setOwnership(r.ownership)
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {recipients.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Anledning</Label>
              <Select value={occasion} onValueChange={(v) => setOccasion(v as Occasion)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(OCCASION_LABELS) as Occasion[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{OCCASION_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Eierskap</Label>
              <Select value={ownership} onValueChange={(v) => setOwnership(v as Ownership)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['A', 'B', 'felles'] as Ownership[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{OWNERSHIP_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Dato</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Eller måned</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">— Ingen —</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{fmtMonth(i + 1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Beregnet beløp */}
          <div className="rounded bg-muted/20 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Foreslått beløp: <span className="font-mono text-foreground font-semibold">{fmtNOK(suggestedAmount)}</span></p>
            {recipient && (
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                {giftAmountExplanation(
                  { id: '', recipientId, occasion, ownership, calculatedAmount: 0, isLocked: false, status: 'planlagt' },
                  recipient, weightRules
                )}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Manuelt beløp (overstyrer forslag)</Label>
            <Input
              type="number"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder={String(suggestedAmount)}
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EventStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['planlagt', 'kjøpt', 'droppet'] as EventStatus[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status === 'kjøpt' && (
              <div className="space-y-1">
                <Label className="text-xs">Faktisk beløp</Label>
                <Input
                  type="number"
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                  placeholder={String(finalAmount)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={isLocked} onCheckedChange={setIsLocked} />
            Lås beløp (ekskluder fra tak-normalisering)
          </label>

          <div className="space-y-1">
            <Label className="text-xs">Notater</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Valgfritt" className="h-8 text-xs" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Avbryt</Button>
          <Button size="sm" disabled={!recipientId} onClick={handleSave}>Lagre</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Fordeling ──────────────────────────────────────────────────

function DistributionTab() {
  const settings = useGiftStore((s) => s.settings)
  const updateSettings = useGiftStore((s) => s.updateSettings)

  const [nameA, setNameA] = useState(settings.memberA.name)
  const [incomeA, setIncomeA] = useState(settings.memberA.monthlyNetIncome > 0 ? String(settings.memberA.monthlyNetIncome) : '')
  const [nameB, setNameB] = useState(settings.memberB.name)
  const [incomeB, setIncomeB] = useState(settings.memberB.monthlyNetIncome > 0 ? String(settings.memberB.monthlyNetIncome) : '')

  function saveMembers() {
    updateSettings({
      memberA: { name: nameA.trim() || 'Person A', monthlyNetIncome: parseFloat(incomeA) || 0 },
      memberB: { name: nameB.trim() || 'Person B', monthlyNetIncome: parseFloat(incomeB) || 0 },
    })
  }

  const totalIncome = (parseFloat(incomeA) || 0) + (parseFloat(incomeB) || 0)
  const pA = totalIncome > 0 ? ((parseFloat(incomeA) || 0) / totalIncome * 100).toFixed(0) : 50
  const pB = totalIncome > 0 ? ((parseFloat(incomeB) || 0) / totalIncome * 100).toFixed(0) : 50

  return (
    <div className="p-4 space-y-5">
      {/* Inntekter */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nettoinntekt</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Navn (Person A)</Label>
              <Input value={nameA} onChange={(e) => setNameA(e.target.value)} onBlur={saveMembers} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Netto månedslønn</Label>
              <Input
                type="number"
                value={incomeA}
                onChange={(e) => setIncomeA(e.target.value)}
                onBlur={saveMembers}
                placeholder="f.eks. 38000"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Navn (Person B)</Label>
              <Input value={nameB} onChange={(e) => setNameB(e.target.value)} onBlur={saveMembers} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Netto månedslønn</Label>
              <Input
                type="number"
                value={incomeB}
                onChange={(e) => setIncomeB(e.target.value)}
                onBlur={saveMembers}
                placeholder="f.eks. 30000"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
        {totalIncome > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pA}%` }} />
            </div>
            <span className="text-[11px] text-blue-400">{pA}%</span>
            <span className="text-[11px] text-muted-foreground">vs</span>
            <span className="text-[11px] text-violet-400">{pB}%</span>
          </div>
        )}
      </div>

      {/* Fordelingsmodell */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fordelingsmodell</p>
        <div className="space-y-2">
          {(Object.keys(DISTRIBUTION_LABELS) as import('@/types/gifts').DistributionModel[]).map((model) => (
            <button
              key={model}
              onClick={() => updateSettings({ distributionModel: model })}
              className={cn(
                'w-full text-left rounded border px-3 py-2.5 text-xs transition-colors',
                settings.distributionModel === model
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <p className="font-medium">{DISTRIBUTION_LABELS[model]}</p>
              <p className="text-[10px] mt-0.5 text-muted-foreground">
                {model === '50_50' && 'Alle gaver deles likt uavhengig av relasjon og inntekt.'}
                {model === 'inntekt' && 'Alle gaver fordeles etter nettoinntektsandel.'}
                {model === 'eierskap' && 'Eide gaver betales fullt av eieren. Felles gaver etter inntekt.'}
                {model === 'hybrid' && 'Eide gaver: 80 % eier, 20 % partner. Felles gaver: etter inntekt. Anbefalt.'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Buffer og tak */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buffer og maks ramme</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bufferprosent (%)</Label>
            <Input
              type="number"
              value={settings.bufferPercent}
              onChange={(e) => updateSettings({ bufferPercent: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Standard: 12 %</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Maks årsbudsjett (kr)</Label>
            <Input
              type="number"
              value={settings.annualCap ?? ''}
              onChange={(e) => updateSettings({ annualCap: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="Ingen grense"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Avrunding (kr)</Label>
            <Select
              value={String(settings.roundingNearest)}
              onValueChange={(v) => updateSettings({ roundingNearest: parseInt(v) as 50 | 100 })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="50" className="text-xs">50 kr</SelectItem>
                <SelectItem value="100" className="text-xs">100 kr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Eieransvar (hybrid)</Label>
            <Select
              value={String(settings.primaryResponsibilityShare)}
              onValueChange={(v) => {
                const h = parseFloat(v)
                updateSettings({ primaryResponsibilityShare: h, supportShare: 1 - h })
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.6" className="text-xs">60/40</SelectItem>
                <SelectItem value="0.7" className="text-xs">70/30</SelectItem>
                <SelectItem value="0.8" className="text-xs">80/20 (standard)</SelectItem>
                <SelectItem value="0.9" className="text-xs">90/10</SelectItem>
                <SelectItem value="1.0" className="text-xs">100/0</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
        <p>Rettferdig fordeling tar hensyn til både inntekt og hvem relasjonen tilhører.</p>
        <p>Fellesgaver fordeles etter netto lønn. Egne familiehendelser fordeles {Math.round(settings.primaryResponsibilityShare * 100)}/{Math.round(settings.supportShare * 100)}.</p>
        <p>Du kan alltid overstyre foreslåtte beløp på enkelt-hendelser.</p>
      </div>
    </div>
  )
}

// ─── Spareplan ──────────────────────────────────────────────────

function SavingsPlanTab() {
  const events = useGiftStore((s) => s.events)
  const settings = useGiftStore((s) => s.settings)

  const result = useMemo(() => calculateGiftResult(events, settings), [events, settings])
  const [showAll, setShowAll] = useState(false)

  const nameA = settings.memberA.name
  const nameB = settings.memberB.name

  const months = showAll ? result.monthlyBreakdown : result.monthlyBreakdown.filter((m) => m.totalCost > 0)

  return (
    <div className="p-4 space-y-4">
      {/* Spareoppsummering */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard label="Totalt per mnd" value={fmtNOK(result.personAMonthlySaving + result.personBMonthlySaving)} />
        <MetricCard label={`${nameA} per mnd`} value={fmtNOK(result.personAMonthlySaving)} colorClass="text-blue-400" />
        <MetricCard label={`${nameB} per mnd`} value={fmtNOK(result.personBMonthlySaving)} colorClass="text-violet-400" />
        <MetricCard label="Årsbudsjett" value={fmtNOK(result.annualTotal)} />
        <MetricCard label="Med buffer" value={fmtNOK(result.annualTotalWithBuffer)} />
        <MetricCard label={`${nameA} år`} value={fmtNOK(result.personATotal)} colorClass="text-blue-400" />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Flat månedlig sparing anbefales som utgangspunkt. Månedlig beløp er jevnt fordelt over 12 måneder, inkludert {settings.bufferPercent} % buffer.
      </p>

      {/* Månedsoversikt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gavebelastning per måned</p>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showAll ? <><ChevronUp className="h-3 w-3" />Skjul tomme</> : <><ChevronDown className="h-3 w-3" />Vis alle</>}
          </button>
        </div>
        <div className="space-y-1.5">
          {months.map((m) => (
            <div
              key={m.month}
              className={cn(
                'rounded border px-3 py-2 text-xs',
                m.isHeavy ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-muted/10'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium w-20">{fmtMonth(m.month)}</span>
                  {m.isHeavy && <span className="text-amber-400 text-[10px]">Gaveintensiv</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground text-blue-400/70">{fmtNOK(m.personAShare)}</span>
                  <span className="text-muted-foreground text-violet-400/70">{fmtNOK(m.personBShare)}</span>
                  <span className="font-mono font-medium w-20 text-right">{fmtNOK(m.totalCost)}</span>
                </div>
              </div>
              {m.events.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.events.map((e) => (
                    <span key={e.id} className="text-[10px] text-muted-foreground border border-border/30 rounded px-1 py-0.5">
                      {e.notes || OCCASION_LABELS[e.occasion]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {months.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Ingen hendelser med dato</p>
          )}
        </div>
      </div>

      {/* Avvik */}
      {(() => {
        const avp = calculateActualVsPlanned(events)
        if (avp.planned === 0) return null
        return (
          <div className="rounded border border-border bg-muted/10 px-3 py-2.5 text-xs">
            <p className="font-semibold mb-1">Faktisk vs planlagt (kjøpte gaver)</p>
            <div className="flex gap-6">
              <div>
                <p className="text-muted-foreground">Planlagt</p>
                <p className="font-mono">{fmtNOK(avp.planned)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Faktisk</p>
                <p className="font-mono">{fmtNOK(avp.actual)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avvik</p>
                <p className={cn('font-mono', avp.deviation > 0 ? 'text-red-400' : 'text-green-400')}>
                  {avp.deviation > 0 ? '+' : ''}{fmtNOK(avp.deviation)}
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Satser ─────────────────────────────────────────────────────

function RatesTab() {
  const weightRules = useGiftStore((s) => s.weightRules)
  const updateWeightRules = useGiftStore((s) => s.updateWeightRules)

  const [expanded, setExpanded] = useState<string | null>('anledning')

  function toggleSection(s: string) {
    setExpanded(expanded === s ? null : s)
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Satsene brukes til å beregne foreslåtte gavebeløp. Du kan justere enkelt-verdier.
      </p>

      <WeightSection
        title="Grunnbeløp per anledning (kr)"
        expanded={expanded === 'anledning'}
        onToggle={() => toggleSection('anledning')}
      >
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(weightRules.occasionBaseAmounts) as Occasion[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground truncate">{OCCASION_LABELS[k]}</span>
              <Input
                type="number"
                value={weightRules.occasionBaseAmounts[k]}
                onChange={(e) => updateWeightRules({
                  occasionBaseAmounts: { ...weightRules.occasionBaseAmounts, [k]: parseFloat(e.target.value) || 0 },
                })}
                className="h-7 text-xs w-20 text-right"
              />
            </div>
          ))}
        </div>
      </WeightSection>

      <WeightSection
        title="Relasjonsvekter"
        expanded={expanded === 'relasjon'}
        onToggle={() => toggleSection('relasjon')}
      >
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(weightRules.relationshipWeights) as RelationshipType[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground truncate">{RELATIONSHIP_LABELS[k]}</span>
              <Input
                type="number"
                step={0.05}
                value={weightRules.relationshipWeights[k]}
                onChange={(e) => updateWeightRules({
                  relationshipWeights: { ...weightRules.relationshipWeights, [k]: parseFloat(e.target.value) || 0 },
                })}
                className="h-7 text-xs w-16 text-right"
              />
            </div>
          ))}
        </div>
      </WeightSection>

      <WeightSection
        title="Nærhetsvekter"
        expanded={expanded === 'nærhet'}
        onToggle={() => toggleSection('nærhet')}
      >
        <div className="space-y-1.5">
          {(Object.keys(weightRules.closenessWeights) as ClosenessLevel[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{CLOSENESS_LABELS[k]}</span>
              <Input
                type="number"
                step={0.05}
                value={weightRules.closenessWeights[k]}
                onChange={(e) => updateWeightRules({
                  closenessWeights: { ...weightRules.closenessWeights, [k]: parseFloat(e.target.value) || 0 },
                })}
                className="h-7 text-xs w-16 text-right"
              />
            </div>
          ))}
        </div>
      </WeightSection>

      <WeightSection
        title="Livsfasevekter"
        expanded={expanded === 'livsfase'}
        onToggle={() => toggleSection('livsfase')}
      >
        <div className="space-y-1.5">
          {(Object.keys(weightRules.lifePhaseWeights) as LifePhase[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{LIFE_PHASE_LABELS[k]}</span>
              <Input
                type="number"
                step={0.05}
                value={weightRules.lifePhaseWeights[k]}
                onChange={(e) => updateWeightRules({
                  lifePhaseWeights: { ...weightRules.lifePhaseWeights, [k]: parseFloat(e.target.value) || 0 },
                })}
                className="h-7 text-xs w-16 text-right"
              />
            </div>
          ))}
        </div>
      </WeightSection>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs mt-2"
        onClick={() => updateWeightRules(DEFAULT_WEIGHT_RULES)}
      >
        Tilbakestill til standardverdier
      </Button>
    </div>
  )
}

function WeightSection({
  title, expanded, onToggle, children,
}: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs font-medium hover:bg-muted/30 transition-colors"
      >
        {title}
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-3 py-3 border-t border-border bg-muted/10">{children}</div>}
    </div>
  )
}

// ─── Hovede-komponent ────────────────────────────────────────────

export function GiftPage() {
  const [activeTab, setActiveTab] = useState<GiftTab>('oversikt')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Intern sub-nav */}
      <nav className="flex items-center gap-0.5 border-b border-border bg-card/50 px-3 shrink-0 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Innhold */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'oversikt' && <OverviewTab />}
        {activeTab === 'mottakere' && <RecipientsTab />}
        {activeTab === 'hendelser' && <EventsTab />}
        {activeTab === 'fordeling' && <DistributionTab />}
        {activeTab === 'spareplan' && <SavingsPlanTab />}
        {activeTab === 'satser' && <RatesTab />}
      </div>
    </div>
  )
}
