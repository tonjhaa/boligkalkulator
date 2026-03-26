import { useState } from 'react'
import { TrendingDown, TrendingUp, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { NumberInput } from '@/components/ui/number-input'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { useEconomyStore } from '@/application/useEconomyStore'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
import { computeBudgetTable } from '@/domain/economy/budgetTableComputer'
import { forecastJune } from '@/domain/economy/holidayPayCalculator'
import { cn } from '@/lib/utils'
import type { TaxSettlementRecord } from '@/types/economy'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

export function TaxSettlementPage() {
  const {
    taxSettlements,
    addTaxSettlement,
    removeTaxSettlement,
    profile,
    setProfile,
    monthHistory,
    budgetTemplate,
    atfEntries,
    savingsAccounts,
    debts,
    subscriptions,
    insurances,
    temporaryPayEntries,
    budgetOverrides,
    fondPortfolio,
  } = useEconomyStore()

  const [showAddForm, setShowAddForm] = useState(false)

  const analysis = analyzeTaxSettlements(taxSettlements, profile?.extraTaxWithholding ?? 0)

  const chartData = [...taxSettlements]
    .sort((a, b) => a.year - b.year)
    .map((r) => ({
      year: r.year,
      beløp: -r.skattTilGodeEllerRest,
    }))

  function handleReduceExtra() {
    if (!profile) return
    const newExtra = Math.max(
      0,
      profile.extraTaxWithholding - analysis.recommendedExtraAdjustment
    )
    setProfile({ ...profile, extraTaxWithholding: newExtra })
  }

  const currentYear = new Date().getFullYear()
  const taxForecast = profile?.taxForecast?.year === currentYear ? profile.taxForecast : null

  // Summer faktisk skatt per måned fra alle slipper dette året (matcher budsjettfanen)
  const slipsThisYear = monthHistory
    .filter((m) => m.year === currentYear && m.slipData != null)
    .sort((a, b) => a.month - b.month)

  const skattetrekkYTD = slipsThisYear.reduce((sum, m) => sum + (m.slipData!.skattetrekk ?? 0), 0)
  const ekstraTrekkYTD = slipsThisYear.reduce((sum, m) => sum + (m.slipData!.ekstraTrekk ?? 0), 0)
  const withheldYTD = skattetrekkYTD + ekstraTrekkYTD
  const grossYTD = slipsThisYear.reduce((sum, m) => sum + (m.slipData!.bruttoSum ?? 0), 0)
  const slipMonth = slipsThisYear.length > 0
    ? Math.max(...slipsThisYear.map((m) => m.month))
    : 0

  // Prognose: hent direkte fra budsjettabellen, identisk med hva budsjettfanen viser
  const juneForecast = profile ? forecastJune(currentYear, monthHistory, profile, atfEntries) : null
  const yearOverrides: Record<string, number> = {}
  for (const [k, v] of Object.entries(budgetOverrides)) {
    const prefix = `${currentYear}:`
    if (k.startsWith(prefix)) yearOverrides[k.slice(prefix.length)] = v
  }
  const budgetTable = profile
    ? computeBudgetTable(currentYear, profile, budgetTemplate, monthHistory, atfEntries, savingsAccounts, debts, subscriptions, insurances, yearOverrides, temporaryPayEntries, juneForecast ?? undefined, false, [], fondPortfolio)
    : null
  const allRows = budgetTable?.sections.flatMap((s) => s.rows) ?? []
  const skattRow = allRows.find((r) => r.id === 'skatt')
  const ekstraRow = allRows.find((r) => r.id === 'ekstra')
  const bruttoRow = allRows.find((r) => r.id === 'brutto')
  const projectedWithheld = skattRow && ekstraRow
    ? Math.abs(skattRow.annualActual) + Math.abs(ekstraRow.annualActual)
    : slipMonth > 0 ? Math.round((withheldYTD / slipMonth) * 12) : 0
  const projectedIncome = bruttoRow
    ? Math.abs(bruttoRow.annualActual)
    : slipMonth > 0 ? Math.round((grossYTD / slipMonth) * 12) : 0

  // Avvik mot meldt skatt
  const expectedTax = taxForecast?.expectedTax ?? 0
  const deficit = expectedTax > 0 ? expectedTax - projectedWithheld : null
  const monthsRemaining = 12 - slipMonth
  const monthlyAdjustment = deficit !== null && monthsRemaining > 0
    ? Math.round(deficit / monthsRemaining)
    : null

  const onTrack = deficit !== null && Math.abs(deficit) < 2000
  const overPaying = deficit !== null && deficit < -2000
  const underPaying = deficit !== null && deficit > 2000

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Skatteoppgjør</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          + Legg til
        </Button>
      </div>

      {/* ── Prognose for inneværende år ── */}
      <TaxForecastSection
        currentYear={currentYear}
        taxForecast={taxForecast}
        skattetrekkYTD={skattetrekkYTD}
        ekstraTrekkYTD={ekstraTrekkYTD}
        withheldYTD={withheldYTD}
        projectedWithheld={projectedWithheld}
        projectedIncome={projectedIncome}
        slipMonth={slipMonth}
        deficit={deficit}
        monthlyAdjustment={monthlyAdjustment}
        onTrack={onTrack}
        overPaying={overPaying}
        underPaying={underPaying}
        onSaveForecast={(expectedIncome, expectedTax) => {
          if (!profile) return
          setProfile({ ...profile, taxForecast: { year: currentYear, expectedIncome, expectedTax } })
        }}
        onClearForecast={() => {
          if (!profile) return
          setProfile({ ...profile, taxForecast: undefined })
        }}
      />

      {/* Anbefaling */}
      {analysis.recommendation !== 'keep' && taxSettlements.length >= 2 && (
        <div className={`rounded-md p-3 border text-sm ${
          analysis.recommendation === 'reduce_extra'
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {analysis.recommendation === 'reduce_extra'
              ? <TrendingDown className="h-4 w-4 shrink-0" />
              : <TrendingUp className="h-4 w-4 shrink-0" />
            }
            <span className="font-medium">Anbefaling</span>
          </div>
          <p className="text-xs">{analysis.reasoning}</p>
          {analysis.recommendation === 'reduce_extra' && profile && (
            <div className="mt-3 flex items-center gap-3">
              <div className="text-xs">
                <span className="text-muted-foreground">Nåværende ekstra trekk: </span>
                <span className="font-mono">{fmtNOK(profile.extraTaxWithholding)}/mnd</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleReduceExtra}>
                Reduser med {fmtNOK(analysis.recommendedExtraAdjustment)}/mnd
              </Button>
            </div>
          )}
          {analysis.recommendation === 'reduce_extra' && analysis.recommendedExtraAdjustment > 0 && (
            <p className="text-xs mt-2 text-green-400">
              Dette gir deg ~{fmtNOK(analysis.recommendedExtraAdjustment)} mer disponibelt per måned.
            </p>
          )}
        </div>
      )}

      {/* Graf */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Til gode / restskatt per år</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(v) => [
                    fmtNOK(Number(v)),
                    Number(v) >= 0 ? 'Til gode' : 'Restskatt',
                  ]}
                />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                <Bar dataKey="beløp" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.beløp >= 0 ? '#22C55E' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Legg til skjema */}
      {showAddForm && (
        <AddSettlementForm
          onSave={(r) => { addTaxSettlement(r); setShowAddForm(false) }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Tabell */}
      {taxSettlements.length === 0 && !showAddForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Ingen skatteoppgjør registrert. Legg til for å få anbefalinger om ekstra trekk.
            </p>
            <Button size="sm" onClick={() => setShowAddForm(true)}>Legg til skatteoppgjør</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historikk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-xs">År</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Pensjonsgivende inntekt</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Til gode / Restskatt</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...taxSettlements]
                    .sort((a, b) => b.year - a.year)
                    .map((r) => {
                      const tilgode = -r.skattTilGodeEllerRest
                      return (
                        <tr key={r.year} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-xs font-medium">{r.year}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {r.pensjonsgivendeInntekt ? fmtNOK(r.pensjonsgivendeInntekt) : '—'}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono text-xs font-medium ${tilgode >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                            {tilgode >= 0 ? '+' : ''}{fmtNOK(tilgode)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground"
                              onClick={() => removeTaxSettlement(r.year)}
                            >
                              Fjern
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {taxSettlements.length >= 2 && (
              <p className="text-xs text-muted-foreground mt-2">
                Snitt siste {Math.min(3, taxSettlements.length)} år:{' '}
                <span className={analysis.avgYearlyRefund >= 0 ? 'text-green-500' : 'text-red-400'}>
                  {analysis.avgYearlyRefund >= 0 ? '+' : ''}{fmtNOK(analysis.avgYearlyRefund)}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// SKATTEPROGNOSE
// ------------------------------------------------------------

function TaxForecastSection({
  currentYear,
  taxForecast,
  skattetrekkYTD,
  ekstraTrekkYTD,
  withheldYTD,
  projectedWithheld,
  projectedIncome,
  slipMonth,
  deficit,
  monthlyAdjustment,
  onTrack,
  overPaying,
  underPaying,
  onSaveForecast,
  onClearForecast,
}: {
  currentYear: number
  taxForecast: { year: number; expectedIncome: number; expectedTax: number } | null
  skattetrekkYTD: number
  ekstraTrekkYTD: number
  withheldYTD: number
  projectedWithheld: number
  projectedIncome: number
  slipMonth: number
  deficit: number | null
  monthlyAdjustment: number | null
  onTrack: boolean
  overPaying: boolean
  underPaying: boolean
  onSaveForecast: (income: number, tax: number) => void
  onClearForecast: () => void
}) {
  const [editing, setEditing] = useState(!taxForecast)
  const [income, setIncome] = useState(taxForecast?.expectedIncome ?? 0)
  const [tax, setTax] = useState(taxForecast?.expectedTax ?? 0)

  function handleSave() {
    if (income > 0 && tax > 0) {
      onSaveForecast(income, tax)
      setEditing(false)
    }
  }

  const progressPct = taxForecast ? Math.min(100, (projectedWithheld / taxForecast.expectedTax) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Prognose {currentYear}</CardTitle>
          {taxForecast && !editing && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { setIncome(taxForecast.expectedIncome); setTax(taxForecast.expectedTax); setEditing(true) }}>
                Endre
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={onClearForecast}>
                Fjern
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inntasting av meldt skatt */}
        {editing && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Hent tallene fra skattemeldingen / skattekortet du har sendt inn for {currentYear}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Forventet inntekt</Label>
                <NumberInput value={income} onChange={setIncome} suffix="kr" step={10000} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Forventet skatt å betale</Label>
                <NumberInput value={tax} onChange={setTax} suffix="kr" step={1000} min={0} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={income <= 0 || tax <= 0}>Lagre</Button>
              {taxForecast && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Avbryt</Button>}
            </div>
          </div>
        )}

        {/* Prognose-resultater */}
        {taxForecast && !editing && (
          <div className="space-y-4">
            {/* Status-banner */}
            {slipMonth === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/30 px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Ingen slipper lastet for {currentYear} ennå — last opp for å se prognose.
              </div>
            ) : onTrack ? (
              <div className="flex items-center gap-2 text-xs text-green-400 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Du er på skiva! Prognosen treffer forventet skatt innenfor ±2 000 kr.
              </div>
            ) : overPaying ? (
              <div className="flex items-center gap-2 text-xs text-yellow-400 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                Du betaler for mye. Prognosen tilsier {fmtNOK(Math.abs(deficit!))} til gode ved oppgjør.
                {monthlyAdjustment !== null && monthlyAdjustment < 0 && (
                  <span> Du kan redusere trekk med ca. {fmtNOK(Math.abs(monthlyAdjustment))}/mnd.</span>
                )}
              </div>
            ) : underPaying ? (
              <div className="flex items-center gap-2 text-xs text-red-400 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Du risikerer restskatt på ~{fmtNOK(deficit!)} ved årets slutt.
                {monthlyAdjustment !== null && monthlyAdjustment > 0 && (
                  <span> Øk trekk med ca. {fmtNOK(monthlyAdjustment)}/mnd.</span>
                )}
              </div>
            ) : null}

            {/* Fremgangsbar */}
            {slipMonth > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Innbetalt trekk (prognose hele år)</span>
                  <span className={cn(
                    'font-mono font-medium',
                    onTrack ? 'text-green-400' : underPaying ? 'text-red-400' : 'text-yellow-400'
                  )}>
                    {fmtNOK(projectedWithheld)} / {fmtNOK(taxForecast.expectedTax)}
                  </span>
                </div>
                <Progress
                  value={progressPct}
                  className={cn(
                    'h-2',
                    onTrack ? '[&>div]:bg-green-500' : underPaying ? '[&>div]:bg-red-500' : '[&>div]:bg-yellow-500'
                  )}
                />
              </div>
            )}

            {/* Detaljert tabell */}
            {slipMonth > 0 && (
              <div className="text-xs space-y-1.5 border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skattetrekk (/440) hittil ({slipMonth} mnd)</span>
                  <span className="font-mono">{fmtNOK(skattetrekkYTD)}</span>
                </div>
                {ekstraTrekkYTD > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ekstra forskuddstrekk (1620) hittil</span>
                    <span className="font-mono">{fmtNOK(ekstraTrekkYTD)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Sum trekk hittil</span>
                  <span className="font-mono">{fmtNOK(withheldYTD)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1.5">
                  <span className="text-muted-foreground">Prognose hele år (12 mnd)</span>
                  <span className="font-mono">{fmtNOK(projectedWithheld)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forventet skatt (meldt)</span>
                  <span className="font-mono">{fmtNOK(taxForecast.expectedTax)}</span>
                </div>
                <div className="flex justify-between font-medium border-t border-border pt-1.5">
                  <span>Avvik</span>
                  <span className={cn(
                    'font-mono',
                    onTrack ? 'text-green-400' : underPaying ? 'text-red-400' : 'text-yellow-400'
                  )}>
                    {deficit! >= 0 ? '+' : ''}{fmtNOK(deficit!)}
                  </span>
                </div>
                {projectedIncome > 0 && (
                  <div className="flex justify-between text-muted-foreground pt-1">
                    <span>Prognose bruttoinntekt</span>
                    <span className="font-mono">{fmtNOK(projectedIncome)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------
// SKJEMA
// ------------------------------------------------------------

function AddSettlementForm({
  onSave,
  onCancel,
}: {
  onSave: (r: TaxSettlementRecord) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    year: new Date().getFullYear() - 1,
    skattTilGodeEllerRest: 0,
    pensjonsgivendeInntekt: '' as string | number,
    skattInnbetalt: '' as string | number,
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Legg til skatteoppgjør</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Inntektsår</Label>
            <Input
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) || f.year }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Til gode (negativt = restskatt)</Label>
            <Input
              type="number"
              value={form.skattTilGodeEllerRest}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  skattTilGodeEllerRest: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="-5000 = 5 000 kr tilgode"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pensjonsgivende inntekt (valgfritt)</Label>
            <Input
              type="number"
              value={form.pensjonsgivendeInntekt}
              onChange={(e) =>
                setForm((f) => ({ ...f, pensjonsgivendeInntekt: parseFloat(e.target.value) || '' }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Skatt innbetalt (valgfritt)</Label>
            <Input
              type="number"
              value={form.skattInnbetalt}
              onChange={(e) =>
                setForm((f) => ({ ...f, skattInnbetalt: parseFloat(e.target.value) || '' }))
              }
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button
            size="sm"
            onClick={() =>
              onSave({
                year: form.year,
                skattTilGodeEllerRest: form.skattTilGodeEllerRest,
                pensjonsgivendeInntekt:
                  typeof form.pensjonsgivendeInntekt === 'number' ? form.pensjonsgivendeInntekt : undefined,
                skattInnbetalt:
                  typeof form.skattInnbetalt === 'number' ? form.skattInnbetalt : undefined,
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
