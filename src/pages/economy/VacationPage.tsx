import { useEconomyStore } from '@/application/useEconomyStore'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function CountdownBlock({ label, days, date }: { label: string; days: number; date: string }) {
  const d = new Date(date)
  const formatted = d.toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isPast = days <= 0
  const isClose = days > 0 && days <= 7

  return (
    <div className={cn(
      'rounded-xl border px-5 py-4 space-y-1',
      isPast ? 'border-muted bg-muted/20' : isClose ? 'border-green-500/30 bg-green-500/5' : 'border-border/50 bg-card/50'
    )}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn(
        'text-3xl font-bold tabular-nums',
        isPast ? 'text-muted-foreground' : isClose ? 'text-green-400' : 'text-foreground'
      )}>
        {isPast ? '—' : `${days}`}
        {!isPast && <span className="text-base font-normal text-muted-foreground ml-1">dager</span>}
      </p>
      <p className="text-xs text-muted-foreground">{formatted}</p>
    </div>
  )
}

export function VacationPage() {
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

  const { summerVacationStart, summerVacationEnd } = profile
  const daysToLast = summerVacationStart ? daysUntil(summerVacationStart) : null
  const daysToFirst = summerVacationEnd ? daysUntil(summerVacationEnd) : null
  const onVacation = daysToLast !== null && daysToLast <= 0 && (daysToFirst === null || daysToFirst > 0)

  return (
    <div className="p-6 space-y-8 max-w-xl overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ferie</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Nedtelling og oversikt over sommerferien.</p>
      </div>

      {onVacation && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-center">
          <p className="text-2xl">🏖️</p>
          <p className="text-base font-semibold text-green-400 mt-1">Du er på ferie!</p>
          {daysToFirst !== null && daysToFirst > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Tilbake på jobb om {daysToFirst} dager</p>
          )}
        </div>
      )}

      {/* Nedtellinger */}
      {(summerVacationStart || summerVacationEnd) && (
        <div className="grid grid-cols-2 gap-3">
          {summerVacationStart && daysToLast !== null && daysToLast > 0 && (
            <CountdownBlock label="Siste arbeidsdag" days={daysToLast} date={summerVacationStart} />
          )}
          {summerVacationEnd && daysToFirst !== null && (
            <CountdownBlock label="Første arbeidsdag" days={Math.max(0, daysToFirst)} date={summerVacationEnd} />
          )}
        </div>
      )}

      {/* Innstillinger */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Datoer</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Siste arbeidsdag før ferie</Label>
            <Input
              type="date"
              value={summerVacationStart ?? ''}
              onChange={(e) => update({ summerVacationStart: e.target.value || undefined })}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Første arbeidsdag etter ferie</Label>
            <Input
              type="date"
              value={summerVacationEnd ?? ''}
              onChange={(e) => update({ summerVacationEnd: e.target.value || undefined })}
              className="text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
