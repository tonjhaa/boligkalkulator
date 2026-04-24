import type { EmploymentProfile, ParsetLonnsslipp } from '@/types/economy'
import { cn } from '@/lib/utils'

interface Props {
  profile: EmploymentProfile | null
  latestSlip: ParsetLonnsslipp | null
  advanced: boolean
}

export function SalaryWaterfallHero({ profile, latestSlip, advanced }: Props) {
  if (!profile) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 px-5 py-6 text-center">
        <p className="text-sm text-muted-foreground">Sett opp lønnsprofil for å se oversikt</p>
      </div>
    )
  }

  // Bruk slip-data der tilgjengelig, profil som fallback
  const grunnlonn = latestSlip?.maanedslonn ?? profile.baseMonthly
  const tillegg = profile.fixedAdditions.filter((a) => a.amount > 0)
  const bruttoFraProfil = grunnlonn + tillegg.reduce((s, a) => s + a.amount, 0)
  const brutto = latestSlip?.bruttoSum ?? bruttoFraProfil

  const skatt = latestSlip?.skattetrekk ?? (profile.lastKnownTaxWithholding + profile.extraTaxWithholding)
  const pensjon = latestSlip?.pensjonstrekk ?? Math.round(brutto * (profile.pensionPercent / 100))
  const fagforening = latestSlip?.fagforeningskontingent ?? profile.unionFee
  const husleie = latestSlip?.husleietrekk ?? profile.housingDeduction
  const ekstraTrekk = latestSlip?.ekstraTrekk ?? profile.extraTaxWithholding
  const netto = latestSlip?.nettoUtbetalt ?? (brutto - skatt - pensjon - fagforening - husleie)

  const maxVal = brutto * 1.02

  type Step = { label: string; amount: number; cumulative: number; type: 'start' | 'add' | 'neg' | 'result'; hide?: boolean }
  const steps: Step[] = []

  // Oppbygging fra grunnlønn
  steps.push({ label: 'Grunnlønn', amount: grunnlonn, cumulative: grunnlonn, type: 'start' })

  if (advanced) {
    tillegg.forEach((a) => {
      steps.push({ label: a.label, amount: a.amount, cumulative: 0, type: 'add' })
    })
  }

  steps.push({ label: 'Brutto', amount: brutto, cumulative: brutto, type: advanced ? 'result' : 'start' })

  // Fradrag
  let cum = brutto
  cum -= skatt
  steps.push({ label: 'Skatt', amount: -skatt, cumulative: cum, type: 'neg' })
  cum -= pensjon
  steps.push({ label: 'Pensjon (SPK)', amount: -pensjon, cumulative: cum, type: 'neg' })
  if (advanced && fagforening > 0) {
    cum -= fagforening
    steps.push({ label: 'Fagforening', amount: -fagforening, cumulative: cum, type: 'neg' })
  }
  if (advanced && husleie > 0) {
    cum -= husleie
    steps.push({ label: 'Husleie', amount: -husleie, cumulative: cum, type: 'neg' })
  }
  if (!advanced) {
    const rest = fagforening + husleie + (latestSlip?.ekstraTrekk ?? 0)
    if (rest > 0) {
      cum -= rest
      steps.push({ label: 'Andre trekk', amount: -rest, cumulative: cum, type: 'neg' })
    }
  } else if (ekstraTrekk > 0 && latestSlip) {
    cum -= ekstraTrekk
    steps.push({ label: 'Ekstra trekk', amount: -ekstraTrekk, cumulative: cum, type: 'neg' })
  }

  steps.push({ label: 'Netto', amount: netto, cumulative: netto, type: 'result' })

  const nettoPercent = Math.round((netto / brutto) * 100)
  const source = latestSlip ? 'slipp' : 'profil'

  return (
    <div className="space-y-3">
      {/* Stor netto-visning */}
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Netto utbetalt</p>
        <p className="text-3xl font-bold font-mono tabular-nums text-green-500 mt-1">
          {Math.round(netto).toLocaleString('no-NO')} kr
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {nettoPercent}% av brutto · fra {source}
        </p>
      </div>

      {/* Waterfall-steg */}
      <div className="space-y-1.5">
        {steps
          .filter((s) => s.type !== 'add') // tillegg vises som liste, ikke bar
          .map((s) => {
            const absAmt = Math.abs(s.type === 'neg' ? s.amount : s.type === 'result' ? s.amount : s.cumulative)
            const widthPct = Math.max(2, (absAmt / maxVal) * 100)
            const offsetPct = s.type === 'neg' ? (s.cumulative / maxVal) * 100 : 0
            return (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-right text-muted-foreground shrink-0 text-[11px] truncate">
                  {s.label}
                </span>
                <div className="relative flex-1 h-4 bg-muted/20 rounded overflow-hidden">
                  <div
                    className={cn(
                      'absolute top-0 h-full rounded',
                      s.type === 'start' && 'bg-blue-500/60',
                      s.type === 'neg' && 'bg-red-400/60',
                      s.type === 'result' && (s.label === 'Netto' ? 'bg-green-500/70' : 'bg-blue-400/50'),
                    )}
                    style={{
                      left: s.type === 'neg' ? `${offsetPct}%` : '0%',
                      width: `${widthPct}%`,
                    }}
                  />
                </div>
                <span className={cn(
                  'w-20 text-right font-mono shrink-0 text-[11px]',
                  s.type === 'neg' && 'text-red-400',
                  s.label === 'Netto' && 'text-green-500 font-semibold',
                  s.type === 'start' && 'text-foreground',
                )}>
                  {s.amount < 0 ? '-' : ''}{Math.abs(Math.round(s.amount)).toLocaleString('no-NO')} kr
                </span>
              </div>
            )
          })}
      </div>

      {/* Tillegg (advanced) */}
      {advanced && tillegg.length > 0 && (
        <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Faste tillegg</p>
          {tillegg.map((a) => (
            <div key={a.kode} className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{a.label} ({a.kode})</span>
              <span className="font-mono text-blue-400">+{Math.round(a.amount).toLocaleString('no-NO')} kr</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
