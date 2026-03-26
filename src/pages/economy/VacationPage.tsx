import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useEconomyStore } from '@/application/useEconomyStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { VacationPeriod } from '@/types/economy'

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

// ── Norske helligdager ────────────────────────────────────────
function getEasterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function getNorwegianHolidays(year: number): Set<string> {
  const easter = getEasterSunday(year)
  const add = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-17`, `${year}-12-25`, `${year}-12-26`,
    fmt(add(easter, -3)), fmt(add(easter, -2)), fmt(easter),
    fmt(add(easter, 1)), fmt(add(easter, 39)), fmt(add(easter, 49)), fmt(add(easter, 50)),
  ])
}

function countWorkingDays(lastWorkDay: string, firstWorkDayBack: string): number {
  const start = new Date(lastWorkDay)
  const end = new Date(firstWorkDayBack)
  const holidays = new Set([
    ...getNorwegianHolidays(start.getFullYear()),
    ...getNorwegianHolidays(end.getFullYear()),
  ])
  let count = 0
  const d = new Date(start)
  d.setDate(d.getDate() + 1) // dagen etter siste arbeidsdag
  while (d < end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6 && !holidays.has(d.toISOString().slice(0, 10))) {
      count++
    }
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ── Skjema ────────────────────────────────────────────────────
const EMPTY_PERIOD: Omit<VacationPeriod, 'id'> = {
  label: '',
  lastWorkDayBefore: '',
  firstWorkDayAfter: '',
}

function PeriodForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<VacationPeriod, 'id'>
  onSave: (p: Omit<VacationPeriod, 'id'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const valid = form.label.trim() && form.lastWorkDayBefore && form.firstWorkDayAfter
  const preview = valid ? countWorkingDays(form.lastWorkDayBefore, form.firstWorkDayAfter) : null

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Navn</Label>
          <Input
            placeholder="f.eks. Sommerferie"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Siste arbeidsdag</Label>
          <Input
            type="date"
            value={form.lastWorkDayBefore}
            onChange={(e) => setForm({ ...form, lastWorkDayBefore: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Første arbeidsdag tilbake</Label>
          <Input
            type="date"
            value={form.firstWorkDayAfter}
            onChange={(e) => setForm({ ...form, firstWorkDayAfter: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>
      {preview !== null && (
        <p className="text-xs text-muted-foreground">
          = <span className="font-semibold text-foreground">{preview} feriedager</span> (virkedager eks. helligdager)
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={!valid} onClick={() => onSave(form)}>
          <Check className="h-3.5 w-3.5 mr-1" /> Lagre
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Avbryt
        </Button>
      </div>
    </div>
  )
}

function PeriodRow({
  period,
  onEdit,
  onDelete,
}: {
  period: VacationPeriod
  onEdit: () => void
  onDelete: () => void
}) {
  const daysLeft = daysUntil(period.lastWorkDayBefore)
  const daysBack = daysUntil(period.firstWorkDayAfter)
  const isOngoing = daysLeft <= 0 && daysBack > 0
  const isPast = daysBack <= 0
  const workingDays = countWorkingDays(period.lastWorkDayBefore, period.firstWorkDayAfter)

  const lastFmt = new Date(period.lastWorkDayBefore).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
  const firstFmt = new Date(period.firstWorkDayAfter).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })

  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 flex items-center justify-between gap-3',
      isOngoing ? 'border-green-500/30 bg-green-500/5' : isPast ? 'border-border/30 opacity-60' : 'border-border/50 bg-card/40'
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{period.label}</span>
          {isOngoing && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">Pågår</span>}
          {isPast && <span className="text-[10px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded-full">Avholdt</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lastFmt} → {firstFmt} · {workingDays} feriedager
        </p>
        {!isPast && !isOngoing && (
          <p className="text-xs text-primary mt-0.5">om {daysLeft} dager</p>
        )}
        {isOngoing && (
          <p className="text-xs text-green-400 mt-0.5">tilbake om {daysBack} dager</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function VacationPage() {
  const profile = useEconomyStore((s) => s.profile)
  const setProfile = useEconomyStore((s) => s.setProfile)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (!profile) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Ingen lønnsprofil registrert. Last opp en lønnsslipp under Lønn for å komme i gang.
      </div>
    )
  }

  const periods = profile.vacationPeriods ?? []
  const daysPerYear = profile.vacationDaysPerYear ?? 25
  const usedDays = periods.reduce((s, p) => s + countWorkingDays(p.lastWorkDayBefore, p.firstWorkDayAfter), 0)
  const remainingDays = daysPerYear - usedDays

  function save(patch: Partial<typeof profile>) {
    setProfile({ ...profile!, ...patch })
  }

  function addPeriod(data: Omit<VacationPeriod, 'id'>) {
    save({ vacationPeriods: [...periods, { ...data, id: randomId() }] })
    setAdding(false)
  }

  function updatePeriod(id: string, data: Omit<VacationPeriod, 'id'>) {
    save({ vacationPeriods: periods.map((p) => p.id === id ? { ...data, id } : p) })
    setEditingId(null)
  }

  function deletePeriod(id: string) {
    save({ vacationPeriods: periods.filter((p) => p.id !== id) })
  }

  const sorted = [...periods].sort((a, b) =>
    new Date(a.lastWorkDayBefore).getTime() - new Date(b.lastWorkDayBefore).getTime()
  )

  const isOnVacation = periods.some((p) => {
    const left = daysUntil(p.lastWorkDayBefore)
    const back = daysUntil(p.firstWorkDayAfter)
    return left <= 0 && back > 0
  })

  return (
    <div className="p-6 space-y-6 max-w-xl overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ferie</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Planlegg og følg opp feriedagene dine.</p>
      </div>

      {isOnVacation && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-center">
          <p className="text-2xl">🏖️</p>
          <p className="text-base font-semibold text-green-400 mt-1">Du er på ferie!</p>
        </div>
      )}

      {/* Feriedager-oversikt */}
      <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Feriedager planlagt</span>
          <span className={cn('font-semibold tabular-nums', remainingDays < 0 ? 'text-red-400' : 'text-foreground')}>
            {usedDays} / {daysPerYear}
          </span>
        </div>
        <Progress value={Math.min(100, (usedDays / daysPerYear) * 100)} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {remainingDays > 0 ? `${remainingDays} dager gjenstår` : remainingDays === 0 ? 'Alle feriedager planlagt' : `${Math.abs(remainingDays)} dager over kvoten`}
          {' · '}
          <button className="underline hover:text-foreground" onClick={() => {
            const v = window.prompt('Antall feriedager per år:', String(daysPerYear))
            if (v && Number(v) > 0) save({ vacationDaysPerYear: Number(v) })
          }}>
            Endre kvote
          </button>
        </p>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {sorted.map((p) =>
          editingId === p.id ? (
            <PeriodForm
              key={p.id}
              initial={p}
              onSave={(data) => updatePeriod(p.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <PeriodRow
              key={p.id}
              period={p}
              onEdit={() => setEditingId(p.id)}
              onDelete={() => deletePeriod(p.id)}
            />
          )
        )}

        {adding ? (
          <PeriodForm initial={EMPTY_PERIOD} onSave={addPeriod} onCancel={() => setAdding(false)} />
        ) : (
          <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Legg til ferieperiode
          </Button>
        )}
      </div>
    </div>
  )
}
