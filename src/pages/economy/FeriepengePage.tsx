import { useState } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useEconomyStore } from '@/application/useEconomyStore'
import {
  forecastAllJunes,
  calculateAccruedHolidayBase,
} from '@/domain/economy/holidayPayCalculator'
import type { JuneForecast, MonthRecord, EmploymentProfile } from '@/types/economy'
import { cn } from '@/lib/utils'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function confidenceLabel(c: 'høy' | 'middels' | 'lav') {
  return c === 'høy' ? '✓ Høy' : c === 'middels' ? '~ Middels' : '? Lav'
}

// ----------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------

interface HistoricalRow {
  year: number
  grunnlag: number
  feriepenger: number
  kilde: 'slipp' | 'estimert'
  payoutYear: number
  actualFeriepenger: number | null   // Fra juni-slipp (utbetalingsår)
  actualNettoJuni: number | null     // Faktisk netto juni
}

function buildHistoricalRows(
  monthHistory: MonthRecord[],
  profile: EmploymentProfile,
  currentYear: number,
): HistoricalRow[] {
  const years = [...new Set(monthHistory.map((r) => r.year))].sort()
  if (years.length === 0) return []

  const rows: HistoricalRow[] = []

  for (const year of years) {
    if (year >= currentYear) continue
    const payoutYear = year + 1

    // Faktisk feriepenger fra juni-slippen i utbetalingsåret
    const juneSlip = monthHistory.find(
      (r) => r.year === payoutYear && r.month === 6 && r.slipData != null,
    )
    const actualFeriepenger = juneSlip
      ? juneSlip.lines
          .filter((l) => l.category === 'feriepenger')
          .reduce((s, l) => s + l.amount, 0) || null
      : null
    const actualNettoJuni = juneSlip?.nettoUtbetalt ?? null

    const decSlip = monthHistory.find(
      (r) => r.year === year && r.month === 12 && (r.slipData?.feriepengegrunnlag ?? 0) > 0,
    )
    if (decSlip?.slipData?.feriepengegrunnlag) {
      const grunnlag = decSlip.slipData.feriepengegrunnlag
      rows.push({
        year,
        grunnlag,
        feriepenger: Math.round(grunnlag * 0.12),
        kilde: 'slipp',
        payoutYear,
        actualFeriepenger,
        actualNettoJuni,
      })
    } else {
      const base = calculateAccruedHolidayBase(year, monthHistory, profile)
      if (base.total > 0) {
        rows.push({
          year,
          grunnlag: base.total,
          feriepenger: Math.round(base.total * 0.12),
          kilde: 'estimert',
          payoutYear,
          actualFeriepenger,
          actualNettoJuni,
        })
      }
    }
  }

  return rows.sort((a, b) => b.year - a.year)
}

export function FeriepengePage() {
  const { profile, monthHistory, atfEntries } = useEconomyStore()
  const [modalYear, setModalYear] = useState<number | null>(null)

  if (!profile) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Ingen lønnsprofil registrert.</p>
      </div>
    )
  }

  const now = new Date()
  const currentYear = now.getFullYear()

  const forecasts = forecastAllJunes(currentYear, monthHistory, profile, atfEntries, 3)
  const [thisYear, nextYear, ...laterYears] = forecasts

  const opptjening = calculateAccruedHolidayBase(currentYear, monthHistory, profile)
  const opptjeningProsent = Math.min(100, Math.round((opptjening.monthsWithSlip / 12) * 100))

  const historicalRows = buildHistoricalRows(monthHistory, profile, currentYear)

  const modalForecast = modalYear != null
    ? forecasts.find((f) => f.year === modalYear) ?? null
    : null

  if (!thisYear || !nextYear) return null

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h2 className="font-semibold">Feriepenger</h2>

      {/* Hovudtabell: dette år vs neste år */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Juni-prognose</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground" />
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                  Juni {thisYear.year}
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                  Juni {nextYear.year}
                </th>
              </tr>
            </thead>
            <tbody>
              <HolidayRow
                label="Feriepengegrunnlag"
                a={thisYear.feriepengegrunnlag}
                b={nextYear.feriepengegrunnlag}
                bIsEstimate={nextYear.confidence !== 'høy'}
              />
              <HolidayRow
                label="Feriepenger (12%)"
                a={thisYear.feriepenger}
                b={nextYear.feriepenger}
                bIsEstimate={nextYear.confidence !== 'høy'}
                positive
              />
              <HolidayRow
                label="Ferietrekk (25 dager)"
                a={-thisYear.ferietrekk}
                b={-nextYear.ferietrekk}
                negative
              />
              <HolidayRow
                label="Netto ekstra i juni"
                a={thisYear.nettoEkstra}
                b={nextYear.nettoEkstra}
                signed
                bold
              />
              <HolidayRow
                label="Skattetrekk i juni"
                a={-thisYear.skattetrekk}
                b={-nextYear.skattetrekk}
                negative
              />
              <HolidayRow
                label="Estimert netto juni"
                a={thisYear.nettoJuni}
                b={nextYear.nettoJuni}
                bIsEstimate={nextYear.confidence !== 'høy'}
                positive
                bold
              />
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td className="px-4 py-2 text-xs text-muted-foreground">Konfidensgrad</td>
                <td className="px-3 py-2 text-right text-xs">
                  <button className="underline hover:text-foreground" onClick={() => setModalYear(thisYear.year)}>
                    {confidenceLabel(thisYear.confidence)}
                  </button>
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  <button className="underline hover:text-foreground" onClick={() => setModalYear(nextYear.year)}>
                    {confidenceLabel(nextYear.confidence)}
                  </button>
                </td>
              </tr>
              <tr>
                <td className="px-4 pb-3 text-xs text-muted-foreground">Kilde grunnlag</td>
                <td className="px-3 pb-3 text-right text-xs text-muted-foreground">
                  {thisYear.kilder.feriepengegrunnlag}
                </td>
                <td className="px-4 pb-3 text-right text-xs text-muted-foreground">
                  {nextYear.kilder.feriepengegrunnlag}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Løpende opptjening (grunnlag for neste juni) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Opptjening {currentYear} → grunnlag for juni {currentYear + 1}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Slipper importert</span>
            <span>{opptjening.monthsWithSlip}/12</span>
          </div>
          <Progress value={opptjeningProsent} className="h-1.5" />
          <div className="grid grid-cols-3 gap-3 text-xs pt-1">
            <div>
              <p className="text-muted-foreground">Opptjent (slipper)</p>
              <p className="font-mono font-medium">{fmtNOK(opptjening.actual)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Estimert rest</p>
              <p className="font-mono font-medium">~{fmtNOK(opptjening.projected)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Prosjektert grunnlag</p>
              <p className="font-mono font-medium">~{fmtNOK(opptjening.total)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimert feriepenger juni {currentYear + 1}:{' '}
            <span className="font-mono font-medium text-foreground">
              ~{fmtNOK(Math.round(opptjening.total * 0.12))}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Historisk grunnlag */}
      {historicalRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historisk feriepengegrunnlag</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Opptjeningsår</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Grunnlag (des)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Beregnet</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Faktisk (jun)</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Netto juni</th>
                </tr>
              </thead>
              <tbody>
                {historicalRows.map((row) => (
                  <tr key={row.year} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.year}
                      {row.kilde === 'estimert' && (
                        <span className="ml-1.5 text-xs text-yellow-500">~est.</span>
                      )}
                      <span className="ml-1.5 text-xs text-muted-foreground/60">→ jun {row.payoutYear}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {row.grunnlag.toLocaleString('no-NO')} kr
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {fmtNOK(row.feriepenger)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-500">
                      {row.actualFeriepenger != null
                        ? fmtNOK(row.actualFeriepenger)
                        : <span className="text-muted-foreground/50 text-xs">— ingen slipp</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                      {row.actualNettoJuni != null
                        ? fmtNOK(row.actualNettoJuni)
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
                {/* Inneværende år — prognose */}
                <tr className="border-b border-border/50 last:border-0 bg-muted/10">
                  <td className="px-4 py-2 text-muted-foreground">
                    {currentYear}
                    <span className="ml-1.5 text-xs text-blue-400">pågår</span>
                    <span className="ml-1.5 text-xs text-muted-foreground/60">→ jun {currentYear + 1}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    ~{opptjening.total.toLocaleString('no-NO')} kr
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    ~{fmtNOK(Math.round(opptjening.total * 0.12))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground/50 text-xs">
                    —
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground/50 text-xs">
                    —
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Langsiktig oversikt */}
      {laterYears.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fremtidige år (estimert)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">År</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Feriepenger</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Ferietrekk</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Netto ekstra</th>
                </tr>
              </thead>
              <tbody>
                {[nextYear, ...laterYears].map((f) => (
                  <tr key={f.year} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">Juni {f.year}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-500">
                      ~{fmtNOK(f.feriepenger)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-400">
                      -{fmtNOK(f.ferietrekk)}
                    </td>
                    <td className={cn(
                      'px-4 py-2 text-right font-mono font-semibold',
                      f.nettoEkstra >= 0 ? 'text-green-500' : 'text-red-400'
                    )}>
                      {f.nettoEkstra >= 0 ? '+' : ''}{fmtNOK(f.nettoEkstra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Detaljmodal */}
      {modalForecast && (
        <JuneDetailModal forecast={modalForecast} onClose={() => setModalYear(null)} />
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// SHARED HELPERS (also exported for dashboard compact use)
// ----------------------------------------------------------------

export function HolidayRow({
  label,
  a,
  b,
  positive,
  negative,
  signed,
  bold,
  bIsEstimate,
}: {
  label: string
  a: number
  b?: number
  positive?: boolean
  negative?: boolean
  signed?: boolean
  bold?: boolean
  bIsEstimate?: boolean
}) {
  const colorA = positive ? 'text-green-500' : negative ? 'text-red-400' : signed ? (a >= 0 ? 'text-green-500' : 'text-red-400') : ''
  const colorB = b !== undefined
    ? positive
      ? (bIsEstimate ? 'text-green-500/70' : 'text-green-500')
      : negative ? 'text-red-400'
      : signed ? (b >= 0 ? 'text-green-500/70' : 'text-red-400/70')
      : bIsEstimate ? 'text-muted-foreground' : ''
    : ''
  const prefix = signed ? (a >= 0 ? '+' : '') : ''
  const prefixB = b !== undefined && signed ? (b >= 0 ? '+' : '') : ''

  return (
    <tr className={cn('border-b border-border/50 last:border-0', bold && 'bg-muted/20 font-semibold')}>
      <td className="px-4 py-2 text-muted-foreground">{label}</td>
      <td className={cn('px-3 py-2 text-right font-mono', colorA)}>
        {prefix}{fmtNOK(Math.abs(a))}
      </td>
      {b !== undefined && (
        <td className={cn('px-4 py-2 text-right font-mono', colorB)}>
          {bIsEstimate ? '~' : ''}{prefixB}{fmtNOK(Math.abs(b))}
        </td>
      )}
    </tr>
  )
}

function JuneDetailModal({ forecast, onClose }: { forecast: JuneForecast; onClose: () => void }) {
  const rows = [
    { label: 'Feriepengegrunnlag (opptjent forrige år)', value: forecast.feriepengegrunnlag, note: forecast.kilder.feriepengegrunnlag },
    { label: `Feriepenger (12%)`, value: forecast.feriepenger, positive: true },
    { label: `Ferietrekk (${forecast.ferietrekkDagsats.toLocaleString('no-NO')} kr/dag × 25)`, value: -forecast.ferietrekk, negative: true },
    { label: 'Skattepliktig lønn i juni', value: forecast.skattepliktigJuni, note: forecast.kilder.juneLonn },
    ...(forecast.juneATF > 0 ? [{ label: 'ATF i juni', value: forecast.juneATF, positive: true }] : []),
    { label: 'Skattegrunnlag i juni', value: forecast.skattegrunnlag, note: 'max(0, lønn + ATF − ferietrekk)' },
    { label: 'Skattetrekk i juni', value: -forecast.skattetrekk, negative: true },
    { label: 'Andre trekk i juni', value: -forecast.andreJuneTrekk, negative: true },
    { label: 'Netto ekstra i juni', value: forecast.nettoEkstra, bold: true, signed: true },
    { label: 'Estimert netto juni', value: forecast.nettoJuni, bold: true, positive: true },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Feriepenger — Juni {forecast.year}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{confidenceLabel(forecast.confidence)}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={cn('border-b border-border/40 last:border-0', row.bold && 'bg-muted/20 font-semibold')}>
                  <td className="py-2 pr-3 text-muted-foreground">
                    <div>{row.label}</div>
                    {row.note && <div className="text-xs text-muted-foreground/70">{row.note}</div>}
                  </td>
                  <td className={cn(
                    'py-2 text-right font-mono',
                    row.positive ? 'text-green-500' : row.negative ? 'text-red-400' : row.signed ? (row.value >= 0 ? 'text-green-500' : 'text-red-400') : ''
                  )}>
                    {row.signed && row.value > 0 ? '+' : ''}{fmtNOK(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
