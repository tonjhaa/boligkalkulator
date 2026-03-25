import { useRef, useState } from 'react'
import { Info, Plus, Trash2, Upload, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { parseAbsenceExcel } from '@/features/absence/absenceImporter'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEconomyStore } from '@/application/useEconomyStore'
import {
  getDaysUsedFromEvents,
  getAbsenceStatusFromEvents,
  getDaysUsedLast12Months,
  getAbsenceStatus,
  getStatusColor,
  getStatusLabel,
  getRemainingQuotaFromEvents,
  getRemainingQuota,
  evaluateEligibility,
} from '@/domain/economy/absenceCalculator'
import { EGENMELDING_KVOTE } from '@/config/economy.config'
import type { AbsenceEvent } from '@/types/economy'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

function toLocalDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatNO(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function AbsencePage() {
  const {
    absenceRecords, addAbsenceRecord, removeAbsenceRecord,
    absenceEvents, addAbsenceEvent, removeAbsenceEvent,
    absenceHireDate, setAbsenceHireDate,
  } = useEconomyStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [checkDateStr, setCheckDateStr] = useState(toLocalDateISO(new Date()))
  const [hireDateStr, setHireDateStr] = useState(absenceHireDate ?? '')
  const [isSickNow, setIsSickNow] = useState(false)
  const [hasAAP, setHasAAP] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const { records, events, antallRader, ukjenteTyper } = await parseAbsenceExcel(file)
      records.forEach((r) => addAbsenceRecord(r))
      events.forEach((ev) => addAbsenceEvent(ev))
      const ukjentTekst = ukjenteTyper.length > 0 ? ` (ukjente typer ignorert: ${ukjenteTyper.join(', ')})` : ''
      setImportMsg({ type: 'ok', text: `Importerte ${events.length} hendelser fra ${antallRader} rader.${ukjentTekst}` })
    } catch (err) {
      setImportMsg({ type: 'error', text: err instanceof Error ? err.message : 'Ukjent feil' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleHireDateBlur() {
    setAbsenceHireDate(hireDateStr || null)
  }

  const now = new Date()
  const useEvents = absenceEvents.length > 0
  const daysUsed = useEvents ? getDaysUsedFromEvents(absenceEvents, now) : getDaysUsedLast12Months(absenceRecords, now)
  const status = useEvents ? getAbsenceStatusFromEvents(absenceEvents, now) : getAbsenceStatus(absenceRecords, now)
  const remaining = useEvents ? getRemainingQuotaFromEvents(absenceEvents, now) : getRemainingQuota(absenceRecords, now)

  // Eligibility check
  const checkDate = checkDateStr ? new Date(checkDateStr + 'T00:00:00Z') : new Date()
  const hireDate = hireDateStr ? new Date(hireDateStr + 'T00:00:00Z') : null
  const eligibility = useEvents ? evaluateEligibility(absenceEvents, checkDate, hireDate, isSickNow, hasAAP) : null

  // Sort events descending
  const sortedEvents = [...absenceEvents].sort((a, b) => b.startDate.localeCompare(a.startDate))

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Egenmelding og fravær</h2>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4 mr-1" />
              {importing ? 'Importerer…' : 'Importer SAP'}
            </Button>
            <HelpTooltip
              side="bottom"
              content="Last opp en .xlsx-fil eksportert fra SAP. Filen må inneholde kolonnene: «Tekst frav.type» (f.eks. 0120 Sykemeldt egenmld), «Startdato» og «Frav.dager». Kolonnerekefølge og ekstra kolonner spiller ingen rolle. 0120 = egenmelding, 0110 = sykemelding."
            />
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Registrer
          </Button>
        </div>
      </div>

      {importMsg && (
        <div className={`text-xs rounded-md px-3 py-2 ${importMsg.type === 'ok' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {importMsg.text}
        </div>
      )}

      {/* Kvote-indikator */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Egenmeldingsdager siste 12 mnd</span>
            <span className={cn('text-sm font-semibold', getStatusColor(status))}>
              {daysUsed} / {EGENMELDING_KVOTE} dager
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                status === 'ok' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(100, (daysUsed / EGENMELDING_KVOTE) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={getStatusColor(status)}>{getStatusLabel(status)}</span>
            <span>{remaining} dager igjen</span>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground/80 mb-0.5">Forsvarets særavtale</p>
              <p>24 egenmeldingsdager per 12 måneder. Sykemelding teller IKKE mot kvoten.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligibilitetssjekk */}
      {useEvents && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kan jeg bruke egenmelding?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dato å sjekke</Label>
                <Input type="date" value={checkDateStr} onChange={(e) => setCheckDateStr(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tilsettingsdato</Label>
                <Input
                  type="date"
                  value={hireDateStr}
                  onChange={(e) => setHireDateStr(e.target.value)}
                  onBlur={handleHireDateBlur}
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Toggle active={isSickNow} onToggle={setIsSickNow} label="Sykemeldt nå" />
              <Toggle active={hasAAP} onToggle={setHasAAP} label="AAP / ufør" />
            </div>

            {eligibility && (
              <>
                {/* JA / NEI banner */}
                <div className={cn('flex items-center gap-3 rounded-md px-4 py-3',
                  eligibility.canUse ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                )}>
                  {eligibility.canUse
                    ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    : <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  }
                  <div>
                    <p className={cn('font-semibold text-sm', eligibility.canUse ? 'text-green-500' : 'text-red-500')}>
                      {eligibility.canUse ? 'JA – egenmelding kan brukes' : 'NEI – egenmelding kan ikke brukes'}
                    </p>
                    {!eligibility.canUse && eligibility.earliest && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tidligste dato: <span className="font-medium text-foreground">{formatNO(eligibility.earliest)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{eligibility.explain}</p>

                {/* KPI-er */}
                <div className="grid grid-cols-2 gap-2">
                  <KpiBox label="Egenmelding siste 12 mnd" value={`${eligibility.kpiEgen12m} / ${EGENMELDING_KVOTE}`} />
                  <KpiBox label="Egenmelding siste 16 dager" value={String(eligibility.kpiEgen16d)} warn={eligibility.kpiEgen16d >= 8} />
                  <KpiBox label="Sykedager i siste periode" value={String(eligibility.lastPeriodSickDays)} warn={eligibility.lastPeriodSickDays >= 16} />
                  <KpiBox label="Arbeidsgiverperiode igjen" value={`${eligibility.employerLeft} / 16`} warn={eligibility.employerLeft === 0} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Registrer skjema */}
      {showAddForm && (
        <AddAbsenceEventForm
          onSave={(ev) => { addAbsenceEvent(ev); setShowAddForm(false) }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Hendelseslogg */}
      {sortedEvents.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fraværslogg</CardTitle>
          </CardHeader>
          <CardContent>
            <AbsenceEventLog events={sortedEvents} onRemove={removeAbsenceEvent} />
          </CardContent>
        </Card>
      ) : absenceRecords.length > 0 ? (
        // Fallback: vis gamle månedsposter dersom ingen events ennå
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fraværslogg (månedsoversikt)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-xs">Måned</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Egenmelding</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Sykemelding</th>
                    <th className="text-right px-3 py-2 font-medium text-xs"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...absenceRecords].sort((a, b) => b.period.localeCompare(a.period)).map((r) => {
                    const d = new Date(r.period)
                    return (
                      <tr key={r.period} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-xs">{MONTH_NAMES[d.getMonth() + 1]} {d.getFullYear()}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {r.selfCertDays > 0 ? <span className="text-yellow-400">{r.selfCertDays} dager</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {r.sickLeaveDays > 0 ? <span className="text-muted-foreground">{r.sickLeaveDays} dager</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400" onClick={() => removeAbsenceRecord(r.period)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : !showAddForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Ingen fravær registrert.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// ----------------------------------------------------------------
// AbsenceEventLog — grouped by month, expandable
// ----------------------------------------------------------------

const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']

function formatWithWeekday(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const [y, m, day] = iso.split('-')
  return `${WEEKDAYS[d.getDay()]} ${day}.${m}.${y}`
}

function eventDays(ev: AbsenceEvent): number {
  return Math.round(
    (new Date(ev.endDate).getTime() - new Date(ev.startDate).getTime()) / 86_400_000
  ) + 1
}

function AbsenceEventLog({
  events,
  onRemove,
}: {
  events: AbsenceEvent[]
  onRemove: (id: string) => void
}) {
  // Group by "YYYY-MM"
  const groups = new Map<string, AbsenceEvent[]>()
  for (const ev of events) {
    const key = ev.startDate.slice(0, 7)
    const arr = groups.get(key) ?? []
    arr.push(ev)
    groups.set(key, arr)
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
      {sortedKeys.map((key) => {
        const evs = groups.get(key)!
        const [y, m] = key.split('-')
        const monthLabel = `${MONTH_NAMES[parseInt(m)]} ${y}`
        const totalDays = evs.reduce((s, ev) => s + eventDays(ev), 0)
        const hasEgen = evs.some((ev) => ev.type === 'egenmelding')
        const hasSyk = evs.some((ev) => ev.type === 'sykmelding')

        return (
          <details key={key} className="group">
            <summary className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/20 list-none select-none">
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="font-medium w-28">{monthLabel}</span>
              <span className="text-muted-foreground">{totalDays} dag{totalDays !== 1 ? 'er' : ''}</span>
              <span className="ml-auto flex gap-1">
                {hasEgen && <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">Egenmelding</span>}
                {hasSyk && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Sykemelding</span>}
              </span>
            </summary>

            <div className="bg-muted/10 border-t border-border/50 divide-y divide-border/30">
              {evs.map((ev) => {
                const days = eventDays(ev)
                const singleDay = ev.startDate === ev.endDate
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-6 py-2 text-xs">
                    <div className="flex-1 space-y-0.5">
                      {singleDay ? (
                        <span className="font-mono">{formatWithWeekday(ev.startDate)}</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-mono">Fra <span className="font-medium">{formatWithWeekday(ev.startDate)}</span></div>
                          <div className="font-mono">Til <span className="font-medium">{formatWithWeekday(ev.endDate)}</span></div>
                        </div>
                      )}
                    </div>
                    <span className={cn('px-1.5 py-0.5 rounded font-medium',
                      ev.type === 'egenmelding' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-muted text-muted-foreground'
                    )}>
                      {ev.type === 'egenmelding' ? 'Egenmelding' : 'Sykemelding'}
                    </span>
                    <span className="font-mono text-muted-foreground w-8 text-right">{days} d</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400" onClick={() => onRemove(ev.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </details>
        )
      })}
    </div>
  )
}

function Toggle({ active, onToggle, label }: { active: boolean; onToggle: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onToggle(!active)}
      className={cn(
        'flex-1 py-1.5 text-xs rounded border transition-colors',
        active
          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
          : 'bg-muted text-muted-foreground border-border hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}

function KpiBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-muted/40 rounded-md px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={cn('text-sm font-semibold', warn ? 'text-red-400' : 'text-foreground')}>{value}</p>
    </div>
  )
}

// -------------------------------------------------------
// SKJEMA for å legge til en fraværshendelse
// -------------------------------------------------------

function AddAbsenceEventForm({ onSave, onCancel }: { onSave: (ev: AbsenceEvent) => void; onCancel: () => void }) {
  const now = new Date()
  const todayISO = toLocalDateISO(now)
  const [startDate, setStartDate] = useState(todayISO)
  const [endDate, setEndDate] = useState(todayISO)
  const [type, setType] = useState<'egenmelding' | 'sykmelding'>('egenmelding')
  const [notat, setNotat] = useState('')

  function handleSave() {
    if (!startDate || !endDate) return
    if (endDate < startDate) return
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`
    onSave({ id, startDate, endDate, type, grade: 100, source: 'manual', notat: notat.trim() || undefined })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Registrer fravær</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Startdato</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sluttdato</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Fraværstype</Label>
            <div className="flex gap-2">
              {(['egenmelding', 'sykmelding'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn('flex-1 py-1.5 text-xs rounded border transition-colors',
                    type === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  )}
                >
                  {t === 'egenmelding' ? 'Egenmelding' : 'Sykemelding'}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notat (valgfritt)</Label>
            <Input value={notat} onChange={(e) => setNotat(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button size="sm" onClick={handleSave} disabled={!startDate || !endDate || endDate < startDate}>
            Lagre
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
