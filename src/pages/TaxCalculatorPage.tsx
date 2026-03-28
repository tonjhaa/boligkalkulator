import { useState, useMemo } from 'react'
import { Calculator, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/ui/number-input'
import { useEconomyStore } from '@/application/useEconomyStore'
import { useAppStore } from '@/store/useAppStore'
import { computeBudgetTable } from '@/domain/economy/budgetTableComputer'
import { forecastJune } from '@/domain/economy/holidayPayCalculator'
import { beregnSkatt, CURRENT_RATES, type TaxInput } from '@/domain/economy/norwegianTaxCalc'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function fmtNOK(n: number) {
  if (n === 0) return '0 kr'
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

const EMPTY_INPUT: TaxInput = {
  lonnsInntekt: 0,
  pensjonsinntekt: 0,
  næringsInntekt: 0,
  kapitalInntekt: 0,
  andreFradrag: 0,
  primaerboligVerdi: 0,
  sekundaerboligVerdi: 0,
  bankinnskudd: 0,
  aksjerFondVerdi: 0,
  annenFormue: 0,
  gjeld: 0,
}

// ------------------------------------------------------------
// Main page
// ------------------------------------------------------------

export function TaxCalculatorPage() {
  const {
    profile, monthHistory, budgetTemplate, atfEntries,
    savingsAccounts, debts, subscriptions, insurances,
    temporaryPayEntries, budgetOverrides, fondPortfolio,
    setProfile,
  } = useEconomyStore()
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  // Hent prognose-inntekt fra budsjettabellen
  const currentYear = new Date().getFullYear()
  const juneForecast = profile ? forecastJune(currentYear, monthHistory, profile, atfEntries) : null
  const yearOverrides: Record<string, number> = {}
  for (const [k, v] of Object.entries(budgetOverrides)) {
    if (k.startsWith(`${currentYear}:`)) yearOverrides[k.slice(`${currentYear}:`.length)] = v
  }
  const budgetTable = profile
    ? computeBudgetTable(currentYear, profile, budgetTemplate, monthHistory, atfEntries, savingsAccounts, debts, subscriptions, insurances, yearOverrides, temporaryPayEntries, juneForecast ?? undefined, false, [], fondPortfolio)
    : null
  const allRows = budgetTable?.sections.flatMap((s) => s.rows) ?? []
  const bruttoRow = allRows.find((r) => r.id === 'brutto')
  const projectedIncome = bruttoRow ? Math.abs(bruttoRow.annualActual) : 0

  const [input, setInput] = useState<TaxInput>(() => ({
    ...EMPTY_INPUT,
    lonnsInntekt: projectedIncome > 0 ? projectedIncome : 0,
  }))

  const [showFormue, setShowFormue] = useState(false)

  const result = useMemo(() => beregnSkatt(input, CURRENT_RATES), [input])

  function set(field: keyof TaxInput, value: number) {
    setInput((prev) => ({ ...prev, [field]: value }))
  }

  function prefillFromBudget() {
    setInput((prev) => ({ ...prev, lonnsInntekt: projectedIncome }))
  }

  function sendToSkattPrognose() {
    if (!profile) return
    setProfile({
      ...profile,
      taxForecast: {
        year: currentYear,
        expectedIncome: result.totalInntekt,
        expectedTax: result.totalSkatt,
      },
    })
    setCurrentView('economy')
  }

  const hasFormue = input.primaerboligVerdi > 0 || input.sekundaerboligVerdi > 0
    || input.bankinnskudd > 0 || input.aksjerFondVerdi > 0 || input.annenFormue > 0 || input.gjeld > 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Venstre: inputs ── */}
      <div className="w-full max-w-sm shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Skattekalkulator {CURRENT_RATES.year}</h2>
        </div>

        {/* Inntekt */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inntekt</p>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Lønnsinntekt</Label>
              {projectedIncome > 0 && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={prefillFromBudget}
                >
                  Fyll fra budsjett ({fmtNOK(projectedIncome)})
                </button>
              )}
            </div>
            <NumberInput value={input.lonnsInntekt} onChange={(v) => set('lonnsInntekt', v)} suffix="kr" step={10000} min={0} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Pensjonsinntekt</Label>
            <NumberInput value={input.pensjonsinntekt} onChange={(v) => set('pensjonsinntekt', v)} suffix="kr" step={10000} min={0} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Næringsinntekt</Label>
            <NumberInput value={input.næringsInntekt} onChange={(v) => set('næringsInntekt', v)} suffix="kr" step={10000} min={0} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Kapitalinntekt (netto)</Label>
            <NumberInput value={input.kapitalInntekt} onChange={(v) => set('kapitalInntekt', v)} suffix="kr" step={1000} />
            <p className="text-xs text-muted-foreground">Renteinntekter, utbytte, gevinster minus tap</p>
          </div>
        </div>

        {/* Fradrag */}
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fradrag</p>
          <div className="text-xs text-muted-foreground space-y-1 bg-muted/20 rounded-md px-3 py-2">
            <div className="flex justify-between">
              <span>Minstefradrag lønn (auto)</span>
              <span className="font-mono">{fmtNOK(result.minstefradragLonn)}</span>
            </div>
            {input.pensjonsinntekt > 0 && (
              <div className="flex justify-between">
                <span>Minstefradrag pensjon (auto)</span>
                <span className="font-mono">{fmtNOK(result.minstefradragPensjon)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Personfradrag (auto)</span>
              <span className="font-mono">{fmtNOK(CURRENT_RATES.personfradrag)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Andre fradrag</Label>
            <NumberInput value={input.andreFradrag} onChange={(v) => set('andreFradrag', v)} suffix="kr" step={1000} min={0} />
            <p className="text-xs text-muted-foreground">Rentefradrag, pendlerfradrag, gaver til frivillighet m.m.</p>
          </div>
        </div>

        {/* Formue (kollapsbar) */}
        <div className="border-t border-border pt-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowFormue((v) => !v)}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Formue {hasFormue && <span className="normal-case text-primary ml-1">({fmtNOK(result.nettoFormue)})</span>}
            </p>
            {showFormue ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {showFormue && (
            <div className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Primærbolig (markedsverdi)</Label>
                <NumberInput value={input.primaerboligVerdi} onChange={(v) => set('primaerboligVerdi', v)} suffix="kr" step={100000} min={0} />
                <p className="text-xs text-muted-foreground">Skattemessig verdi = 25% av markedsverdi</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sekundærbolig / næringseiendom</Label>
                <NumberInput value={input.sekundaerboligVerdi} onChange={(v) => set('sekundaerboligVerdi', v)} suffix="kr" step={100000} min={0} />
                <p className="text-xs text-muted-foreground">Skattemessig verdi = 100%</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bankinnskudd</Label>
                <NumberInput value={input.bankinnskudd} onChange={(v) => set('bankinnskudd', v)} suffix="kr" step={10000} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aksjer / fond (markedsverdi)</Label>
                <NumberInput value={input.aksjerFondVerdi} onChange={(v) => set('aksjerFondVerdi', v)} suffix="kr" step={10000} min={0} />
                <p className="text-xs text-muted-foreground">Skattemessig verdi = 80%</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Annen formue</Label>
                <NumberInput value={input.annenFormue} onChange={(v) => set('annenFormue', v)} suffix="kr" step={10000} min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gjeld</Label>
                <NumberInput value={input.gjeld} onChange={(v) => set('gjeld', v)} suffix="kr" step={10000} min={0} />
              </div>
            </div>
          )}
        </div>

        {/* Send til prognose */}
        {profile && result.totalInntekt > 0 && (
          <Button size="sm" className="w-full gap-2" onClick={sendToSkattPrognose}>
            Bruk i skatteprognose
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* ── Høyre: resultater ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Toppsummering */}
        <div className="grid grid-cols-3 gap-3">
          <Card className={cn(result.totalSkatt > 0 ? 'border-red-500/30' : '')}>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Total skatt</p>
              <p className="font-mono font-bold text-lg text-red-400">{fmtNOK(result.totalSkatt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Effektiv sats</p>
              <p className="font-mono font-bold text-lg">{fmtPct(result.effektivSats)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Marginal sats (lønn)</p>
              <p className="font-mono font-bold text-lg">{fmtPct(result.marginalSats)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Månedlig */}
        {result.totalSkatt > 0 && (
          <div className="rounded-md bg-muted/30 border border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimert månedlig trekk (10,5 mnd)</span>
            <span className="font-mono font-semibold text-sm">{fmtNOK(result.estimertMånedligTrekk)}/mnd</span>
          </div>
        )}

        {/* Grunnlagsberegning */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grunnlag</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border/40">
                <TaxRow label="Lønnsinntekt" value={input.lonnsInntekt} />
                {input.pensjonsinntekt > 0 && <TaxRow label="Pensjonsinntekt" value={input.pensjonsinntekt} />}
                {input.næringsInntekt > 0  && <TaxRow label="Næringsinntekt" value={input.næringsInntekt} />}
                {input.kapitalInntekt !== 0 && <TaxRow label="Kapitalinntekt (netto)" value={input.kapitalInntekt} />}
                <TaxRow label="− Minstefradrag lønn" value={-result.minstefradragLonn} indent />
                {result.minstefradragPensjon > 0 && (
                  <TaxRow label="− Minstefradrag pensjon" value={-result.minstefradragPensjon} indent />
                )}
                {input.andreFradrag > 0 && <TaxRow label="− Andre fradrag" value={-input.andreFradrag} indent />}
                <TaxRow label="− Personfradrag" value={-CURRENT_RATES.personfradrag} indent />
                <TaxRow label="= Alminnelig inntekt" value={result.alminneligInntekt} bold />
                <TaxRow label="Personinntekt (lønn + næring)" value={result.personinntekt} />
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Skatteberegning */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Skatteberegning</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border/40">
                <TaxRow
                  label={`Skatt alminnelig inntekt (${(CURRENT_RATES.skattAlminneligSats * 100).toFixed(0)}%)`}
                  value={result.skattAlminneligInntekt}
                />

                {/* Trinnskatt med breakdown */}
                <TaxRow label="Trinnskatt" value={result.trinnskatt} />
                {result.trinnskattLinjer.map((linje) => (
                  <TaxRow
                    key={linje.trinn}
                    label={`  Trinn ${linje.trinn} (${(linje.sats * 100).toFixed(1)}% over ${linje.grenseFra.toLocaleString('no-NO')} kr)`}
                    value={linje.beløp}
                    indent
                    muted
                  />
                ))}

                {/* Trygdeavgift */}
                {result.trygdeavgiftLonn > 0 && (
                  <TaxRow
                    label={`Trygdeavgift lønn (${(CURRENT_RATES.trygdeavgiftLonn * 100).toFixed(1)}%)`}
                    value={result.trygdeavgiftLonn}
                  />
                )}
                {result.trygdeavgiftPensjon > 0 && (
                  <TaxRow
                    label={`Trygdeavgift pensjon (${(CURRENT_RATES.trygdeavgiftPensjon * 100).toFixed(1)}%)`}
                    value={result.trygdeavgiftPensjon}
                  />
                )}
                {result.trygdeavgiftNæring > 0 && (
                  <TaxRow
                    label={`Trygdeavgift næring (${(CURRENT_RATES.trygdeavgiftNæring * 100).toFixed(0)}%)`}
                    value={result.trygdeavgiftNæring}
                  />
                )}

                {/* Formueskatt */}
                {(result.formueskattKommunal > 0 || result.formueskattStatlig > 0) && (
                  <>
                    {result.formueskattKommunal > 0 && (
                      <TaxRow
                        label={`Formueskatt kommunal (${(CURRENT_RATES.formueskattKommunal * 100).toFixed(2)}% over ${CURRENT_RATES.formueskattGrense.toLocaleString('no-NO')} kr)`}
                        value={result.formueskattKommunal}
                      />
                    )}
                    {result.formueskattStatlig > 0 && (
                      <TaxRow
                        label={`Formueskatt statlig (${(CURRENT_RATES.formueskattStatlig1 * 100).toFixed(2)}%/${(CURRENT_RATES.formueskattStatlig2 * 100).toFixed(2)}%)`}
                        value={result.formueskattStatlig}
                      />
                    )}
                  </>
                )}

                <tr className="border-t-2 border-border">
                  <td className="py-2 font-semibold">Total skatt</td>
                  <td className="py-2 text-right font-mono font-semibold text-red-400">{fmtNOK(result.totalSkatt)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Formue (hvis satt) */}
        {(result.skattemessigFormue > 0 || input.gjeld > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Formue</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/40">
                  {input.primaerboligVerdi > 0 && (
                    <TaxRow label={`Primærbolig (25% av ${fmtNOK(input.primaerboligVerdi)})`} value={Math.round(input.primaerboligVerdi * 0.25)} />
                  )}
                  {input.sekundaerboligVerdi > 0 && <TaxRow label="Sekundærbolig" value={input.sekundaerboligVerdi} />}
                  {input.bankinnskudd > 0 && <TaxRow label="Bankinnskudd" value={input.bankinnskudd} />}
                  {input.aksjerFondVerdi > 0 && (
                    <TaxRow label={`Aksjer/fond (80% av ${fmtNOK(input.aksjerFondVerdi)})`} value={Math.round(input.aksjerFondVerdi * 0.80)} />
                  )}
                  {input.annenFormue > 0 && <TaxRow label="Annen formue" value={input.annenFormue} />}
                  <TaxRow label="Skattemessig bruttoformue" value={result.skattemessigFormue} bold />
                  {input.gjeld > 0 && <TaxRow label="− Gjeld" value={-input.gjeld} indent />}
                  <TaxRow label="Netto formue" value={result.nettoFormue} bold />
                  <TaxRow label={`Bunnfradrag (${CURRENT_RATES.formueskattGrense.toLocaleString('no-NO')} kr)`} value={-Math.min(result.nettoFormue, CURRENT_RATES.formueskattGrense)} indent />
                  <TaxRow label="Skattepliktig formue" value={result.skattepliktigFormue} bold />
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground pb-4">
          Kalkulatoren gir et estimat basert på {CURRENT_RATES.year}-satser. Den tar ikke hensyn til skatt betalt i utlandet, særregler eller skattefradrag utover minstefradrag og personfradrag. Sjekk skattemeldingen for nøyaktige tall.
        </p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Helper-komponent
// ------------------------------------------------------------

function TaxRow({
  label, value, bold, indent, muted,
}: {
  label: string
  value: number
  bold?: boolean
  indent?: boolean
  muted?: boolean
}) {
  const isNeg = value < 0
  return (
    <tr>
      <td className={cn('py-1.5', indent && 'pl-4', bold && 'font-semibold', muted && 'text-muted-foreground')}>
        {label}
      </td>
      <td className={cn(
        'py-1.5 text-right font-mono tabular-nums',
        bold && 'font-semibold',
        muted && 'text-muted-foreground',
        !muted && (isNeg ? 'text-red-400' : value > 0 ? 'text-foreground' : 'text-muted-foreground'),
      )}>
        {value !== 0 ? fmtNOK(value) : '—'}
      </td>
    </tr>
  )
}
