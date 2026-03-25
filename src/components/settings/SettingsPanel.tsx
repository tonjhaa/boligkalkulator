import { useState } from 'react'
import { RotateCcw, Download, Upload, Trash2, Smartphone } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useEconomyStore } from '@/application/useEconomyStore'
import { defaultConfig } from '@/config/default.config'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { AppConfig } from '@/types'

const LAST_EXPORT_KEY = 'min-okonomi-last-export'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ------------------------------------------------------------
// SIKKERHETSKOPI — Google Drive backup
// ------------------------------------------------------------

function BackupReminderBanner({ onExport }: { onExport: () => void }) {
  const raw = localStorage.getItem(LAST_EXPORT_KEY)
  if (!raw) return null
  const lastExport = new Date(raw)
  const daysSince = Math.floor((Date.now() - lastExport.getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince < 7) return null
  if (daysSince < 30) return null

  const formatted = lastExport.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-4">
      <span className="text-xs text-amber-700 dark:text-amber-400">
        💾 Siste sikkerhetskopi: {formatted} ({daysSince} dager siden)
      </span>
      <Button variant="outline" size="sm" onClick={onExport} className="shrink-0 text-xs">
        Last ned nå
      </Button>
    </div>
  )
}

function GoogleDriveBackupSection() {
  const store = useEconomyStore()
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [pendingData, setPendingData] = useState<string | null>(null)
  const [pendingMeta, setPendingMeta] = useState<{ exportedAt: string } | null>(null)

  function handleExport() {
    const state = store
    // Bygg backup-objekt uten slipPdfBase64
    const data = {
      storeVersion: state.storeVersion,
      profile: state.profile,
      budgetTemplate: state.budgetTemplate,
      monthHistory: state.monthHistory.map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { slipPdfBase64: _pdf, ...rest } = m as typeof m & { slipPdfBase64?: unknown }
        return rest
      }),
      atfEntries: state.atfEntries,
      savingsAccounts: state.savingsAccounts,
      savingsGoals: state.savingsGoals,
      debts: state.debts,
      absenceRecords: state.absenceRecords,
      taxSettlements: state.taxSettlements,
      subscriptions: state.subscriptions,
      insurances: state.insurances,
      policyRateHistory: state.policyRateHistory,
    }

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data,
    }

    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `min-okonomi-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') return
      try {
        const parsed = JSON.parse(text)
        if (!parsed.version || !parsed.exportedAt || !parsed.data) {
          setImportError('Ugyldig fil. Dette ser ikke ut som en Min Økonomi-sikkerhetskopi.')
          return
        }
        setPendingData(text)
        setPendingMeta({ exportedAt: parsed.exportedAt })
        setImportError(null)
      } catch {
        setImportError('Kunne ikke lese filen. Kontroller at det er en gyldig JSON-fil.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleConfirmImport() {
    if (!pendingData) return
    try {
      const parsed = JSON.parse(pendingData)
      store.importData(JSON.stringify(parsed.data))
      setImportSuccess(true)
      setPendingData(null)
      setPendingMeta(null)
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setImportError('Import feilet. Filen kan være skadet.')
    }
  }

  const exportDateFormatted = pendingMeta
    ? new Date(pendingMeta.exportedAt).toLocaleDateString('nb-NO', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
        Sikkerhetskopi
      </h3>

      <BackupReminderBanner onExport={handleExport} />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Last ned sikkerhetskopi
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Lagre filen i Google Drive for tilgang fra alle enheter.
          </p>
          <p className="text-xs text-muted-foreground">
            ⚠️ PDF-slipper lagres ikke i sikkerhetskopien og må lastes opp på nytt på ny enhet.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Gjenopprett fra fil
              </span>
            </Button>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </Label>
        </div>
      </div>

      {importError && (
        <p className="text-xs text-red-400">{importError}</p>
      )}

      {importSuccess && (
        <p className="text-xs text-green-500">✅ Data gjenopprettet — laster inn på nytt...</p>
      )}

      {pendingData && pendingMeta && (
        <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3">
          <p className="text-sm font-medium">Gjenopprett sikkerhetskopi?</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Lagret: {exportDateFormatted}</p>
            <p className="text-destructive">Dette overskriver all data.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setPendingData(null); setPendingMeta(null) }}>
              Avbryt
            </Button>
            <Button variant="default" size="sm" onClick={handleConfirmImport}>
              Gjenopprett
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          Bruke appen på en annen enhet?
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Last ned sikkerhetskopi på denne enheten</li>
          <li>Last opp filen til Google Drive</li>
          <li>Åpne appen på ny enhet</li>
          <li>Gå til Innstillinger → Gjenopprett fra fil</li>
          <li>Last ned filen fra Google Drive og velg den</li>
        </ol>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MIN ØKONOMI — Datastyring
// ------------------------------------------------------------

function EconomyDataSection() {
  const { exportData, importData, resetAll, clearAllSlips } = useEconomyStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmClearSlips, setConfirmClearSlips] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const storageKey = 'min-okonomi-v1'
  const storedData = localStorage.getItem(storageKey)
  const storageKB = storedData ? Math.round(storedData.length / 1024 * 10) / 10 : 0

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `min-okonomi-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') return
      try {
        importData(text)
        setImportError(null)
        e.target.value = ''
      } catch {
        setImportError('Ugyldig fil. Sørg for at du laster opp en gyldig Min Økonomi JSON-fil.')
      }
    }
    reader.readAsText(file)
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    resetAll()
    setConfirmReset(false)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
        Min Økonomi — Data
      </h3>

      <div className="text-xs text-muted-foreground">
        Lagret i localStorage: <span className="font-mono">{storageKB} KB</span> under nøkkel{' '}
        <code className="bg-muted px-1 rounded">{storageKey}</code>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Eksporter JSON
        </Button>

        <Label className="cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Importer JSON
            </span>
          </Button>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </Label>

        {confirmClearSlips ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Alle importerte slipper slettes!</span>
            <Button variant="destructive" size="sm" onClick={() => { clearAllSlips(); setConfirmClearSlips(false) }}>
              Bekreft
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmClearSlips(false)}>
              Avbryt
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 hover:text-red-500 hover:border-red-400"
            onClick={() => setConfirmClearSlips(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Slett alle slipper
          </Button>
        )}

        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Er du sikker? Alt slettes!</span>
            <Button variant="destructive" size="sm" onClick={handleReset}>
              Bekreft nullstilling
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Avbryt
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 hover:text-red-500 hover:border-red-400"
            onClick={handleReset}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Nullstill all data
          </Button>
        )}
      </div>

      {importError && (
        <p className="text-xs text-red-400">{importError}</p>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const config = useAppStore((s) => s.config)
  const updateConfig = useAppStore((s) => s.updateConfig)
  const resetConfig = useAppStore((s) => s.resetConfig)

  function setLendingRule(key: keyof AppConfig['lendingRules'], value: number) {
    updateConfig({ lendingRules: { ...config.lendingRules, [key]: value } })
  }

  function setFee(key: keyof AppConfig['fees'], value: number) {
    updateConfig({ fees: { ...config.fees, [key]: value } })
  }

  function setSIFO(key: keyof AppConfig['sifo'], value: number) {
    updateConfig({ sifo: { ...config.sifo, [key]: value } })
  }

  const isModified = JSON.stringify(config) !== JSON.stringify(defaultConfig)

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Innstillinger</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tilpass regler og satser. Alle scenarioer beregnes om automatisk.
          </p>
        </div>
        {isModified && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={resetConfig}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tilbakestill
          </Button>
        )}
      </div>

      <Separator />

      <Section title="Utlånsregler (Boliglånsforskriften 2025)">
        <Field
          label="Minimum egenkapital"
          hint="Standard: 15 %. Noen banker tilbyr 10 % for førstegangskjøpere i Oslo."
        >
          <NumberInput
            value={config.lendingRules.minEquityPercent}
            onChange={(v) => setLendingRule('minEquityPercent', v)}
            suffix="%"
            min={1}
            max={40}
            step={1}
          />
        </Field>

        <Field
          label="Maksimal gjeldsgrad"
          hint="Standard: 5,0×. Bankene kan bruke fleksibilitetskvote for inntil 10 % av innvilgede lån."
        >
          <NumberInput
            value={config.lendingRules.maxDebtRatio}
            onChange={(v) => setLendingRule('maxDebtRatio', v)}
            suffix="× inntekt"
            min={1}
            max={10}
            step={0.1}
          />
        </Field>

        <Field
          label="Stresspåslag"
          hint="Standard: 3,0 pp over avtalerenten."
        >
          <NumberInput
            value={config.lendingRules.stressTestAddition}
            onChange={(v) => setLendingRule('stressTestAddition', v)}
            suffix="pp"
            min={0}
            max={10}
            step={0.5}
          />
        </Field>

        <Field
          label="Minimum stressrente"
          hint="Standard: 7,0 %. Stressrenten settes aldri lavere enn dette."
        >
          <NumberInput
            value={config.lendingRules.minStressTestRate}
            onChange={(v) => setLendingRule('minStressTestRate', v)}
            suffix="%"
            min={1}
            max={20}
            step={0.5}
          />
        </Field>

        <Field
          label="Maksimal belåningsgrad (LTV)"
          hint="Standard: 85 %. Rammelån: 60 %. BSU-garanti kan gi 100 %."
        >
          <NumberInput
            value={config.lendingRules.maxLtvRatio}
            onChange={(v) => setLendingRule('maxLtvRatio', v)}
            suffix="%"
            min={50}
            max={100}
            step={1}
          />
        </Field>
      </Section>

      <Separator />

      <Section title="Gebyrer og avgifter">
        <Field
          label="Dokumentavgift"
          hint="Standard: 2,5 % av kjøpesum. Gjelder selveier. Borettslag/aksjeselskap: 0 %."
        >
          <NumberInput
            value={config.fees.stampDutyPercent}
            onChange={(v) => setFee('stampDutyPercent', v)}
            suffix="%"
            min={0}
            max={10}
            step={0.5}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tinglysing skjøte" hint="Kartverket 2025">
            <NumberInput
              value={config.fees.propertyRegistrationFee}
              onChange={(v) => setFee('propertyRegistrationFee', v)}
              suffix="kr"
              min={0}
              step={50}
            />
          </Field>
          <Field label="Tinglysing pantedokument" hint="Kartverket 2025">
            <NumberInput
              value={config.fees.mortgageRegistrationFee}
              onChange={(v) => setFee('mortgageRegistrationFee', v)}
              suffix="kr"
              min={0}
              step={50}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Etableringsgebyr" hint="Varierer per bank">
            <NumberInput
              value={config.fees.loanEstablishmentFee}
              onChange={(v) => setFee('loanEstablishmentFee', v)}
              suffix="kr"
              min={0}
              step={100}
            />
          </Field>
          <Field label="Termingebyr" hint="Per måned">
            <NumberInput
              value={config.fees.termFee}
              onChange={(v) => setFee('termFee', v)}
              suffix="kr/mnd"
              min={0}
              step={10}
            />
          </Field>
        </div>
      </Section>

      <Separator />

      <Section title="SIFO-referansebudsjettet 2024">
        <p className="text-xs text-muted-foreground -mt-2">
          Dekker mat, klær, hygiene, fritid og kommunikasjon — ikke boutgifter eller transport.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Voksen (18+ år)">
            <NumberInput
              value={config.sifo.adultMonthly}
              onChange={(v) => setSIFO('adultMonthly', v)}
              suffix="kr/mnd"
              min={0}
              step={100}
            />
          </Field>
          <Field label="Spedbarn (0–3 år)">
            <NumberInput
              value={config.sifo.infantMonthly}
              onChange={(v) => setSIFO('infantMonthly', v)}
              suffix="kr/mnd"
              min={0}
              step={100}
            />
          </Field>
          <Field label="Barn 4–6 år">
            <NumberInput
              value={config.sifo.child4to6Monthly}
              onChange={(v) => setSIFO('child4to6Monthly', v)}
              suffix="kr/mnd"
              min={0}
              step={100}
            />
          </Field>
          <Field label="Barn 7–10 år">
            <NumberInput
              value={config.sifo.child7to10Monthly}
              onChange={(v) => setSIFO('child7to10Monthly', v)}
              suffix="kr/mnd"
              min={0}
              step={100}
            />
          </Field>
          <Field label="Barn 11–13 år">
            <NumberInput
              value={config.sifo.child11to13Monthly}
              onChange={(v) => setSIFO('child11to13Monthly', v)}
              suffix="kr/mnd"
              min={0}
              step={100}
            />
          </Field>
          <Field label="Barn 14–17 år">
            <NumberInput
              value={config.sifo.child14to17Monthly}
              onChange={(v) => setSIFO('child14to17Monthly', v)}
              suffix="kr/mnd"
              min={0}
              step={100}
            />
          </Field>
        </div>
      </Section>

      {isModified && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning-foreground">
          Du har endret standardinnstillingene. Klikk «Tilbakestill» for å gå tilbake til norske standardverdier.
        </div>
      )}

      <Separator />

      <GoogleDriveBackupSection />

      <Separator />

      <EconomyDataSection />
    </div>
  )
}
