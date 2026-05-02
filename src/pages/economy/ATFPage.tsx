import { useState } from 'react'
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useEconomyStore } from '@/application/useEconomyStore'
import {
  calculateATF,
  sumATFByYear,
  calculateATFRates,
  getATFRatesSourceLabel,
  sumATFDatoRader,
  beregnTidskompensasjonFromRows,
  beregnATFMedPlanstatus,
  type AppliedATFRule,
} from '@/domain/economy/atfCalculator'
import { estimateSalaryTrend, projectMonthlySalary } from '@/domain/economy/salaryCalculator'
import type { ATFEntry, ATFDatoRad, KnownATFRate, PlanningStatus } from '@/types/economy'

// ------------------------------------------------------------
// FORMATTING HELPERS
// ------------------------------------------------------------

function fmtNOK(n: number): string {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtSats(n: number): string {
  // Vis desimaler hvis de er signifikante, så antall × sats = beløp gir mening
  const rounded = Math.round(n * 100) / 100
  return rounded % 1 === 0
    ? rounded.toLocaleString('no-NO') + ' kr'
    : rounded.toLocaleString('no-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
}

const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

function formatDate(iso: string): string {
  // Parse as local midnight to avoid UTC offset giving wrong day
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const DAY_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}`
}

function formatDateRange(fra: string, til: string): string {
  const fraD = new Date(fra)
  const tilD = new Date(til)
  const fraStr = `${fraD.getDate()}. ${MONTH_SHORT[fraD.getMonth() + 1]}`
  const tilStr = `${tilD.getDate()}. ${MONTH_SHORT[tilD.getMonth() + 1]} ${tilD.getFullYear()}`
  return `${fraStr} – ${tilStr}`
}

// ------------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]
// Fallback-prosent brukes når ingen slipp er importert.
// Effektiv /440-prosent hentes fra profil der det er tilgjengelig.
const DEFAULT_TAX_PCT = 35

// ------------------------------------------------------------
// BREAKDOWN TABLE
// ------------------------------------------------------------

function DagTypeDot({ type }: { type: 'hverdag' | 'helg' | 'helligdag' }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full mr-1',
        type === 'hverdag' && 'bg-green-500',
        type === 'helg' && 'bg-yellow-400',
        type === 'helligdag' && 'bg-red-500'
      )}
    />
  )
}

const RULE_LABELS: Record<AppliedATFRule, { text: string; color: string }> = {
  planned_atf:                 { text: 'Planlagt ATF — normal sats', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  unplanned_daily_atf_first50: { text: 'Ikke-planlagt døgnbasert ATF — første døgn +50 % øk. komp. (ATF pkt 5.2.1)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  unplanned_hourly_hta_ot:     { text: 'Ikke-planlagt timebasert — HTA-overtid OT 100 % (ATF pkt 5.2.1)', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
}

function BreakdownTable({
  rows,
  annualSalary,
  taxPercent,
  taxPercentSource,
  payoutMonth,
  appliedRule,
}: {
  rows: ATFDatoRad[]
  annualSalary: number
  taxPercent?: number
  taxPercentSource?: 'slipp' | 'fallback'
  payoutMonth?: number
  appliedRule?: AppliedATFRule
}) {
  const effectivePct = taxPercent ?? DEFAULT_TAX_PCT
  const brutto = sumATFDatoRader(rows)
  const skatteEstimat = Math.round(brutto * effectivePct / 100)
  const netto = brutto - skatteEstimat
  const tidskompensasjon = beregnTidskompensasjonFromRows(rows)
  const isFallback = !taxPercent || taxPercentSource === 'fallback'

  const ruleInfo = appliedRule ? RULE_LABELS[appliedRule] : null

  return (
    <div className="space-y-2">
      {ruleInfo && (
        <div className={cn('rounded border px-2.5 py-1.5 text-xs font-medium', ruleInfo.color)}>
          {ruleInfo.text}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1 pr-2 font-medium">Dato</th>
              <th className="text-left py-1 pr-2 font-medium">Dag</th>
              <th className="text-left py-1 pr-2 font-medium">Artskode</th>
              <th className="text-left py-1 pr-2 font-medium">Beskrivelse</th>
              <th className="text-right py-1 pr-2 font-medium">Ant</th>
              <th className="text-right py-1 pr-2 font-medium">Sats</th>
              <th className="text-right py-1 font-medium">Beløp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn('border-b border-border/50', row.isFirstDayBonus && 'bg-amber-500/5')}>
                <td className="py-1 pr-2 font-mono">{formatDate(row.dato)}</td>
                <td className="py-1 pr-2">
                  <span className="flex items-center">
                    <DagTypeDot type={row.dagType} />
                    <span className="capitalize">{row.dagType}</span>
                  </span>
                </td>
                <td className="py-1 pr-2 font-mono text-muted-foreground">{row.artskode}</td>
                <td className="py-1 pr-2">
                  {row.beskrivelse}
                  {row.isFirstDayBonus && (
                    <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded">+50%</span>
                  )}
                </td>
                <td className="py-1 pr-2 text-right font-mono">
                  {row.antall} {row.enhet === 'timer' ? 't' : 'døgn'}
                </td>
                <td className="py-1 pr-2 text-right font-mono">{fmtSats(row.sats)}</td>
                <td className="py-1 text-right font-mono font-medium">{fmtNOK(row.belop)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td colSpan={6} className="py-1 pr-2 text-xs uppercase tracking-wide">
                BRUTTO
              </td>
              <td className="py-1 text-right font-mono text-green-500">{fmtNOK(brutto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-md bg-muted/40 p-3 space-y-1.5 text-xs">
        {annualSalary > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>
              Skatteestimering ({effectivePct.toFixed(2)}% /440-trekk
              {isFallback ? ', anslag' : ' fra slipp'})
            </span>
            <span className="font-mono">−{fmtNOK(skatteEstimat)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Estimert netto</span>
          <span className="font-mono text-green-500">{fmtNOK(netto)}</span>
        </div>
        {tidskompensasjon > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tidskompensasjon</span>
            <span className="font-mono">{tidskompensasjon} timer</span>
          </div>
        )}
        {payoutMonth === 12 ? (
          <p className="text-blue-400/90 pt-0.5">
            🎄 Desember-utbetaling: halvskatt-tabell brukes noen år (historisk 25–27% effektiv sats), men ikke alltid — sjekk faktisk slipp.
          </p>
        ) : (
          <p className="text-yellow-500/90 pt-0.5">
            ⚠ Faktisk skattetrekk kan være høyere ved stor ATF-utbetaling (tabelltrekket er progressivt).
          </p>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// SATS CARD
// ------------------------------------------------------------

function SatsCard({
  annualSalary,
  fixedAdditions = 0,
  knownATFRates,
}: {
  annualSalary: number
  fixedAdditions?: number
  knownATFRates?: Record<string, KnownATFRate>
}) {
  const rates = calculateATFRates(annualSalary, fixedAdditions, knownATFRates)
  const sourceLabel = getATFRatesSourceLabel(knownATFRates)
  const isEstimated = !knownATFRates || Object.keys(knownATFRates).length === 0
  const items = [
    { label: 'Hverdag-døgn', value: fmtNOK(rates.ovingHverdag) },
    { label: 'Helg-døgn', value: fmtNOK(rates.ovingHelg) },
    { label: 'Helligdag-døgn', value: fmtNOK(rates.ovingHelligdag) },
    { label: 'Pr time hverdag', value: fmtSats(rates.ovingPrTimeHverdag) + '/t' },
    { label: 'Pr time helg', value: fmtSats(rates.ovingPrTimeHelg) + '/t' },
    { label: 'Inntil 7t 50%', value: fmtSats(rates.ovingInntil7t50Hverdag) + '/t' },
  ]
  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
          Gjeldende satser
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-mono font-medium text-sm">{item.value}</p>
            </div>
          ))}
        </div>
        <p className={cn('text-xs', isEstimated ? 'text-yellow-500' : 'text-muted-foreground')}>
          {sourceLabel}
        </p>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------
// NY ØVELSE MODAL
// ------------------------------------------------------------

function NyØvelseModal({
  defaultAnnualSalary,
  year,
  knownATFRates,
  tableTaxPercent,
  initialEntry,
  onSave,
  onCancel,
}: {
  defaultAnnualSalary: number
  year: number
  knownATFRates?: Record<string, KnownATFRate>
  tableTaxPercent?: number
  initialEntry?: ATFEntry
  onSave: (entry: ATFEntry) => void
  onCancel: () => void
}) {
  const editing = !!initialEntry
  const [navn, setNavn] = useState(initialEntry?.øvelsesnavn ?? '')
  const [øvelsestype, setØvelsestype] = useState<'døgn' | 'time'>(initialEntry?.øvelsestype ?? 'døgn')
  const [fraDato, setFraDato] = useState(initialEntry?.fraDateISO?.slice(0, 10) ?? '')
  const [fraTid, setFraTid] = useState(initialEntry?.fraDateISO?.slice(11, 16) ?? '07:30')
  const [tilDato, setTilDato] = useState(initialEntry?.tilDateISO?.slice(0, 10) ?? '')
  const [tilTid, setTilTid] = useState(initialEntry?.tilDateISO?.slice(11, 16) ?? '15:30')
  const [årslønn, setÅrslønn] = useState(
    initialEntry?.årslønnInput
      ? String(initialEntry.årslønnInput)
      : defaultAnnualSalary > 0 ? String(Math.round(defaultAnnualSalary)) : ''
  )
  const [fasteTillegg, setFasteTillegg] = useState(
    initialEntry?.fasteTilleggInput != null ? String(initialEntry.fasteTilleggInput) : '0'
  )
  const [notat, setNotat] = useState(initialEntry?.notat ?? '')
  const [excludeFromBudget, setExcludeFromBudget] = useState(initialEntry?.excludeFromBudget ?? false)
  const [planningStatus, setPlanningStatus] = useState<PlanningStatus>(initialEntry?.planningStatus ?? 'planned')
  const [showBreakdown, setShowBreakdown] = useState(false)

  // Parse dates
  const fraISO = fraDato && fraTid ? `${fraDato}T${fraTid}` : null
  const tilISO = tilDato && tilTid ? `${tilDato}T${tilTid}` : null
  const fra = fraISO ? new Date(fraISO) : null
  const til = tilISO ? new Date(tilISO) : null


  const parsedSalary = parseFloat(årslønn.replace(/\s/g, '')) || 0
  const parsedTillegg = parseFloat(fasteTillegg.replace(/\s/g, '')) || 0

  // Utbetalingsmåned = måneden etter øvelsens slutt
  const payoutMonth = til ? new Date(til.getFullYear(), til.getMonth() + 1, 1).getMonth() + 1 : undefined

  // Validation
  const datesValid = fra && til && til > fra
  const durationOk = øvelsestype === 'time' || (datesValid && (til!.getTime() - fra!.getTime()) >= 60 * 60 * 1000)
  const isValid = navn.trim().length > 0 && datesValid && durationOk

  // Live computation
  let rows: ATFDatoRad[] = []
  let appliedRule: AppliedATFRule | undefined
  let computeError: string | null = null
  if (fra && til && datesValid && parsedSalary > 0) {
    try {
      const result = beregnATFMedPlanstatus(fra, til, parsedSalary, parsedTillegg, øvelsestype, knownATFRates, planningStatus)
      rows = result.rows
      appliedRule = result.appliedRule
    } catch (err) {
      computeError = err instanceof Error ? err.message : 'Beregningsfeil'
      rows = []
    }
  }

  const brutto = sumATFDatoRader(rows)
  const tidskompensasjon = beregnTidskompensasjonFromRows(rows)

  // Summary stats
  const døgnRader = rows.filter(r => r.enhet === 'døgn')
  const hverdagDøgn = døgnRader.filter(r => r.dagType === 'hverdag').length
  const helgDøgn = døgnRader.filter(r => r.dagType === 'helg').length + døgnRader.filter(r => r.dagType === 'helligdag').length
  const totalDager = døgnRader.length

  function handleSave() {
    if (!isValid || !fra || !til) return
    // Utbetaling skjer normalt måneden etter øvelsens slutt
    const payoutDate = new Date(til.getFullYear(), til.getMonth() + 1, 1)
    const payoutMonth = payoutDate.getMonth() + 1
    const payoutYear = payoutDate.getFullYear()
    onSave({
      id: initialEntry?.id ?? crypto.randomUUID(),
      year,
      øvelsesnavn: navn.trim(),
      perioder: [],
      beregnetBeløp: brutto,
      tidskompensasjonTimer: tidskompensasjon,
      notat: notat.trim() || undefined,
      fraDateISO: fraISO ?? undefined,
      tilDateISO: tilISO ?? undefined,
      øvelsestype,
      datoRader: rows.length > 0 ? rows : undefined,
      payoutMonth,
      payoutYear,
      årslønnInput: parsedSalary || undefined,
      fasteTilleggInput: parsedTillegg || undefined,
      excludeFromBudget: excludeFromBudget || undefined,
      planningStatus,
      appliedRule,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-base">{editing ? 'Rediger øvelse' : 'Ny øvelse'}</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>✕</Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Navn */}
          <div className="space-y-1">
            <Label className="text-xs">Øvelsesnavn</Label>
            <Input
              value={navn}
              onChange={e => setNavn(e.target.value)}
              placeholder="f.eks. Joint Viking 2026"
            />
          </div>

          {/* Øvelsestype */}
          <div className="space-y-1">
            <Label className="text-xs">Øvelsestype</Label>
            <Select value={øvelsestype} onValueChange={v => setØvelsestype(v as 'døgn' | 'time')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="døgn">Øving døgn</SelectItem>
                <SelectItem value="time">Øving pr time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Planleggingsstatus */}
          <div className="space-y-1.5">
            <Label className="text-xs">Planleggingsstatus (ATF pkt 5.2.1)</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanningStatus('planned')}
                className={cn(
                  'flex-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                  planningStatus === 'planned'
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'border-border text-muted-foreground hover:border-border/80'
                )}
              >
                Planlagt
              </button>
              <button
                type="button"
                onClick={() => setPlanningStatus('unplanned')}
                className={cn(
                  'flex-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                  planningStatus === 'unplanned'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'border-border text-muted-foreground hover:border-border/80'
                )}
              >
                Ikke-planlagt
              </button>
            </div>
            {planningStatus === 'unplanned' && (
              <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5">
                {øvelsestype === 'døgn'
                  ? 'Ikke-planlagt døgnbasert: første døgn får +50 % forhøyet økonomisk kompensasjon (ATF pkt 5.2.1).'
                  : 'Ikke-planlagt timebasert: beregnes som HTA-overtid OT 100 % i stedet for ATF-timesatser (ATF pkt 5.2.1).'}
              </p>
            )}
          </div>

          {/* Fra */}
          <div className="space-y-1">
            <Label className="text-xs">Fra</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={fraDato}
                onChange={e => setFraDato(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={fraTid}
                onChange={e => setFraTid(e.target.value)}
                className="w-28"
              />
            </div>
          </div>

          {/* Til */}
          <div className="space-y-1">
            <Label className="text-xs">Til</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={tilDato}
                onChange={e => setTilDato(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={tilTid}
                onChange={e => setTilTid(e.target.value)}
                className="w-28"
              />
            </div>
            {fra && til && !datesValid && (
              <p className="text-xs text-red-500">Fra-tid må være før Til-tid</p>
            )}
            {fra && til && datesValid && øvelsestype === 'døgn' && !durationOk && (
              <p className="text-xs text-red-500">Varighet må være minst 1 time for døgn-øvelse</p>
            )}
          </div>

          {/* Årslønn */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Årslønn (kr)</Label>
              <Input
                type="number"
                value={årslønn}
                onChange={e => setÅrslønn(e.target.value)}
                placeholder="720100"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Faste tillegg (kr/år)</Label>
              <Input
                type="number"
                value={fasteTillegg}
                onChange={e => setFasteTillegg(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Beregningsfeil */}
          {computeError && (
            <p className="text-xs text-red-500">Beregningsfeil: {computeError}</p>
          )}

          {/* Live preview */}
          {rows.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimert brutto:</span>
                <span className="text-base font-semibold font-mono text-green-500">
                  {fmtNOK(brutto)}
                </span>
              </div>
              {totalDager > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalDager} dager totalt — {hverdagDøgn} hverdag-døgn, {helgDøgn} helg/helligdag-døgn
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs w-full"
                onClick={() => setShowBreakdown(v => !v)}
              >
                {showBreakdown ? 'Skjul' : 'Se'} detaljert breakdown
              </Button>
              {showBreakdown && (
                <BreakdownTable
                  rows={rows}
                  annualSalary={parsedSalary}
                  taxPercent={tableTaxPercent}
                  taxPercentSource={tableTaxPercent ? 'slipp' : 'fallback'}
                  payoutMonth={payoutMonth}
                  appliedRule={appliedRule}
                />
              )}
            </div>
          )}

          {/* Notat */}
          <div className="space-y-1">
            <Label className="text-xs">Notat (valgfritt)</Label>
            <Input
              value={notat}
              onChange={e => setNotat(e.target.value)}
              placeholder="Kommentar..."
            />
          </div>

          {/* Skjul fra budsjett */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeFromBudget}
              onChange={e => setExcludeFromBudget(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-xs text-muted-foreground">Skjul fra budsjett (ATF-summen telles ikke med i budsjettprognosen)</span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
            <Button size="sm" onClick={handleSave} disabled={!isValid}>{editing ? 'Lagre endringer' : 'Lagre øvelse'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

export function ATFPage() {
  const { atfEntries, addATFEntry, updateATFEntry, removeATFEntry, profile, monthHistory } = useEconomyStore()
  const [activeYear, setActiveYear] = useState(CURRENT_YEAR)
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ATFEntry | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Bruk fremskrevet lønn for fremtidige år (lønnsoppgjør skjer typisk mai)
  const trend = estimateSalaryTrend(monthHistory)
  const annualSalary = profile
    ? projectMonthlySalary(trend, activeYear, 5) * 12  // bruk mai (etter forventet oppgjør)
    : 0
  const fixedAdditions = profile
    ? profile.fixedAdditions.reduce((s, a) => s + a.amount * 12, 0)
    : 0
  const knownATFRates = profile?.knownATFRates
  const tableTaxPercent = profile?.lastKnownTableTaxPercent

  const yearEntries = atfEntries.filter((e) => (e.payoutYear ?? e.year) === activeYear)
  const yearSum = sumATFByYear(atfEntries, activeYear)
  const prevYearSum = sumATFByYear(atfEntries, activeYear - 1)

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ATF-kalkulator</h2>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Ny øvelse
        </Button>
      </div>

      {/* Year tabs */}
      <div className="flex gap-2">
        {YEARS.map((y) => (
          <Button
            key={y}
            variant={activeYear === y ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveYear(y)}
          >
            {y}
          </Button>
        ))}
      </div>

      {/* Sats card */}
      {annualSalary > 0 && (
        <SatsCard annualSalary={annualSalary} fixedAdditions={fixedAdditions} knownATFRates={knownATFRates} />
      )}

      {/* Modal — ny eller rediger */}
      {(showModal || editingEntry) && (
        <NyØvelseModal
          defaultAnnualSalary={annualSalary}
          year={activeYear}
          knownATFRates={knownATFRates}
          tableTaxPercent={tableTaxPercent}
          initialEntry={editingEntry ?? undefined}
          onSave={(entry) => {
            if (editingEntry) {
              updateATFEntry(entry.id, entry)
            } else {
              addATFEntry(entry)
            }
            setShowModal(false)
            setEditingEntry(null)
          }}
          onCancel={() => { setShowModal(false); setEditingEntry(null) }}
        />
      )}

      {/* Entry list */}
      {yearEntries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ingen øvelser registrert for {activeYear}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {yearEntries.map((entry) => {
            const isExpanded = expandedId === entry.id
            const hasDateRows = entry.datoRader && entry.datoRader.length > 0
            const oldResult =
              !hasDateRows && annualSalary > 0 && entry.perioder.length > 0
                ? calculateATF(entry, annualSalary)
                : null

            return (
              <Card key={entry.id}>
                <CardContent className="py-3 px-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{entry.øvelsesnavn}</span>
                          {entry.planningStatus === 'unplanned' && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-medium">
                              Ikke-planlagt
                            </span>
                          )}
                        </div>
                        {entry.fraDateISO && entry.tilDateISO && (
                          <p className="text-xs text-muted-foreground">
                            {formatDateRange(entry.fraDateISO, entry.tilDateISO)}
                          </p>
                        )}
                        {entry.payoutMonth && (
                          <p className="text-xs text-blue-400">
                            Utbet. {MONTH_SHORT[entry.payoutMonth]} {entry.payoutYear ?? entry.year}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={cn('font-mono font-semibold text-sm mr-1', entry.excludeFromBudget ? 'text-muted-foreground line-through' : 'text-green-500')}>
                        {fmtNOK(entry.beregnetBeløp)}
                      </span>
                      <button
                        title={entry.excludeFromBudget ? 'Inkluder i budsjett' : 'Skjul fra budsjett'}
                        className={cn('text-[10px] px-1.5 py-0.5 rounded border transition-colors mr-1', entry.excludeFromBudget ? 'border-muted-foreground/30 text-muted-foreground' : 'border-green-500/30 text-green-400')}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateATFEntry(entry.id, { ...entry, excludeFromBudget: !entry.excludeFromBudget || undefined })
                        }}
                      >
                        {entry.excludeFromBudget ? 'budsjett av' : 'budsjett på'}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingEntry(entry)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeATFEntry(entry.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-border pt-3">
                      {hasDateRows ? (
                        <BreakdownTable
                          rows={entry.datoRader!}
                          annualSalary={annualSalary}
                          taxPercent={tableTaxPercent}
                          taxPercentSource={tableTaxPercent ? 'slipp' : 'fallback'}
                          payoutMonth={entry.payoutMonth}
                          appliedRule={entry.appliedRule}
                        />
                      ) : oldResult ? (
                        <div className="space-y-2">
                          {oldResult.breakdown.map((b, i) => (
                            <div key={i} className="text-xs text-muted-foreground flex justify-between">
                              <span>{b.beskrivelse}</span>
                              <span className="font-mono">{fmtNOK(b.belop)}</span>
                            </div>
                          ))}
                          {entry.tidskompensasjonTimer > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Tidskompensasjon: {entry.tidskompensasjonTimer} timer
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Ingen detaljert breakdown tilgjengelig.</p>
                      )}
                      {entry.notat && (
                        <p className="text-xs text-muted-foreground italic mt-2">{entry.notat}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Year total */}
      <Card>
        <CardContent className="py-3 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">Sum {activeYear}</p>
            {prevYearSum > 0 && (
              <p className="text-xs text-muted-foreground">
                Forrige år: {fmtNOK(prevYearSum)}
              </p>
            )}
          </div>
          <span className="text-lg font-semibold font-mono text-green-500">
            {fmtNOK(yearSum)}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
