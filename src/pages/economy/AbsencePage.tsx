import { useRef, useState } from 'react'
import { Info, Plus, Trash2, Upload } from 'lucide-react'
import { parseAbsenceExcel } from '@/features/absence/absenceImporter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEconomyStore } from '@/application/useEconomyStore'
import {
  getDaysUsedLast12Months,
  getAbsenceStatus,
  getStatusColor,
  getStatusLabel,
  getRemainingQuota,
} from '@/domain/economy/absenceCalculator'
import { EGENMELDING_KVOTE } from '@/config/economy.config'
import type { AbsenceRecord } from '@/types/economy'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

export function AbsencePage() {
  const { absenceRecords, addAbsenceRecord, removeAbsenceRecord } = useEconomyStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const { records, antallRader, ukjenteTyper } = await parseAbsenceExcel(file)
      records.forEach((r) => addAbsenceRecord(r))
      const ukjentTekst = ukjenteTyper.length > 0 ? ` (ukjente typer ignorert: ${ukjenteTyper.join(', ')})` : ''
      setImportMsg({ type: 'ok', text: `Importerte ${records.length} måneder fra ${antallRader} rader.${ukjentTekst}` })
    } catch (err) {
      setImportMsg({ type: 'error', text: err instanceof Error ? err.message : 'Ukjent feil' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const now = new Date()
  const daysUsed = getDaysUsedLast12Months(absenceRecords, now)
  const status = getAbsenceStatus(absenceRecords, now)
  const remaining = getRemainingQuota(absenceRecords, now)

  const sorted = [...absenceRecords].sort((a, b) => b.period.localeCompare(a.period))

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Egenmelding og fravær</h2>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImport}
          />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-1" />
            {importing ? 'Importerer…' : 'Importer SAP'}
          </Button>
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

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                status === 'ok' ? 'bg-green-500' :
                status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(100, (daysUsed / EGENMELDING_KVOTE) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={getStatusColor(status)}>{getStatusLabel(status)}</span>
            <span>{remaining} dager igjen</span>
          </div>

          {/* Forklaring */}
          <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground/80 mb-0.5">Forsvarets særavtale</p>
              <p>24 egenmeldingsdager per 12 måneder (ikke 12 som AML).</p>
              <p className="mt-0.5">Sykemelding teller IKKE mot egenmeldingskvoten.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legg til skjema */}
      {showAddForm && (
        <AddAbsenceForm
          onSave={(r) => { addAbsenceRecord(r); setShowAddForm(false) }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Logg */}
      {sorted.length === 0 && !showAddForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Ingen fravær registrert.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fraværslogg</CardTitle>
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
                  {sorted.map((r) => {
                    const d = new Date(r.period)
                    const monthLabel = `${MONTH_NAMES[d.getMonth() + 1]} ${d.getFullYear()}`
                    return (
                      <tr key={r.period} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-xs">{monthLabel}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {r.selfCertDays > 0 ? (
                            <span className="text-yellow-400">{r.selfCertDays} dager</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {r.sickLeaveDays > 0 ? (
                            <span className="text-muted-foreground">{r.sickLeaveDays} dager</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                            onClick={() => removeAbsenceRecord(r.period)}
                          >
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
      )}
    </div>
  )
}

// ------------------------------------------------------------
// SKJEMA
// ------------------------------------------------------------

function AddAbsenceForm({
  onSave,
  onCancel,
}: {
  onSave: (r: AbsenceRecord) => void
  onCancel: () => void
}) {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  )
  const [selfCertDays, setSelfCertDays] = useState(0)
  const [sickLeaveDays, setSickLeaveDays] = useState(0)
  const [notat, setNotat] = useState('')

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Registrer fravær</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Måned (velg første dag)</Label>
            <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Egenmeldingsdager</Label>
            <Input
              type="number"
              min={0}
              max={24}
              value={selfCertDays}
              onChange={(e) => setSelfCertDays(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sykemeldingsdager</Label>
            <Input
              type="number"
              min={0}
              value={sickLeaveDays}
              onChange={(e) => setSickLeaveDays(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notat (valgfritt)</Label>
            <Input value={notat} onChange={(e) => setNotat(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button
            size="sm"
            onClick={() =>
              onSave({
                period,
                selfCertDays,
                sickLeaveDays,
                notat: notat.trim() || undefined,
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
