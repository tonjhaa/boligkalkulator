import { useEconomyStore } from '@/application/useEconomyStore'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export function EconomySettingsPage() {
  const profile = useEconomyStore((s) => s.profile)
  const setProfile = useEconomyStore((s) => s.setProfile)

  if (!profile) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Ingen lønnsprofil registrert. Last opp en lønnsslipp under Lønn for å komme i gang.
      </div>
    )
  }

  function update(patch: Partial<typeof profile>) {
    setProfile({ ...profile!, ...patch })
  }

  return (
    <div className="p-6 space-y-8 max-w-lg overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Økonomi-innstillinger</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Personlige innstillinger for dashbordet. Oppdater hvert år.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          Sommerferie
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Siste arbeidsdag før ferie</Label>
            <Input
              type="date"
              value={profile.summerVacationStart ?? ''}
              onChange={(e) => update({ summerVacationStart: e.target.value || undefined })}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Nedtelling på dashbordet</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Første arbeidsdag etter ferie</Label>
            <Input
              type="date"
              value={profile.summerVacationEnd ?? ''}
              onChange={(e) => update({ summerVacationEnd: e.target.value || undefined })}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Vises under ferien</p>
          </div>
        </div>
      </div>
    </div>
  )
}
