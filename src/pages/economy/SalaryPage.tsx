import { useState, useEffect } from 'react'
import { AlertTriangle, FileText, ExternalLink, Table2 } from 'lucide-react'
import { slaaOppTrekk } from '@/utils/trekktabellLookup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useEconomyStore } from '@/application/useEconomyStore'
import { analyzeTaxSettlements } from '@/domain/economy/taxSettlementCalc'
import { calculateHolidayPay } from '@/domain/economy/salaryCalculator'
import { PayslipImporter } from '@/features/payslip/PayslipImporter'
import type { EmploymentProfile, MonthRecord, TaxSettlementRecord } from '@/types/economy'

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mars', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

function getLocalStorageKB(): number {
  try {
    let total = 0
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        total += (localStorage.getItem(key) ?? '').length
      }
    }
    return Math.round(total / 1024)
  } catch {
    return 0
  }
}

function TrekktabellKort({
  tabellnummer,
  grunnlag,
  faktiskTrekk,
}: {
  tabellnummer: number
  grunnlag: number
  faktiskTrekk: number
}) {
  const [estimert, setEstimert] = useState<number | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)

  useEffect(() => {
    setLaster(true)
    setFeil(null)
    slaaOppTrekk(tabellnummer, grunnlag, 1)
      .then((trekk) => {
        setEstimert(trekk)
        setLaster(false)
      })
      .catch(() => {
        setFeil('Kunne ikke hente trekktabell')
        setLaster(false)
      })
  }, [tabellnummer, grunnlag])

  const differanse = estimert !== null ? faktiskTrekk - estimert : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Trekktabell {tabellnummer}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {laster ? (
          <p className="text-sm text-muted-foreground">Henter trekktabell…</p>
        ) : feil ? (
          <p className="text-sm text-destructive">{feil}</p>
        ) : (
          <div className="space-y-2 text-sm">
            <InfoRow label="Grunnlag (grunnlønn)" value={fmtNOK(grunnlag)} />
            <InfoRow label="Estimert trekk (tabell)" value={estimert !== null ? fmtNOK(estimert) : '—'} />
            <InfoRow label="Faktisk trekk (siste slipp)" value={fmtNOK(faktiskTrekk)} />
            {differanse !== null && Math.abs(differanse) > 10 && (
              <div className={`text-xs mt-1 ${differanse > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {differanse > 0
                  ? `Trekkes ${fmtNOK(differanse)} mer enn tabellen tilsier`
                  : `Trekkes ${fmtNOK(Math.abs(differanse))} mindre enn tabellen tilsier`}
              </div>
            )}
            {differanse !== null && Math.abs(differanse) <= 10 && (
              <div className="text-xs text-green-600">Stemmer med trekktabellen</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SalaryPage() {
  const {
    profile,
    setProfile,
    monthHistory,
    taxSettlements,
    addTaxSettlement,
    removeTaxSettlement,
  } = useEconomyStore()

  const [editingProfile, setEditingProfile] = useState(false)
  const [addingSettlement, setAddingSettlement] = useState(false)
  const [viewingSlip, setViewingSlip] = useState<MonthRecord | null>(null)
  const [storageKB, setStorageKB] = useState(0)

  useEffect(() => {
    setStorageKB(getLocalStorageKB())
  }, [monthHistory])

  const analysis = analyzeTaxSettlements(
    taxSettlements,
    profile?.extraTaxWithholding ?? 0
  )

  const importedSlips = monthHistory
    .filter((m) => m.source === 'imported_slip')
    .sort((a, b) => b.year - a.year || b.month - a.month)

  const holidayPay = profile
    ? calculateHolidayPay(profile.baseMonthly * 12, profile.baseMonthly * 12)
    : null

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h2 className="font-semibold">Lønn og skatt</h2>

      {/* Lønnsprofil */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Lønnsprofil</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingProfile(!editingProfile)}
            >
              {editingProfile ? 'Avbryt' : 'Rediger'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!profile && !editingProfile ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Ingen lønnsprofil. Sett opp profilen din eller importer en lønnsslipp.
              </p>
              <Button size="sm" onClick={() => setEditingProfile(true)}>
                Sett opp profil
              </Button>
            </div>
          ) : editingProfile ? (
            <ProfileForm
              initial={profile}
              onSave={(p) => { setProfile(p); setEditingProfile(false) }}
              onCancel={() => setEditingProfile(false)}
            />
          ) : profile ? (
            <div className="space-y-2 text-sm">
              <InfoRow label="Arbeidsgiver" value={profile.employer === 'forsvaret' ? 'Forsvaret' : 'Annen'} />
              <InfoRow label="Lønnstrinn" value={String(profile.salaryGrade)} />
              <InfoRow label="Grunnlønn/mnd" value={fmtNOK(profile.baseMonthly)} />
              <InfoRow label="Skattetrekk/mnd" value={fmtNOK(profile.lastKnownTaxWithholding)} />
              {profile.tabellnummer && (
                <InfoRow label="Trekktabell" value={String(profile.tabellnummer)} />
              )}
              {profile.extraTaxWithholding > 0 && (
                <InfoRow label="Ekstra trekk/mnd" value={fmtNOK(profile.extraTaxWithholding)} />
              )}
              {profile.housingDeduction > 0 && (
                <InfoRow label="Husleietrekk/mnd" value={fmtNOK(profile.housingDeduction)} />
              )}
              <InfoRow label="Pensjonstrekk" value={`${profile.pensionPercent}%`} />
              <InfoRow label="Fagforeningskontingent/mnd" value={fmtNOK(profile.unionFee)} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Trekktabell-estimat */}
      {profile?.tabellnummer && (
        <TrekktabellKort
          tabellnummer={profile.tabellnummer}
          grunnlag={profile.baseMonthly}
          faktiskTrekk={profile.lastKnownTaxWithholding}
        />
      )}

      {/* Last opp slipp */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Importer lønnsslipp</CardTitle>
        </CardHeader>
        <CardContent>
          <PayslipImporter />
        </CardContent>
      </Card>

      {/* Feriepenge-kalkulator */}
      {holidayPay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Feriepenger (juni-estimat)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Feriepenger (12% av årsgrunnlag)" value={fmtNOK(holidayPay.holidayPay)} />
            <InfoRow label="Ferietrekk (25 virkedager)" value={`-${fmtNOK(holidayPay.holidayLeaveDeduction)}`} />
            <div className="flex justify-between font-medium border-t border-border pt-2">
              <span>Estimert netto juni</span>
              <span className="font-mono text-green-500">{fmtNOK(holidayPay.netJune)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skatteoppgjør-historikk */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Skatteoppgjør-historikk</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddingSettlement(true)}>
              + Legg til
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {addingSettlement && (
            <AddSettlementForm
              onSave={(r) => { addTaxSettlement(r); setAddingSettlement(false) }}
              onCancel={() => setAddingSettlement(false)}
            />
          )}

          {taxSettlements.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[...taxSettlements]
                    .sort((a, b) => a.year - b.year)
                    .map((r) => ({
                      year: r.year,
                      beløp: -r.skattTilGodeEllerRest,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    formatter={(v) => [fmtNOK(Number(v)), Number(v) >= 0 ? 'Til gode' : 'Restskatt']}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Bar
                    dataKey="beløp"
                    fill="#22C55E"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>

              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium">År</th>
                      <th className="text-right px-3 py-2 font-medium">Til gode / Restskatt</th>
                      <th className="text-right px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...taxSettlements]
                      .sort((a, b) => b.year - a.year)
                      .map((r) => {
                        const tilgode = -r.skattTilGodeEllerRest
                        return (
                          <tr key={r.year} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">{r.year}</td>
                            <td className={`px-3 py-2 text-right font-mono ${tilgode >= 0 ? 'text-green-500' : 'text-red-400'}`}>
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
            </>
          )}

          {taxSettlements.length === 0 && !addingSettlement && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ingen skatteoppgjør registrert.
            </p>
          )}

          {/* Anbefaling */}
          {analysis.recommendation !== 'keep' && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm text-yellow-400">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-medium">Anbefaling</span>
              </div>
              <p className="text-xs">{analysis.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slipp-historikk */}
      {importedSlips.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Importerte slipper</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {storageKB > 4500 && (
              <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-2 text-xs text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Lagringsplass nærmer seg grensen ({storageKB} KB / ~5 120 KB). PDF-er for eldre slipper er automatisk fjernet.
              </div>
            )}
            <div className="space-y-1">
                  {importedSlips.slice(0, 24).map((m) => {
                    // Bruk slipData.nettoUtbetalt som kilde til sannhet (fikser stale records)
                    const netto = m.slipData?.nettoUtbetalt ?? m.nettoUtbetalt
                    const brutto = m.slipData?.bruttoSum ?? 0
                    return (
                      <div key={`${m.year}-${m.month}`} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/10 text-xs">
                        <span className="text-muted-foreground w-20 shrink-0">
                          {MONTH_NAMES[m.month]} {m.year}
                        </span>
                        <span className="font-mono font-medium">
                          Netto: {fmtNOK(netto)}
                        </span>
                        {brutto > 0 && (
                          <span className="font-mono text-muted-foreground">
                            Brutto: {fmtNOK(brutto)}
                          </span>
                        )}
                        <span className="ml-auto">
                          {(m.slipData || m.slipPdfBase64) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs gap-1"
                              onClick={() => setViewingSlip(m)}
                            >
                              <FileText className="h-3 w-3" />
                              Vis
                            </Button>
                          )}
                        </span>
                      </div>
                    )
                  })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slipp-detaljer-modal */}
      {viewingSlip && (
        <SlipDetailModal record={viewingSlip} onClose={() => setViewingSlip(null)} />
      )}
    </div>
  )
}

// ------------------------------------------------------------
// SUB-KOMPONENTER
// ------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}

function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EmploymentProfile | null
  onSave: (p: EmploymentProfile) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<EmploymentProfile>({
    employer: 'forsvaret',
    salaryGrade: 0,
    baseMonthly: 0,
    fixedAdditions: [],
    lastKnownTaxWithholding: 0,
    extraTaxWithholding: 0,
    housingDeduction: 0,
    pensionPercent: 2,
    unionFee: 0,
    atfEnabled: true,
    ...initial,
  })

  function field(k: keyof EmploymentProfile) {
    return {
      value: String(form[k] ?? ''),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: parseFloat(e.target.value) || e.target.value })),
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Lønnstrinn</Label>
          <Input type="number" {...field('salaryGrade')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Grunnlønn/mnd</Label>
          <Input type="number" {...field('baseMonthly')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Skattetrekk/mnd</Label>
          <Input type="number" {...field('lastKnownTaxWithholding')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ekstra trekk/mnd</Label>
          <Input type="number" {...field('extraTaxWithholding')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Husleietrekk/mnd</Label>
          <Input type="number" {...field('housingDeduction')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pensjonstrekk %</Label>
          <Input type="number" {...field('pensionPercent')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fagforeningskontingent/mnd</Label>
          <Input type="number" {...field('unionFee')} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
        <Button size="sm" onClick={() => onSave(form)}>Lagre</Button>
      </div>
    </div>
  )
}

function AddSettlementForm({
  onSave,
  onCancel,
}: {
  onSave: (r: TaxSettlementRecord) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ year: new Date().getFullYear() - 1, skattTilGodeEllerRest: 0 })

  return (
    <div className="border border-border rounded-md p-3 space-y-3">
      <p className="text-xs font-medium">Legg til skatteoppgjør</p>
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
              setForm((f) => ({ ...f, skattTilGodeEllerRest: parseFloat(e.target.value) || 0 }))
            }
            placeholder="-5000 = 5 000 kr tilgode"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
        <Button size="sm" onClick={() => onSave(form as TaxSettlementRecord)}>Lagre</Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// SLIPP-DETALJER MODAL
// ------------------------------------------------------------

function pdfBlobUrl(base64: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

function SlipDetailModal({ record, onClose }: { record: MonthRecord; onClose: () => void }) {
  const slip = record.slipData
  const hasPdf = !!record.slipPdfBase64

  function openPdf() {
    if (!record.slipPdfBase64) return
    const url = pdfBlobUrl(record.slipPdfBase64)
    window.open(url, '_blank')
    // Rydder opp blob-URL etter 60 sekunder
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background rounded-lg border border-border w-full max-w-md space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <p className="font-semibold text-sm">
              {MONTH_NAMES[record.month]} {record.year}
            </p>
            <p className="text-xs text-muted-foreground">Lønnsslipp-detaljer</p>
          </div>
          <div className="flex gap-2">
            {hasPdf && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={openPdf}>
                <ExternalLink className="h-3 w-3" />
                Åpne PDF
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>Lukk</Button>
          </div>
        </div>

        {slip ? (
          <div className="px-5 pb-5 space-y-3">
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: 'Netto utbetalt', value: fmtNOK(slip.nettoUtbetalt), bold: true },
                    { label: 'Bruttosum', value: fmtNOK(slip.bruttoSum) },
                    { label: 'Månedslønn', value: fmtNOK(slip.maanedslonn) },
                    { label: 'Skattetrekk', value: `-${fmtNOK(slip.skattetrekk)}` },
                    slip.pensjonstrekk > 0 && { label: 'Pensjonstrekk SPK', value: `-${fmtNOK(slip.pensjonstrekk)}` },
                    slip.fagforeningskontingent > 0 && { label: 'Fagforening', value: `-${fmtNOK(slip.fagforeningskontingent)}` },
                    slip.husleietrekk > 0 && { label: 'Husleietrekk', value: `-${fmtNOK(slip.husleietrekk)}` },
                    slip.ekstraTrekk > 0 && { label: 'Ekstra trekk', value: `-${fmtNOK(slip.ekstraTrekk)}` },
                    slip.ouFond > 0 && { label: 'OU-fond', value: `-${fmtNOK(slip.ouFond)}` },
                    slip.feriepengegrunnlag > 0 && { label: 'Feriepengegrunnlag (YTD)', value: fmtNOK(slip.feriepengegrunnlag) },
                    slip.hittilBrutto > 0 && { label: 'Hittil brutto (YTD)', value: fmtNOK(slip.hittilBrutto) },
                    slip.avregningsdato && { label: 'Avregningsdato', value: slip.avregningsdato },
                  ].filter(Boolean).map((row) => {
                    if (!row) return null
                    return (
                      <tr key={row.label} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                        <td className={`px-3 py-2 text-right font-mono ${'bold' in row && row.bold ? 'font-semibold text-foreground' : ''}`}>
                          {row.value}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {slip.fasteTillegg.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Faste tillegg</p>
                <div className="space-y-1">
                  {slip.fasteTillegg.map((t) => (
                    <div key={t.artskode} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.artskode} – {t.navn}</span>
                      <span className="font-mono">{fmtNOK(t.belop)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasPdf && (
              <p className="text-xs text-muted-foreground italic">
                PDF ikke lagret for denne slippen. Re-importer for å lagre PDF.
              </p>
            )}
          </div>
        ) : (
          <div className="px-5 pb-5">
            <p className="text-sm text-muted-foreground">Ingen slipp-data tilgjengelig.</p>
          </div>
        )}
      </div>
    </div>
  )
}
