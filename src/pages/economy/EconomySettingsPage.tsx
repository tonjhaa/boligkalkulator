import { useState } from 'react'
import { Download, Upload, Trash2, Smartphone, User, Users, Plus } from 'lucide-react'
import { useEconomyStore } from '@/application/useEconomyStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { MODULES } from './OnboardingWizard'
import { cn } from '@/lib/utils'
import type { EconomyTab } from '@/types/economy'

const LAST_EXPORT_KEY = 'min-okonomi-last-export'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function Section({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ----------------------------------------------------------------
// Personalia
// ----------------------------------------------------------------

function HousingToggle({ value, onChange }: { value: 'leier' | 'eier' | undefined; onChange: (v: 'leier' | 'eier') => void }) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden w-fit">
      {(['leier', 'eier'] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'px-3 py-1 text-xs font-medium transition-colors',
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
          )}
        >
          {opt === 'leier' ? 'Leier' : 'Eier bolig'}
        </button>
      ))}
    </div>
  )
}

function PersonaliaSection() {
  const userPreferences = useEconomyStore((s) => s.userPreferences)
  const setUserPreferences = useEconomyStore((s) => s.setUserPreferences)
  const partnerVeikart = useEconomyStore((s) => s.partnerVeikart)
  const setPartnerVeikart = useEconomyStore((s) => s.setPartnerVeikart)
  const addPartnerAccount = useEconomyStore((s) => s.addPartnerAccount)
  const updatePartnerAccount = useEconomyStore((s) => s.updatePartnerAccount)
  const removePartnerAccount = useEconomyStore((s) => s.removePartnerAccount)

  const [birthYearInput, setBirthYearInput] = useState(
    userPreferences?.birthYear ? String(userPreferences.birthYear) : ''
  )

  function saveBirthYear() {
    const yr = parseInt(birthYearInput)
    if (!yr || yr < 1950 || yr > 2010) return
    setUserPreferences({
      onboardingCompleted: userPreferences?.onboardingCompleted ?? true,
      enabledTabs: userPreferences?.enabledTabs ?? [],
      payDay: userPreferences?.payDay,
      birthYear: yr,
      housingStatus: userPreferences?.housingStatus,
    })
  }

  function setHousingStatus(v: 'leier' | 'eier') {
    setUserPreferences({
      onboardingCompleted: userPreferences?.onboardingCompleted ?? true,
      enabledTabs: userPreferences?.enabledTabs ?? [],
      payDay: userPreferences?.payDay,
      birthYear: userPreferences?.birthYear,
      housingStatus: v,
    })
  }

  const p = partnerVeikart

  function updatePartner(updates: Partial<typeof p>) {
    setPartnerVeikart({ ...p, ...updates })
  }

  const bsuAgeOk = !p.bsuBirthYear || (new Date().getFullYear() - p.bsuBirthYear) <= 33
  const myBsuAgeOk = !userPreferences?.birthYear || (new Date().getFullYear() - userPreferences.birthYear) <= 33

  return (
    <Section title="Personalia" description="Grunnoppsett for deg og eventuell partner. Brukes av Boligveikart og andre beregninger på tvers av verktøyet.">
      {/* Deg */}
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <User className="h-3.5 w-3.5" />
          Deg
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Fødselsår</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={birthYearInput}
                onChange={(e) => setBirthYearInput(e.target.value)}
                onBlur={saveBirthYear}
                placeholder="f.eks. 1995"
                className="h-8 text-sm w-28"
              />
              {userPreferences?.birthYear && (
                <span className={cn(
                  'text-[11px]',
                  myBsuAgeOk ? 'text-blue-400' : 'text-muted-foreground',
                )}>
                  {myBsuAgeOk
                    ? `BSU OK (${new Date().getFullYear() - userPreferences.birthYear} år)`
                    : `Over BSU-alder (${new Date().getFullYear() - userPreferences.birthYear} år)`}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Boligstatus</Label>
            <HousingToggle value={userPreferences?.housingStatus} onChange={setHousingStatus} />
          </div>
        </div>
      </div>

      {/* Partner */}
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Users className="h-3.5 w-3.5" />
            Partner
          </div>
          <button
            onClick={() => updatePartner({ enabled: !p.enabled })}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors',
              p.enabled
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {p.enabled ? 'Aktivert' : 'Ikke aktivert'}
          </button>
        </div>

        {!p.enabled && (
          <p className="text-xs text-muted-foreground italic">
            Aktiver partner for å legge inn deres tall. Brukes i Boligveikart og Dashboard.
          </p>
        )}

        {p.enabled && (
          <div className="space-y-4">
            {/* Personalia */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Fødselsår</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={p.bsuBirthYear ?? ''}
                    onChange={(e) => updatePartner({ bsuBirthYear: parseInt(e.target.value) || undefined })}
                    placeholder="f.eks. 1996"
                    className="h-8 text-sm w-28"
                  />
                  {p.bsuBirthYear && (
                    <span className={cn(
                      'text-[11px]',
                      bsuAgeOk ? 'text-blue-400' : 'text-muted-foreground',
                    )}>
                      {bsuAgeOk
                        ? `BSU OK (${new Date().getFullYear() - p.bsuBirthYear} år)`
                        : `Over BSU-alder`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Inntekt */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Inntekt</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Årslønn brutto</Label>
                  <Input
                    type="number"
                    value={p.annualIncome || ''}
                    onChange={(e) => updatePartner({ annualIncome: parseFloat(e.target.value) || 0 })}
                    placeholder="f.eks. 600000"
                    className="h-8 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Brukes til låneevne</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Årslønn netto</Label>
                  <Input
                    type="number"
                    value={p.annualNetIncome || ''}
                    onChange={(e) => updatePartner({ annualNetIncome: parseFloat(e.target.value) || 0 })}
                    placeholder={p.annualIncome ? String(Math.round(p.annualIncome * 0.67)) : 'f.eks. 420000'}
                    className="h-8 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Brukes til sparekraft</p>
                </div>
              </div>
            </div>

            {/* BSU */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">BSU</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">BSU-saldo</Label>
                  <Input
                    type="number"
                    value={p.bsu || ''}
                    onChange={(e) => updatePartner({ bsu: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">BSU-innskudd per mnd</Label>
                  <Input
                    type="number"
                    value={p.bsuMonthlyContribution || ''}
                    onChange={(e) => updatePartner({ bsuMonthlyContribution: parseFloat(e.target.value) || 0 })}
                    placeholder={bsuAgeOk ? 'maks 2 292' : '0 (over alder)'}
                    disabled={!bsuAgeOk}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Sparekontoer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sparekontoer</p>
                <button
                  onClick={() => addPartnerAccount({ id: crypto.randomUUID(), label: 'Ny konto', balance: 0, monthlyContribution: 0, rate: 3.5 })}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted/40 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Ny konto
                </button>
              </div>
              {p.accounts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Ingen kontoer. Klikk «Ny konto» for å legge til.</p>
              ) : (
                <div className="space-y-2">
                  {p.accounts.map((acc) => (
                    <div key={acc.id} className="rounded border border-border bg-background p-2 space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Navn</Label>
                          <Input
                            value={acc.label}
                            onChange={(e) => updatePartnerAccount(acc.id, { label: e.target.value })}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Saldo (kr)</Label>
                          <Input
                            type="number"
                            value={acc.balance || ''}
                            onChange={(e) => updatePartnerAccount(acc.id, { balance: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Mnd. innskudd (kr)</Label>
                          <Input
                            type="number"
                            value={acc.monthlyContribution || ''}
                            onChange={(e) => updatePartnerAccount(acc.id, { monthlyContribution: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="h-7 text-xs"
                          />
                        </div>
                        <button
                          onClick={() => removePartnerAccount(acc.id)}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Innskudd fra (valgfritt)</Label>
                          <input
                            type="month"
                            value={acc.fromDate?.slice(0, 7) ?? ''}
                            onChange={(e) => updatePartnerAccount(acc.id, { fromDate: e.target.value ? `${e.target.value}-01` : undefined })}
                            className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Innskudd til (valgfritt)</Label>
                          <input
                            type="month"
                            value={acc.toDate?.slice(0, 7) ?? ''}
                            onChange={(e) => updatePartnerAccount(acc.id, { toDate: e.target.value ? `${e.target.value}-01` : undefined })}
                            className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ----------------------------------------------------------------
// Tidsbegrensede tillegg
// ----------------------------------------------------------------

function TidsbegrensetTilleggSection() {
  const profile = useEconomyStore((s) => s.profile)
  const setProfile = useEconomyStore((s) => s.setProfile)

  const candidates = profile?.fixedAdditions.filter(a => a.amount > 0 && !a.isPermanent) ?? []
  const permanentOnes = profile?.fixedAdditions.filter(a => a.amount > 0 && a.isPermanent) ?? []

  if (!profile || (candidates.length === 0 && permanentOnes.length === 0 && profile.housingDeduction === 0)) {
    return (
      <Section
        title="Tidsbegrensede tillegg"
        description="Importer en lønnsslipp for å se tilleggene dine her."
      >
        <p className="text-xs text-muted-foreground italic">Ingen tillegg registrert ennå.</p>
      </Section>
    )
  }

  function toggleAddition(kode: string) {
    if (!profile) return
    setProfile({
      ...profile,
      fixedAdditions: profile.fixedAdditions.map((a) =>
        a.kode === kode ? { ...a, isTemporary: !a.isTemporary } : a
      ),
    })
  }

  function markPermanent(kode: string) {
    if (!profile) return
    setProfile({
      ...profile,
      fixedAdditions: profile.fixedAdditions.map((a) =>
        a.kode === kode ? { ...a, isPermanent: true, isTemporary: false, fromDate: undefined, toDate: undefined } : a
      ),
    })
  }

  function setAdditionDate(kode: string, field: 'fromDate' | 'toDate', value: string) {
    if (!profile) return
    setProfile({
      ...profile,
      fixedAdditions: profile.fixedAdditions.map((a) =>
        a.kode === kode ? { ...a, [field]: value || undefined } : a
      ),
    })
  }

  function toggleHousingDeduction() {
    if (!profile) return
    setProfile({ ...profile, housingDeductionIsTemporary: !profile.housingDeductionIsTemporary })
  }

  return (
    <Section
      title="Tidsbegrensede tillegg"
      description='Hak av tillegg og trekk som er midlertidige. Disse gråes ut og ekskluderes fra beregninger når du trykker "Uten tillegg" i budsjett-fanen.'
    >
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
        {candidates.length === 0 && profile.housingDeduction === 0 && (
          <p className="text-xs text-muted-foreground italic">Ingen midlertidige tillegg.</p>
        )}
        {candidates.map((addition) => (
          <div key={addition.kode} className="space-y-1.5">
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!addition.isTemporary}
                  onChange={() => toggleAddition(addition.kode)}
                  className="h-3.5 w-3.5 accent-amber-400 shrink-0"
                />
                <span className="flex-1 min-w-0 truncate">{addition.label}</span>
              </label>
              <span className="font-mono text-muted-foreground shrink-0">{addition.kode}</span>
              <span className="tabular-nums text-muted-foreground shrink-0 text-right w-20">
                +{Math.round(addition.amount).toLocaleString('no-NO')} kr
              </span>
              <button
                onClick={() => markPermanent(addition.kode)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
                title="Marker som fast lønn — fjerner fra denne listen"
              >
                fast lønn
              </button>
            </div>
            {addition.isTemporary && (
              <div className="ml-6 flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-16 shrink-0">Gyldig fra</span>
                <Input
                  type="month"
                  value={addition.fromDate ?? ''}
                  onChange={e => setAdditionDate(addition.kode, 'fromDate', e.target.value)}
                  className="h-6 text-[11px] w-36 px-1.5"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="month"
                  value={addition.toDate ?? ''}
                  onChange={e => setAdditionDate(addition.kode, 'toDate', e.target.value)}
                  placeholder="løpende"
                  className="h-6 text-[11px] w-36 px-1.5"
                />
              </div>
            )}
            {!addition.isTemporary && (addition.fromDate || addition.toDate) && (
              <p className="ml-6 text-[10px] text-muted-foreground">
                {addition.fromDate ?? '?'} – {addition.toDate ?? 'løpende'}
              </p>
            )}
          </div>
        ))}
        {permanentOnes.length > 0 && (
          <div className="border-t border-border/40 pt-2.5 space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Fast lønn (skjult herfra)</p>
            {permanentOnes.map((a) => (
              <div key={a.kode} className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex-1 min-w-0 truncate">{a.label}</span>
                <span className="font-mono">{a.kode}</span>
                <span className="tabular-nums w-20 text-right">+{Math.round(a.amount).toLocaleString('no-NO')} kr</span>
                <button
                  onClick={() => setProfile({ ...profile, fixedAdditions: profile.fixedAdditions.map(x => x.kode === a.kode ? { ...x, isPermanent: false } : x) })}
                  className="text-[10px] hover:text-foreground underline underline-offset-2 shrink-0"
                >
                  tilbake
                </button>
              </div>
            ))}
          </div>
        )}
        {profile.housingDeduction > 0 && (
          <label className="flex items-center gap-3 text-xs cursor-pointer select-none border-t border-border/40 pt-2.5">
            <input
              type="checkbox"
              checked={!!profile.housingDeductionIsTemporary}
              onChange={toggleHousingDeduction}
              className="h-3.5 w-3.5 accent-amber-400 shrink-0"
            />
            <span className="flex-1">Husleietrekk</span>
            <span className="font-mono text-muted-foreground shrink-0">3209</span>
            <span className="tabular-nums text-muted-foreground shrink-0 text-right w-20">
              -{Math.round(profile.housingDeduction).toLocaleString('no-NO')} kr
            </span>
          </label>
        )}
      </div>
    </Section>
  )
}

// ----------------------------------------------------------------
// Sikkerhetskopi
// ----------------------------------------------------------------

function BackupReminderBanner({ onExport }: { onExport: () => void }) {
  const raw = localStorage.getItem(LAST_EXPORT_KEY)
  if (!raw) return null
  const lastExport = new Date(raw)
  const daysSince = Math.floor((Date.now() - lastExport.getTime()) / (1000 * 60 * 60 * 24))
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

function SikkerhetskopiBSection() {
  const store = useEconomyStore()
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [pendingData, setPendingData] = useState<string | null>(null)
  const [pendingMeta, setPendingMeta] = useState<{ exportedAt: string } | null>(null)

  function handleExport() {
    const data = {
      storeVersion: store.storeVersion,
      profile: store.profile,
      budgetTemplate: store.budgetTemplate,
      monthHistory: store.monthHistory.map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { slipPdfBase64: _pdf, ...rest } = m as typeof m & { slipPdfBase64?: unknown }
        return rest
      }),
      atfEntries: store.atfEntries,
      savingsAccounts: store.savingsAccounts,
      savingsGoals: store.savingsGoals,
      debts: store.debts,
      absenceRecords: store.absenceRecords,
      taxSettlements: store.taxSettlements,
      subscriptions: store.subscriptions,
      insurances: store.insurances,
      policyRateHistory: store.policyRateHistory,
    }
    const backup = { version: '1.0', exportedAt: new Date().toISOString(), data }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lommeboka-backup-${new Date().toISOString().split('T')[0]}.json`
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
          setImportError('Ugyldig fil. Dette ser ikke ut som en Lommeboka-sikkerhetskopi.')
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

  return (
    <Section
      title="Sikkerhetskopi"
      description="Last ned en kopi av all data og lagre den i Google Drive for tilgang fra alle enheter."
    >
      <BackupReminderBanner onExport={handleExport} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Last ned sikkerhetskopi
        </Button>
        <Label className="cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Gjenopprett fra fil
            </span>
          </Button>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleFileSelect} />
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        ⚠️ PDF-slipper lagres ikke i sikkerhetskopien og må lastes opp på nytt på ny enhet.
      </p>

      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          Ny enhet
        </div>
        <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
          <li>Last ned sikkerhetskopi</li>
          <li>Last opp til Google Drive</li>
          <li>Åpne appen på ny enhet → Innstillinger → Gjenopprett fra fil</li>
        </ol>
      </div>

      {importError && <p className="text-xs text-red-400">{importError}</p>}
      {importSuccess && <p className="text-xs text-green-500">✅ Data gjenopprettet — laster inn på nytt...</p>}

      {pendingData && pendingMeta && (
        <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3">
          <p className="text-sm font-medium">Gjenopprett sikkerhetskopi?</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Lagret: {new Date(pendingMeta.exportedAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-destructive">Dette overskriver all data.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setPendingData(null); setPendingMeta(null) }}>Avbryt</Button>
            <Button variant="default" size="sm" onClick={handleConfirmImport}>Gjenopprett</Button>
          </div>
        </div>
      )}
    </Section>
  )
}

// ----------------------------------------------------------------
// Data
// ----------------------------------------------------------------

function DataSection() {
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
    a.download = `lommeboka-${new Date().toISOString().split('T')[0]}.json`
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
        setImportError('Ugyldig fil.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Section
      title="Data"
      description={`Rådata lagret i nettleseren: ${storageKB} KB`}
    >
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
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
        </Label>
        {confirmClearSlips ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Alle slipper slettes!</span>
            <Button variant="destructive" size="sm" onClick={() => { clearAllSlips(); setConfirmClearSlips(false) }}>Bekreft</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmClearSlips(false)}>Avbryt</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="text-red-400 hover:text-red-500 hover:border-red-400" onClick={() => setConfirmClearSlips(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Slett slipper
          </Button>
        )}
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Er du sikker? Alt slettes!</span>
            <Button variant="destructive" size="sm" onClick={() => { resetAll(); setConfirmReset(false) }}>Bekreft</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Avbryt</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="text-red-400 hover:text-red-500 hover:border-red-400" onClick={() => setConfirmReset(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Nullstill alt
          </Button>
        )}
      </div>
      {importError && <p className="text-xs text-red-400">{importError}</p>}
    </Section>
  )
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Lønningsdato
// ----------------------------------------------------------------

function LønningsdatoSection() {
  const userPreferences = useEconomyStore((s) => s.userPreferences)
  const setUserPreferences = useEconomyStore((s) => s.setUserPreferences)
  const [value, setValue] = useState(String(userPreferences?.payDay ?? 12))

  function save() {
    const day = Math.min(28, Math.max(1, parseInt(value) || 12))
    setValue(String(day))
    setUserPreferences({
      onboardingCompleted: userPreferences?.onboardingCompleted ?? true,
      enabledTabs: userPreferences?.enabledTabs ?? [],
      payDay: day,
    })
  }

  return (
    <Section
      title="Lønningsdato"
      description="Dag i måneden lønn normalt utbetales. Brukes i dashbord-nedtellingen. Skyves automatisk til forrige virkedag ved helg og helligdager."
    >
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={1}
          max={28}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          className="w-20 h-8 text-sm"
        />
        <span className="text-sm text-muted-foreground">. i måneden</span>
      </div>
    </Section>
  )
}

function ModulesSection() {
  const userPreferences = useEconomyStore((s) => s.userPreferences)
  const setUserPreferences = useEconomyStore((s) => s.setUserPreferences)

  const enabled = new Set<EconomyTab>(userPreferences?.enabledTabs ?? [])

  function toggle(tab: EconomyTab) {
    const next = new Set(enabled)
    if (next.has(tab)) next.delete(tab)
    else next.add(tab)
    setUserPreferences({
      onboardingCompleted: true,
      enabledTabs: Array.from(next),
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Moduler</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Velg hvilke faner som vises i Økonomi-navigasjonen.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MODULES.map(({ tab, label, desc, icon: Icon }) => {
          const active = enabled.has(tab)
          return (
            <button
              key={tab}
              onClick={() => toggle(tab)}
              className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
              }`}
            >
              <div className={`shrink-0 h-7 w-7 rounded-md flex items-center justify-center ${
                active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
              <div className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center ${
                active ? 'border-primary bg-primary' : 'border-muted-foreground/40'
              }`}>
                {active && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Faner som alltid vises: Dashbord, Budsjett, Lønn, Innstillinger.
      </p>
    </div>
  )
}

export function EconomySettingsPage() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Økonomi — Innstillinger</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konfigurer lønnsprofil, moduler og datahåndtering.
        </p>
      </div>

      <Separator />
      <PersonaliaSection />

      <Separator />
      <LønningsdatoSection />

      <Separator />
      <ModulesSection />

      <Separator />
      <TidsbegrensetTilleggSection />

      <Separator />
      <SikkerhetskopiBSection />

      <Separator />
      <DataSection />
    </div>
  )
}
