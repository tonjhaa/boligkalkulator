import { useState, useEffect } from 'react'
import { AlertTriangle, FileText, ExternalLink, Table2, Plus, Trash2, TrendingUp, Pencil, Check, X, RefreshCw } from 'lucide-react'
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

import { PayslipImporter } from '@/features/payslip/PayslipImporter'
import type { EmploymentProfile, MonthRecord, TaxSettlementRecord, TemporaryPayEntry, LonnsoppgjorRecord } from '@/types/economy'

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
            <InfoRow label="Grunnlag (lønn + tillegg)" value={fmtNOK(grunnlag)} />
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
    temporaryPayEntries,
    addTemporaryPay,
    removeTemporaryPay,
    lonnsoppgjor,
    addLonnsoppgjor,
    updateLonnsoppgjor,
    removeLonnsoppgjor,
    deriveLonnsoppgjorFromSlips,
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
              <InfoRow label="Grunnlønn/mnd" value={`${fmtNOK(profile.baseMonthly)} (${fmtNOK(profile.baseMonthly * 12)}/år)`} />
              {profile.fixedAdditions.filter((a) => a.amount > 0).map((a) => (
                <InfoRow
                  key={a.kode}
                  label={`${a.label} (${a.kode})`}
                  value={`${fmtNOK(a.amount)}/mnd (${fmtNOK(a.amount * 12)}/år)`}
                />
              ))}
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
          grunnlag={profile.baseMonthly + profile.fixedAdditions.reduce((s, a) => s + Math.max(0, a.amount), 0)}
          faktiskTrekk={profile.lastKnownTaxWithholding}
        />
      )}

      {/* Fungering */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Midlertidig lønn (fungering)</CardTitle>
        </CardHeader>
        <CardContent>
          <FungeringPanel
            entries={temporaryPayEntries}
            baseMonthly={profile?.baseMonthly ?? 0}
            onAdd={addTemporaryPay}
            onRemove={removeTemporaryPay}
          />
        </CardContent>
      </Card>

      {/* Lønnsoppgjør & lønnsvekst */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Lønnsoppgjør & lønnsvekst</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LonnsoppgjorSection
            records={lonnsoppgjor}
            hasSlips={monthHistory.some((m) => m.source === 'imported_slip')}
            onAdd={addLonnsoppgjor}
            onUpdate={updateLonnsoppgjor}
            onRemove={removeLonnsoppgjor}
            onDerive={deriveLonnsoppgjorFromSlips}
          />
        </CardContent>
      </Card>

      {/* Last opp slipp */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Importer lønnsslipp</CardTitle>
        </CardHeader>
        <CardContent>
          <PayslipImporter />
        </CardContent>
      </Card>

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
                      beløp: r.skattTilGodeEllerRest,
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
                        const tilgode = r.skattTilGodeEllerRest
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
                  {importedSlips.map((m) => {
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

// ----------------------------------------------------------------
// FungeringPanel
// ------------------------------------------------------------
// LØNNSOPPGJØR-SEKSJON
// ------------------------------------------------------------

function LonnsoppgjorSection({
  records,
  hasSlips,
  onAdd,
  onUpdate,
  onRemove,
  onDerive,
}: {
  records: LonnsoppgjorRecord[]
  hasSlips: boolean
  onAdd: (r: LonnsoppgjorRecord) => void
  onUpdate: (id: string, updates: Partial<LonnsoppgjorRecord>) => void
  onRemove: (id: string) => void
  onDerive: () => void
}) {
  const currentYear = new Date().getFullYear()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    year: currentYear,
    effectiveDate: `${currentYear}-05-01`,
    maanedslonn: 0,
    htaTillegg: 0,
    notes: '',
    source: 'forventet' as LonnsoppgjorRecord['source'],
  })
  const [editForm, setEditForm] = useState<Partial<LonnsoppgjorRecord>>({})

  const sorted = [...records].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))

  function handleAdd() {
    if (form.maanedslonn <= 0) return
    const prev = sorted.filter((r) => r.effectiveDate < `${form.year}-${String(new Date(form.effectiveDate).getMonth() + 1).padStart(2,'0')}-01`).at(-1)
    onAdd({
      id: crypto.randomUUID(),
      year: form.year,
      effectiveDate: form.effectiveDate,
      maanedslonn: form.maanedslonn,
      forrigeMaanedslonn: prev?.maanedslonn ?? 0,
      htaTillegg: form.htaTillegg,
      notes: form.notes,
      source: form.source,
    })
    setAdding(false)
    setForm({ year: currentYear, effectiveDate: `${currentYear}-05-01`, maanedslonn: 0, htaTillegg: 0, notes: '', source: 'forventet' })
  }

  function startEdit(r: LonnsoppgjorRecord) {
    setEditingId(r.id)
    setEditForm({ maanedslonn: r.maanedslonn, htaTillegg: r.htaTillegg, notes: r.notes, effectiveDate: r.effectiveDate, source: r.source })
  }

  function saveEdit(id: string) {
    onUpdate(id, editForm)
    setEditingId(null)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex gap-2">
          {hasSlips && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={onDerive}
            >
              <RefreshCw className="h-3 w-3" /> Avled fra slipper
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1"
            onClick={() => { setAdding((v) => !v); setEditingId(null) }}
          >
            <Plus className="h-3 w-3" /> Legg til
          </Button>
        </div>
        {sorted.length >= 2 && (() => {
          const first = sorted[0]
          const last = sorted[sorted.length - 1]
          const yearDiff = last.year - first.year
          if (yearDiff > 0 && first.maanedslonn > 0 && last.maanedslonn > 0) {
            const cagr = (Math.pow(last.maanedslonn / first.maanedslonn, 1 / yearDiff) - 1) * 100
            return (
              <span className="text-xs text-muted-foreground">
                Snitt: <span className="text-green-500 font-medium">+{cagr.toFixed(1)} %/år</span>
              </span>
            )
          }
          return null
        })()}
      </div>

      {/* Legg til-skjema */}
      {adding && (
        <div className="border border-border rounded-md p-3 space-y-3 text-xs">
          <p className="font-medium">Nytt lønnsoppgjør</p>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-0.5">
              <Label className="text-xs">Type</Label>
              <select
                className="h-7 text-xs border border-border rounded px-1.5 bg-background"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as LonnsoppgjorRecord['source'] }))}
              >
                <option value="forventet">Forventet</option>
                <option value="manual">Manuelt (historisk)</option>
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Ikrafttreden</Label>
              <Input
                type="date"
                className="h-7 text-xs w-36"
                value={form.effectiveDate}
                onChange={(e) => {
                  const d = new Date(e.target.value)
                  setForm((f) => ({ ...f, effectiveDate: e.target.value, year: d.getFullYear() }))
                }}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Ny grunnlønn/mnd (kr)</Label>
              <Input
                type="number"
                className="h-7 text-xs w-36"
                placeholder="f.eks. 62000"
                value={form.maanedslonn || ''}
                onChange={(e) => setForm((f) => ({ ...f, maanedslonn: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">HTA-tillegg inkl. (kr/mnd)</Label>
              <Input
                type="number"
                className="h-7 text-xs w-36"
                placeholder="f.eks. 1200"
                value={form.htaTillegg || ''}
                onChange={(e) => setForm((f) => ({ ...f, htaTillegg: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Notat</Label>
              <Input
                className="h-7 text-xs w-48"
                placeholder="f.eks. Sentralt oppgjør 2025"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          {form.maanedslonn > 0 && (
            <p className="text-muted-foreground">
              = <span className="text-foreground font-mono">{(form.maanedslonn * 12).toLocaleString('no-NO')} kr/år</span>
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={form.maanedslonn <= 0}>Lagre</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Avbryt</Button>
          </div>
        </div>
      )}

      {/* Tabell */}
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {hasSlips
            ? 'Trykk "Avled fra slipper" for å hente lønnshistorikk automatisk, eller legg til manuelt.'
            : 'Importer slipper eller legg til oppgjør manuelt.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-1 pr-3 font-normal">År</th>
                <th className="text-left py-1 pr-3 font-normal">Dato</th>
                <th className="text-right py-1 pr-3 font-normal">Grunnlønn/mnd</th>
                <th className="text-right py-1 pr-3 font-normal">Økning kr</th>
                <th className="text-right py-1 pr-3 font-normal">Økning %</th>
                <th className="text-right py-1 pr-3 font-normal">HTA-tillegg</th>
                <th className="text-left py-1 pr-3 font-normal">Notat</th>
                <th className="text-left py-1 font-normal">Kilde</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const oekningKr = r.forrigeMaanedslonn > 0 ? r.maanedslonn - r.forrigeMaanedslonn : null
                const oekningPst = r.forrigeMaanedslonn > 0 ? ((r.maanedslonn / r.forrigeMaanedslonn - 1) * 100) : null
                const isEditing = editingId === r.id
                const isForventet = r.source === 'forventet'

                return (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 ${isForventet ? 'opacity-70' : ''}`}
                  >
                    <td className="py-1.5 pr-3 font-medium">{r.year}{isForventet && ' *'}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {isEditing ? (
                        <Input
                          type="date"
                          className="h-6 text-xs w-32"
                          value={editForm.effectiveDate ?? r.effectiveDate}
                          onChange={(e) => setEditForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                        />
                      ) : r.effectiveDate}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {isEditing ? (
                        <Input
                          type="number"
                          className="h-6 text-xs w-28 text-right"
                          value={editForm.maanedslonn ?? r.maanedslonn}
                          onChange={(e) => setEditForm((f) => ({ ...f, maanedslonn: parseInt(e.target.value) || 0 }))}
                        />
                      ) : (
                        <>{r.maanedslonn.toLocaleString('no-NO')} kr</>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {oekningKr !== null ? (
                        <span className={oekningKr >= 0 ? 'text-green-500' : 'text-red-400'}>
                          {oekningKr >= 0 ? '+' : ''}{oekningKr.toLocaleString('no-NO')} kr
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {oekningPst !== null ? (
                        <span className={oekningPst >= 0 ? 'text-green-500' : 'text-red-400'}>
                          {oekningPst >= 0 ? '+' : ''}{oekningPst.toFixed(2)} %
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          className="h-6 text-xs w-24 text-right"
                          value={editForm.htaTillegg ?? r.htaTillegg}
                          onChange={(e) => setEditForm((f) => ({ ...f, htaTillegg: parseInt(e.target.value) || 0 }))}
                        />
                      ) : r.htaTillegg > 0 ? (
                        <span className="text-blue-400">{r.htaTillegg.toLocaleString('no-NO')} kr</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground max-w-[160px] truncate">
                      {isEditing ? (
                        <Input
                          className="h-6 text-xs w-40"
                          value={editForm.notes ?? r.notes}
                          onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                      ) : r.notes || '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        r.source === 'slip' ? 'bg-green-900/30 text-green-400' :
                        r.source === 'forventet' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {r.source === 'slip' ? 'slipp' : r.source === 'forventet' ? 'forventet' : 'manuelt'}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button className="text-green-500 hover:text-green-400" onClick={() => saveEdit(r.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="text-muted-foreground hover:text-foreground" onClick={() => startEdit(r)}>
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button className="text-muted-foreground hover:text-red-400" onClick={() => onRemove(r.id)}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sorted.some((r) => r.source === 'forventet') && (
            <p className="text-xs text-muted-foreground mt-1">* Forventet oppgjør</p>
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------

function FungeringPanel({
  entries,
  baseMonthly,
  onAdd,
  onRemove,
}: {
  entries: TemporaryPayEntry[]
  baseMonthly: number
  onAdd: (e: TemporaryPayEntry) => void
  onRemove: (id: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ label: '', fromDate: today, toDate: today, aarslonn: 0 })
  const [adding, setAdding] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleSave() {
    if (!form.label.trim()) { setSaveError('Beskrivelse mangler'); return }
    if (!form.fromDate || !form.toDate) { setSaveError('Datoer mangler'); return }
    if (form.toDate < form.fromDate) { setSaveError('Til-dato må være etter fra-dato'); return }
    if (form.aarslonn <= 0) { setSaveError('Årslønn må være større enn 0'); return }
    setSaveError(null)
    onAdd({ id: crypto.randomUUID(), label: form.label.trim(), fromDate: form.fromDate, toDate: form.toDate, maanedslonn: Math.round(form.aarslonn / 12) })
    setForm({ label: '', fromDate: today, toDate: today, aarslonn: 0 })
    setAdding(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3 w-3" /> Legg til
        </Button>
      </div>

      {adding && (
        <>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <div className="space-y-0.5">
              <Label className="text-xs">Beskrivelse</Label>
              <Input
                className="h-7 text-xs w-48"
                placeholder="f.eks. Fungering som major"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Fra dato</Label>
              <Input type="date" className="h-7 text-xs w-36" value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Til dato</Label>
              <Input type="date" className="h-7 text-xs w-36" value={form.toDate} onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Årslønn (kr)</Label>
              <Input
                type="number"
                className="h-7 text-xs w-36"
                placeholder="f.eks. 700000"
                value={form.aarslonn || ''}
                onChange={(e) => setForm((f) => ({ ...f, aarslonn: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            {form.aarslonn > 0 && (
              <div className="space-y-0.5 self-end pb-1.5">
                <p className="text-muted-foreground text-xs">
                  = {Math.round(form.aarslonn / 12).toLocaleString('no-NO')} kr/mnd
                  {baseMonthly > 0 && (
                    <span className="text-green-500 ml-1">
                      (+{Math.max(0, Math.round(form.aarslonn / 12 - baseMonthly)).toLocaleString('no-NO')} tillegg)
                    </span>
                  )}
                </p>
              </div>
            )}
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Lagre</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setSaveError(null) }}>Avbryt</Button>
          </div>
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        </>
      )}

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 text-xs rounded border border-border/50 px-2 py-1.5">
              <span className="font-medium">{e.label}</span>
              <span className="text-muted-foreground">{e.fromDate} → {e.toDate}</span>
              <span className="font-mono text-green-500">
                {Math.round(e.maanedslonn * 12).toLocaleString('no-NO')} kr/år
                <span className="text-muted-foreground font-normal"> ({Math.round(e.maanedslonn).toLocaleString('no-NO')} kr/mnd</span>
                {baseMonthly > 0 && (
                  <span className="text-green-400 font-normal">
                    , +{Math.max(0, Math.round(e.maanedslonn - baseMonthly)).toLocaleString('no-NO')} tillegg
                  </span>
                )}
                <span className="text-muted-foreground font-normal">)</span>
              </span>
              <button
                className="text-muted-foreground hover:text-red-400 transition-colors ml-2"
                onClick={() => onRemove(e.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Ingen fungeringsperioder registrert.</p>
      )}
    </div>
  )
}
