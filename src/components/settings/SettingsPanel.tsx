import { RotateCcw } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { defaultConfig } from '@/config/default.config'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { AppConfig } from '@/types'

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
    </div>
  )
}
