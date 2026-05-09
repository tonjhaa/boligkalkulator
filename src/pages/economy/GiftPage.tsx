import { useState, useMemo, useEffect } from 'react'
import {
  Gift, Plus, Trash2, Pencil, AlertTriangle,
  Calendar, Users, SlidersHorizontal, TrendingUp, Wallet, ChevronDown, ChevronUp,
} from 'lucide-react'
import * as RadixSlider from '@radix-ui/react-slider'
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
  giftAmountExplanation, roundGiftAmount, deriveAutoEvents,
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


function lifePhaseFromBirthDate(dateStr: string): LifePhase | null {
  if (!dateStr) return null
  const birth = new Date(dateStr)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  if (age < 0) return null
  if (age <= 12) return 'barn_0_12'
  if (age <= 17) return 'tenåring'
  if (age <= 25) return 'ung_voksen'
  if (age <= 66) return 'voksen'
  return 'senior'
}

// ─── Interne tabs ───────────────────────────────────────────────

type GiftTab = 'oversikt' | 'mottakere' | 'hendelser' | 'fordeling' | 'spareplan' | 'satser'

const TABS: { id: GiftTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'oversikt', label: 'Oversikt', Icon: TrendingUp },
  { id: 'mottakere', label: 'Mottakere', Icon: Users },
  { id: 'hendelser', label: 'Hendelser', Icon: Calendar },
  { id: 'fordeling', label: 'Fordeling', Icon: Wallet },
  { id: 'spareplan', label: 'Spareplan', Icon: Gift },
  { id: 'satser', label: 'Tilpass', Icon: SlidersHorizontal },
]

// ─── Oversikt ───────────────────────────────────────────────────

function OverviewTab({ setTab }: { setTab: (tab: GiftTab) => void }) {
  const events = useGiftStore((s) => s.events)
  const settings = useGiftStore((s) => s.settings)
  const recipients = useGiftStore((s) => s.recipients)
  const addEvent = useGiftStore((s) => s.addEvent)
  const weightRules = useGiftStore((s) => s.weightRules)
  const [prefill, setPrefill] = useState<{ recipientId: string; occasion: Occasion } | null>(null)

  const autoEvents = useMemo(
    () => deriveAutoEvents(recipients, events, weightRules, settings),
    [recipients, events, weightRules, settings]
  )

  const effectiveEvents = useMemo(() => [...events, ...autoEvents], [events, autoEvents])

  const result = useMemo(() => calculateGiftResult(effectiveEvents, settings, recipients), [effectiveEvents, settings, recipients])

  const recipientMap = useMemo(
    () => new Map(recipients.map((r) => [r.id, r])),
    [recipients]
  )

  const hasRecipients = recipients.length > 0
  const hasEvents = effectiveEvents.filter((e) => e.status !== 'droppet').length > 0

  // Neste hendelser med dato, sortert — bursdager fremhevet
  const upcoming = useMemo(() => {
    const today = new Date()
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    return effectiveEvents
      .filter((e) => e.status !== 'droppet' && e.date)
      .map((e) => {
        const d = new Date(e.date!)
        // Beregn neste forekomst av datoen (hvis i fortid, bruk neste år for bursdager)
        let next = new Date(d)
        if (e.occasion === 'bursdag') {
          next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
          if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
        }
        return { event: e, nextDate: next }
      })
      .filter(({ nextDate }) => nextDate <= nextYear)
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
      .slice(0, 8)
  }, [effectiveEvents])

  // Foreslåtte hendelser: kun de som IKKE dekkes av auto-events (dvs. mangler birthDate)
  const missingEvents = useMemo(() => {
    const suggestions: { recipient: GiftRecipient; occasion: Occasion }[] = []
    for (const r of recipients) {
      const hasB = effectiveEvents.some((e) => e.recipientId === r.id && e.occasion === 'bursdag')
      if (r.receivesBirthdayGift && r.birthDate && !hasB) {
        suggestions.push({ recipient: r, occasion: 'bursdag' })
      }
      const hasJ = effectiveEvents.some((e) => e.recipientId === r.id && e.occasion === 'jul')
      if (r.receivesChristmasGift && !hasJ) {
        suggestions.push({ recipient: r, occasion: 'jul' })
      }
    }
    return suggestions
  }, [recipients, effectiveEvents])

  const nameA = settings.memberA.name || 'Person A'
  const nameB = settings.memberB.name || 'Person B'
  const monthlyA = result.personAMonthlySaving
  const monthlyB = result.personBMonthlySaving
  const monthlyTotal = monthlyA + monthlyB

  function daysUntil(d: Date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  function fmtRelDate(d: Date) {
    const days = daysUntil(d)
    if (days === 0) return 'I dag'
    if (days === 1) return 'I morgen'
    if (days < 7) return `Om ${days} dager`
    if (days < 14) return 'Neste uke'
    if (days < 31) return `Om ${Math.round(days / 7)} uker`
    const months = Math.round(days / 30)
    return `Om ${months} mnd`
  }

  // State A: helt tom
  if (!hasRecipients && !hasEvents) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-4 px-6">
        <Gift className="h-12 w-12 opacity-20" />
        <div>
          <p className="font-medium text-sm">Kom i gang</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Legg til mottakere — folk du gir gaver til — og hendelsene vil hjelpe deg planlegge og spare.
          </p>
        </div>
        <Button size="sm" onClick={() => setTab('mottakere')}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Legg til mottaker
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      {/* Advarsler */}
      {result.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {w}
        </div>
      ))}

      {/* State B: mottakere men ingen hendelser */}
      {hasRecipients && !hasEvents && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mottakere ({recipients.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {recipients.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded border border-border/40 bg-muted/10 px-2.5 py-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{RELATIONSHIP_LABELS[r.relationshipType]}</p>
                </div>
              </div>
            ))}
          </div>
          {recipients.length > 6 && (
            <p className="text-xs text-muted-foreground">+{recipients.length - 6} til</p>
          )}
        </div>
      )}

      {/* Sparepuls */}
      {hasEvents && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sparepuls</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-muted/10 px-3 py-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Totalt / mnd</p>
              <p className="text-lg font-semibold font-mono">{fmtNOK(monthlyTotal)}</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-3 text-center">
              <p className="text-xs text-blue-400/70 mb-1">{nameA}</p>
              <p className="text-lg font-semibold font-mono text-blue-400">{fmtNOK(monthlyA)}</p>
            </div>
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-3 text-center">
              <p className="text-xs text-violet-400/70 mb-1">{nameB}</p>
              <p className="text-lg font-semibold font-mono text-violet-400">{fmtNOK(monthlyB)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Foreslåtte hendelser */}
      {missingEvents.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Foreslåtte hendelser
          </p>
          <div className="space-y-1.5">
            {missingEvents.slice(0, 5).map(({ recipient: r, occasion }) => (
              <div
                key={r.id + occasion}
                className="flex items-center justify-between rounded border border-dashed border-border/50 px-3 py-2 text-xs bg-muted/5"
              >
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground ml-1.5">
                    mangler {OCCASION_LABELS[occasion]}
                    {occasion === 'bursdag' && r.birthDate && (
                      <> — {new Date().getFullYear() - parseInt(r.birthDate.split('-')[0])} år</>
                    )}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => setPrefill({ recipientId: r.id, occasion })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Legg til
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kommende hendelser / bursdager */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Kommende hendelser</p>
          <div className="space-y-1.5">
            {upcoming.map(({ event: e, nextDate }) => {
              const rec = recipientMap.get(e.recipientId)
              const amount = e.manualAmount ?? e.calculatedAmount
              const days = daysUntil(nextDate)
              const isSoon = days <= 14
              return (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-center justify-between rounded border px-3 py-2 text-xs',
                    isSoon
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border/40 bg-muted/10'
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rec?.name ?? '—'}</span>
                      <span className="text-muted-foreground">{OCCASION_LABELS[e.occasion]}</span>
                      {isSoon && <span className="text-amber-400 font-bold">!</span>}
                    </div>
                    <p className={cn('mt-0.5', isSoon ? 'text-amber-400' : 'text-muted-foreground')}>
                      {fmtRelDate(nextDate)}
                      <span className="ml-1.5 opacity-50">
                        {nextDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: nextDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}
                      </span>
                      {e.occasion === 'bursdag' && rec?.birthDate && (
                        <span className="ml-1 opacity-50">
                          · {nextDate.getFullYear() - parseInt(rec.birthDate.split('-')[0])} år
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="font-mono font-medium ml-4 shrink-0">{fmtNOK(amount)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hasEvents && upcoming.length === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/20 rounded px-3 py-2">
          Ingen kommende hendelser med dato. Legg til datoer på hendelsene dine.
        </p>
      )}

      {/* Gavebelastning per måned — søylediagram */}
      {hasEvents && result.monthlyBreakdown.some((m) => m.totalCost > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Gavebelastning per måned</p>
          <MonthLoadChart months={result.monthlyBreakdown} />
        </div>
      )}

      {/* EventModal for suggestions */}
      {prefill && (
        <EventModal
          open
          defaultRecipientId={prefill.recipientId}
          defaultOccasion={prefill.occasion}
          recipients={recipients}
          settings={settings}
          weightRules={weightRules}
          onSave={(ev) => { addEvent({ ...ev, id: crypto.randomUUID() }); setPrefill(null) }}
          onClose={() => setPrefill(null)}
        />
      )}
    </div>
  )
}

function MonthLoadChart({ months }: { months: import('@/types/gifts').MonthlyBreakdown[] }) {
  const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
  const maxCost = Math.max(...months.map((m) => m.totalCost), 1)
  const currentMonth = new Date().getMonth() + 1
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="space-y-1">
      {/* Bars */}
      <div className="flex items-end gap-0.5 h-20">
        {months.map((m) => {
          const pct = m.totalCost / maxCost
          const isHeavy = m.isHeavy
          const isCurrent = m.month === currentMonth
          const isHovered = hovered === m.month
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col justify-end cursor-default"
              onMouseEnter={() => setHovered(m.month)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={cn(
                  'rounded-t transition-opacity',
                  isHeavy
                    ? 'bg-amber-500/70'
                    : isCurrent
                    ? 'bg-primary/60'
                    : 'bg-muted-foreground/30',
                  isHovered && 'opacity-100',
                  !isHovered && 'opacity-80'
                )}
                style={{ height: m.totalCost > 0 ? `${Math.max(pct * 100, 4)}%` : '2px' }}
              />
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-0.5">
        {months.map((m) => (
          <div
            key={m.month}
            className={cn(
              'flex-1 text-center text-xs leading-tight cursor-default',
              m.month === currentMonth ? 'text-primary' : 'text-muted-foreground/50',
              m.isHeavy && 'text-amber-400'
            )}
            onMouseEnter={() => setHovered(m.month)}
            onMouseLeave={() => setHovered(null)}
          >
            {MONTH_SHORT[m.month - 1]}
          </div>
        ))}
      </div>

      {/* Tooltip for hovered month */}
      {hovered !== null && (() => {
        const m = months[hovered - 1]
        if (!m || m.totalCost === 0) return (
          <p className="text-xs text-muted-foreground text-center py-1">{fmtMonth(hovered)} — ingen gaver</p>
        )
        return (
          <div className={cn(
            'rounded border px-3 py-2 text-xs',
            m.isHeavy ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' : 'border-border bg-muted/10 text-foreground'
          )}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{fmtMonth(hovered)}{m.isHeavy ? ' ⚡ Gaveintensiv' : ''}</span>
              <span className="font-mono">{fmtNOK(m.totalCost)}</span>
            </div>
            {m.events.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.events.map((e) => (
                  <span key={e.id} className="opacity-70 border border-current/20 rounded px-1 py-0.5">
                    {OCCASION_LABELS[e.occasion]}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function MetricCard({ label, value, sub, colorClass }: {
  label: string; value: string; sub?: string; colorClass?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-lg font-bold font-mono', colorClass ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Mottakere ──────────────────────────────────────────────────

function RecipientsTab() {
  const recipients = useGiftStore((s) => s.recipients)
  const addRecipient = useGiftStore((s) => s.addRecipient)
  const updateRecipient = useGiftStore((s) => s.updateRecipient)
  const removeRecipient = useGiftStore((s) => s.removeRecipient)
  const settings = useGiftStore((s) => s.settings)
  const weightRules = useGiftStore((s) => s.weightRules)

  function calcOccasionAmount(r: GiftRecipient, occasion: import('@/types/gifts').Occasion): number {
    const event: import('@/types/gifts').GiftEvent = {
      id: '', recipientId: r.id, occasion,
      ownership: r.ownership, calculatedAmount: 0,
      isLocked: false, status: 'planlagt',
    }
    return roundGiftAmount(calculateGiftAmount(event, r, weightRules), settings.roundingNearest)
  }

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
                <span className="text-sm font-medium truncate" title={r.name}>{r.name}</span>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded border shrink-0',
                  r.ownership === 'A' ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' :
                  r.ownership === 'B' ? 'border-violet-500/40 text-violet-400 bg-violet-500/10' :
                  'border-border text-muted-foreground'
                )}>
                  {OWNERSHIP_LABELS[r.ownership]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {RELATIONSHIP_LABELS[r.relationshipType]} · {CLOSENESS_LABELS[r.closeness]} · {LIFE_PHASE_LABELS[r.lifePhase]}
              </p>
              <p className="text-xs mt-0.5 flex gap-2.5">
                <span className={r.receivesBirthdayGift ? 'text-foreground/80' : 'text-muted-foreground/40'}>
                  Bursdag {fmtNOK(calcOccasionAmount(r, 'bursdag'))}
                </span>
                <span className={r.receivesChristmasGift ? 'text-foreground/80' : 'text-muted-foreground/40'}>
                  Jul {fmtNOK(calcOccasionAmount(r, 'jul'))}
                </span>
              </p>
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
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm mb-3">Ingen mottakere ennå</p>
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Legg til mottaker</Button>
          </div>
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
  const [birthDate, setBirthDate] = useState(
    initial?.birthDate ?? (initial?.birthYear
      ? `${initial.birthYear}-${String(initial.birthMonth ?? 1).padStart(2, '0')}-01`
      : '')
  )
  const [birthday, setBirthday] = useState(initial?.receivesBirthdayGift ?? true)
  const [christmas, setChristmas] = useState(initial?.receivesChristmasGift ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  useEffect(() => {
    setName(initial?.name ?? '')
    setRelType(initial?.relationshipType ?? 'venn')
    setCloseness(initial?.closeness ?? 'normal')
    setLifePhase(initial?.lifePhase ?? 'voksen')
    setOwnership(initial?.ownership ?? 'felles')
    setBirthDate(initial?.birthDate ?? (initial?.birthYear
      ? `${initial.birthYear}-${String(initial.birthMonth ?? 1).padStart(2, '0')}-01`
      : ''))
    setBirthday(initial?.receivesBirthdayGift ?? true)
    setChristmas(initial?.receivesChristmasGift ?? false)
    setNotes(initial?.notes ?? '')
  }, [initial])

  useEffect(() => {
    const auto = lifePhaseFromBirthDate(birthDate)
    if (auto) setLifePhase(auto)
  }, [birthDate])

  function handleSave() {
    if (!name.trim()) return
    const r: GiftRecipient = {
      id: initial?.id ?? '',
      name: name.trim(),
      relationshipType: relType,
      closeness,
      lifePhase,
      ownership,
      birthDate: birthDate || undefined,
      birthYear: birthDate ? parseInt(birthDate.split('-')[0]) : undefined,
      birthMonth: birthDate ? parseInt(birthDate.split('-')[1]) : undefined,
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
              <Label className="text-xs flex items-center gap-1.5">
                Livsfase
                {birthDate && lifePhaseFromBirthDate(birthDate) === lifePhase && (
                  <span className="text-xs text-muted-foreground font-normal">(automatisk)</span>
                )}
              </Label>
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
          <div className="space-y-1">
            <Label className="text-xs">Fødselsdato</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-8 text-xs"
            />
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
                      'text-xs px-1 py-0.5 rounded border',
                      ev.ownership === 'A' ? 'border-blue-500/40 text-blue-400' :
                      ev.ownership === 'B' ? 'border-violet-500/40 text-violet-400' :
                      'border-border text-muted-foreground'
                    )}>
                      {OWNERSHIP_LABELS[ev.ownership]}
                    </span>
                    {ev.isLocked && <span className="text-xs text-amber-400 border border-amber-500/30 px-1 rounded">Låst</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {ev.date ?? (ev.month ? fmtMonth(ev.month) : 'Udatert')}
                    </span>
                    <span className="text-xs font-mono text-foreground">{fmtNOK(amount)}</span>
                    {ev.manualAmount !== undefined && (
                      <span className="text-xs text-amber-400">Manuelt</span>
                    )}
                    {ev.actualAmount !== undefined && (
                      <span className={cn('text-xs font-mono', ev.actualAmount > amount ? 'text-red-400' : 'text-green-400')}>
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
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p className="text-sm mb-3">Ingen hendelser{recipients.length === 0 ? ' — legg til mottakere først' : ''}</p>
            {recipients.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Legg til hendelse</Button>
            )}
          </div>
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
  open, initial, defaultRecipientId, defaultOccasion, recipients, settings, weightRules, onSave, onClose,
}: {
  open: boolean
  initial?: GiftEvent
  defaultRecipientId?: string
  defaultOccasion?: Occasion
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

  useEffect(() => {
    setRecipientId(initial?.recipientId ?? defaultRecipientId ?? (recipients[0]?.id ?? ''))
    setOccasion(initial?.occasion ?? defaultOccasion ?? 'bursdag')
    setDate(initial?.date ?? '')
    setMonth(initial?.month ? String(initial.month) : '')
    setOwnership(initial?.ownership ?? 'felles')
    setManualAmount(initial?.manualAmount != null ? String(initial.manualAmount) : '')
    setIsLocked(initial?.isLocked ?? false)
    setStatus(initial?.status ?? 'planlagt')
    setActualAmount(initial?.actualAmount != null ? String(initial.actualAmount) : '')
    setNotes(initial?.notes ?? '')
  }, [initial, defaultRecipientId, defaultOccasion, recipients])

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
        {recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Legg til en mottaker under «Mottakere» før du oppretter en gavehendelse.
          </p>
        ) : null}
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
              {!date && !month && (
                <p className="text-xs text-muted-foreground">Uten dato vises ikke gaven i månedsoversikten.</p>
              )}
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
              <p className="text-muted-foreground mt-0.5 text-xs">
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
      {/* Hvem er dere? */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Hvem er dere?</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Ditt navn</Label>
              <Input value={nameA} onChange={(e) => setNameA(e.target.value)} onBlur={saveMembers} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Netto lønn per måned</Label>
              <Input
                type="number"
                value={incomeA}
                onChange={(e) => setIncomeA(e.target.value)}
                onBlur={saveMembers}
                placeholder="f.eks. 38 000"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Partners navn</Label>
              <Input value={nameB} onChange={(e) => setNameB(e.target.value)} onBlur={saveMembers} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Netto lønn per måned</Label>
              <Input
                type="number"
                value={incomeB}
                onChange={(e) => setIncomeB(e.target.value)}
                onBlur={saveMembers}
                placeholder="f.eks. 30 000"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
        {totalIncome > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Inntektsfordeling</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-400 w-8 text-right tabular-nums">{pA}%</span>
              <div className="w-40 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pA}%` }} />
              </div>
              <span className="text-xs text-violet-400 w-8 tabular-nums">{pB}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-8 text-right truncate" title={nameA || 'A'}>{nameA || 'A'}</span>
              <div className="w-40" />
              <span className="text-xs text-muted-foreground w-8 truncate" title={nameB || 'B'}>{nameB || 'B'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Hvordan deles utgiftene? */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Hvordan deles gaveutgiftene?</p>
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
              <p className="text-xs mt-0.5 text-muted-foreground">
                {model === '50_50' && 'Dere deler likt på alle gaver, uansett hvem som kjenner mottakeren.'}
                {model === 'inntekt' && 'Den med høyest inntekt betaler mer. Rettferdig hvis dere tjener ulikt.'}
                {model === 'eierskap' && 'Du betaler egne familiegaver, partneren sine. Felles gaver deles etter inntekt.'}
                {model === 'hybrid' && 'Egne gaver: du betaler 80 %, partner 20 %. Felles gaver etter inntekt. Anbefalt.'}
                {model === 'familie_venn' && 'Familie deles alltid 50/50. Egne venner betaler du selv. Felles venner deles 50/50.'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Budsjettgrenser */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Budsjettgrenser</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Buffer for uforutsette gaver</Label>
            <Input
              type="number"
              value={settings.bufferPercent}
              onChange={(e) => updateSettings({ bufferPercent: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs"
            />
            <p className="text-xs text-muted-foreground">Anbefalt: 12 %</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Maks å bruke på gaver i år</Label>
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
            <Label className="text-xs">Avrund beløp til nærmeste</Label>
            <Select
              value={String(settings.roundingNearest)}
              onValueChange={(v) => updateSettings({ roundingNearest: parseInt(v) as 1 | 50 | 100 })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="text-xs">Ingen avrunding</SelectItem>
                <SelectItem value="50" className="text-xs">50 kr</SelectItem>
                <SelectItem value="100" className="text-xs">100 kr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fordeling ved egne gaver</Label>
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
                <SelectItem value="0.8" className="text-xs">80/20 (anbefalt)</SelectItem>
                <SelectItem value="0.9" className="text-xs">90/10</SelectItem>
                <SelectItem value="1.0" className="text-xs">100/0</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
        <p>Felles gaver deles etter inntekt. Egne familiegaver deles {Math.round(settings.primaryResponsibilityShare * 100)}/{Math.round(settings.supportShare * 100)}.</p>
        <p>Du kan alltid justere beløpet manuelt på hver enkelt gave.</p>
      </div>
    </div>
  )
}

// ─── Spareplan ──────────────────────────────────────────────────

function SavingsPlanTab() {
  const events = useGiftStore((s) => s.events)
  const settings = useGiftStore((s) => s.settings)
  const recipients = useGiftStore((s) => s.recipients)
  const weightRules = useGiftStore((s) => s.weightRules)

  const effectiveEvents = useMemo(
    () => [...events, ...deriveAutoEvents(recipients, events, weightRules, settings)],
    [events, recipients, weightRules, settings]
  )

  const result = useMemo(() => calculateGiftResult(effectiveEvents, settings, recipients), [effectiveEvents, settings, recipients])
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

      <p className="text-xs text-muted-foreground">
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
                  {m.isHeavy && <span className="text-amber-400 text-xs">Gaveintensiv</span>}
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
                    <span key={e.id} className="text-xs text-muted-foreground border border-border/30 rounded px-1 py-0.5">
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

function pctLabel(w: number): string {
  const pct = Math.round((w - 1) * 100)
  if (pct === 0) return 'Normalt'
  return pct > 0 ? `+${pct} %` : `${pct} %`
}

function SliderRow({
  label, value, min, max, step, onChange, displayValue,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  displayValue: string
}) {
  return (
    <div className="space-y-1.5 py-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-foreground leading-tight">{label}</span>
        <span className="text-xs font-medium text-primary tabular-nums shrink-0">{displayValue}</span>
      </div>
      <RadixSlider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="relative flex items-center select-none touch-none w-full h-5"
      >
        <RadixSlider.Track className="bg-border relative grow rounded-full h-1">
          <RadixSlider.Range className="absolute bg-primary rounded-full h-full" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="block w-3.5 h-3.5 bg-background border-2 border-primary rounded-full shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
      </RadixSlider.Root>
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

function RatesTab() {
  const weightRules = useGiftStore((s) => s.weightRules)
  const updateWeightRules = useGiftStore((s) => s.updateWeightRules)

  const [expanded, setExpanded] = useState<string | null>('anledning')

  function toggleSection(s: string) {
    setExpanded(expanded === s ? null : s)
  }

  // Representativt grunnbeløp for å vise "ca. X kr" under relasjonsslidere
  const repBase = weightRules.occasionBaseAmounts.bursdag ?? 400

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Dra i sliderne for å justere hva du typisk bruker på gaver.
      </p>

      {/* Grunnbeløp */}
      <WeightSection
        title="Hva bruker du typisk på..."
        expanded={expanded === 'anledning'}
        onToggle={() => toggleSection('anledning')}
      >
        <div className="space-y-3">
          {(Object.keys(weightRules.occasionBaseAmounts) as Occasion[]).map((k) => (
            <SliderRow
              key={k}
              label={OCCASION_LABELS[k]}
              value={weightRules.occasionBaseAmounts[k]}
              min={0}
              max={3000}
              step={50}
              onChange={(v) => updateWeightRules({
                occasionBaseAmounts: { ...weightRules.occasionBaseAmounts, [k]: v },
              })}
              displayValue={`${weightRules.occasionBaseAmounts[k].toLocaleString('no-NO')} kr`}
            />
          ))}
        </div>
      </WeightSection>

      {/* Relasjon */}
      <WeightSection
        title="Hvem er gaven til?"
        expanded={expanded === 'relasjon'}
        onToggle={() => toggleSection('relasjon')}
      >
        <p className="text-xs text-muted-foreground mb-3">
          Juster opp eller ned basert på hvem du normalt bruker mer eller mindre på.
          Tallene viser et typisk gavebeløp for bursdager.
        </p>
        <div className="space-y-3">
          {(Object.keys(weightRules.relationshipWeights) as RelationshipType[]).map((k) => (
            <SliderRow
              key={k}
              label={RELATIONSHIP_LABELS[k]}
              value={weightRules.relationshipWeights[k]}
              min={0.25}
              max={3.0}
              step={0.05}
              onChange={(v) => updateWeightRules({
                relationshipWeights: { ...weightRules.relationshipWeights, [k]: v },
              })}
              displayValue={`ca. ${Math.round(repBase * weightRules.relationshipWeights[k]).toLocaleString('no-NO')} kr`}
            />
          ))}
        </div>
      </WeightSection>

      {/* Nærhet */}
      <WeightSection
        title="Hvor godt kjenner du dem?"
        expanded={expanded === 'nærhet'}
        onToggle={() => toggleSection('nærhet')}
      >
        <p className="text-xs text-muted-foreground mb-3">
          Nærhet justerer gavebeløpet opp eller ned uavhengig av relasjon.
        </p>
        <div className="space-y-3">
          {(Object.keys(weightRules.closenessWeights) as ClosenessLevel[]).map((k) => (
            <SliderRow
              key={k}
              label={CLOSENESS_LABELS[k]}
              value={weightRules.closenessWeights[k]}
              min={0.25}
              max={2.0}
              step={0.05}
              onChange={(v) => updateWeightRules({
                closenessWeights: { ...weightRules.closenessWeights, [k]: v },
              })}
              displayValue={pctLabel(weightRules.closenessWeights[k])}
            />
          ))}
        </div>
      </WeightSection>

      {/* Livsfase */}
      <WeightSection
        title="Hvilken livsfase er de i?"
        expanded={expanded === 'livsfase'}
        onToggle={() => toggleSection('livsfase')}
      >
        <p className="text-xs text-muted-foreground mb-3">
          Noen livsfaser gir litt høyere eller lavere gavebeløp automatisk.
        </p>
        <div className="space-y-3">
          {(Object.keys(weightRules.lifePhaseWeights) as LifePhase[]).map((k) => (
            <SliderRow
              key={k}
              label={LIFE_PHASE_LABELS[k]}
              value={weightRules.lifePhaseWeights[k]}
              min={0.5}
              max={2.0}
              step={0.05}
              onChange={(v) => updateWeightRules({
                lifePhaseWeights: { ...weightRules.lifePhaseWeights, [k]: v },
              })}
              displayValue={pctLabel(weightRules.lifePhaseWeights[k])}
            />
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
        {activeTab === 'oversikt' && <OverviewTab setTab={setActiveTab} />}
        {activeTab === 'mottakere' && <RecipientsTab />}
        {activeTab === 'hendelser' && <EventsTab />}
        {activeTab === 'fordeling' && <DistributionTab />}
        {activeTab === 'spareplan' && <SavingsPlanTab />}
        {activeTab === 'satser' && <RatesTab />}
      </div>
    </div>
  )
}
