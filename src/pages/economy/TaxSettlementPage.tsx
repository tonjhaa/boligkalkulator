import { useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { useEconomyStore } from '@/application/useEconomyStore'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
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

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Skatteoppgjør</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          + Legg til
        </Button>
      </div>

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
