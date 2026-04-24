import { useState } from 'react'
import { Map, TrendingUp, Home, PiggyBank, AlertTriangle, Info } from 'lucide-react'
import { useVeikart, EK_KRAV, MAX_GJELDSGRAD, BSU_MAX_YEARLY, BSU_TAX_BENEFIT } from '@/hooks/useVeikart'
import { cn } from '@/lib/utils'

function fmtNOK(n: number, short = false): string {
  if (short) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mill`
    if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)} k`
  }
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

// ── SVG Kjøpekraftkurve ──────────────────────────────────────
function TimelineChart({ scenarios }: { scenarios: ReturnType<typeof useVeikart>['scenarios'] }) {
  if (scenarios.length < 2) return null
  const W = 400
  const H = 100
  const pad = { top: 14, right: 12, bottom: 22, left: 12 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const maxV = Math.max(...scenarios.map((s) => s.maxPurchase)) * 1.05
  const pts = scenarios.map((s, i) => ({
    x: pad.left + (i / (scenarios.length - 1)) * innerW,
    y: pad.top + (1 - s.maxPurchase / maxV) * innerH,
    ...s,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 80 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="vk-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${linePath} L${pts[pts.length-1].x.toFixed(1)},${(H-pad.bottom).toFixed(1)} L${pts[0].x.toFixed(1)},${(H-pad.bottom).toFixed(1)} Z`}
        fill="url(#vk-grad)"
      />
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={i === 0 ? '3.5' : '2.5'} fill={i === 0 ? '#22c55e' : '#3b82f6'} />
          <text x={p.x} y={H - pad.bottom + 10} textAnchor="middle" fontSize="6" fill="hsl(215 20.2% 50%)">{p.label}</text>
          <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="6" fill={i === 0 ? '#22c55e' : '#3b82f6'}>
            {fmtNOK(p.maxPurchase, true)}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Scenario-kort ────────────────────────────────────────────
function ScenarioCard({ scenario, isFirst }: { scenario: ReturnType<typeof useVeikart>['scenarios'][number]; isFirst: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-2 flex flex-col',
      isFirst
        ? 'border-green-500/30 bg-green-500/5'
        : 'border-border/50 bg-card/60',
    )}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold', isFirst ? 'text-green-400' : 'text-muted-foreground')}>
          {scenario.label}
        </span>
        {isFirst && <span className="text-[10px] text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">Nå</span>}
      </div>

      <p className={cn('text-xl font-bold font-mono tabular-nums', isFirst ? 'text-green-500' : 'text-foreground')}>
        {fmtNOK(scenario.maxPurchase)}
      </p>
      <p className="text-[10px] text-muted-foreground">Maks kjøpesum</p>

      <div className="border-t border-border/30 pt-2 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">EK (sparing)</span>
          <span className="font-mono">{fmtNOK(scenario.equity)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">BSU</span>
          <span className="font-mono text-blue-400">{fmtNOK(scenario.bsu)}</span>
        </div>
        {scenario.monthlyPaymentAtStress > 0 && (
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Månedskost (stress)</span>
            <span className="font-mono text-amber-400">{fmtNOK(scenario.monthlyPaymentAtStress)}/mnd</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hoved ────────────────────────────────────────────────────
export function VeikartPage() {
  const vk = useVeikart()
  const [showInfo, setShowInfo] = useState(false)

  const hasData = vk.annualIncome > 0 || vk.totalEquity > 0

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── VENSTRE — Oppsummering og regler ── */}
      <div className="w-[320px] shrink-0 border-r border-border overflow-y-auto p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold">Boligveikart</h2>
        </div>

        {/* Nåværende posisjon */}
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Din posisjon i dag</p>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <PiggyBank className="h-3 w-3" /> Sparing (ikke BSU)
              </span>
              <span className="font-mono">{fmtNOK(vk.equity)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Home className="h-3 w-3" /> BSU
              </span>
              <span className="font-mono text-blue-400">{fmtNOK(vk.bsu)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Fond</span>
              <span className="font-mono text-violet-400">{fmtNOK(vk.fond)}</span>
            </div>
            <div className="flex justify-between text-[11px] border-t border-border/30 pt-1.5 mt-0.5">
              <span className="font-medium">Total EK</span>
              <span className="font-mono font-semibold text-green-500">{fmtNOK(vk.totalEquity)}</span>
            </div>
          </div>

          {vk.existingDebt > 0 && (
            <div className="flex justify-between text-[11px] text-red-400/80">
              <span>Eksisterende gjeld</span>
              <span className="font-mono">−{fmtNOK(vk.existingDebt)}</span>
            </div>
          )}

          {vk.annualIncome > 0 && (
            <div className="flex justify-between text-[11px] border-t border-border/30 pt-1.5">
              <span className="text-muted-foreground">Bruttoinntekt/år</span>
              <span className="font-mono">{fmtNOK(vk.annualIncome)}</span>
            </div>
          )}
        </div>

        {/* BSU-tips */}
        {vk.bsuCanSave && vk.bsuRemaining > 0 && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 space-y-1">
            <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">BSU-mulighet</p>
            <p className="text-[11px] text-muted-foreground">
              Du kan spare {fmtNOK(Math.min(BSU_MAX_YEARLY, vk.bsuRemaining))} i år og få{' '}
              <span className="text-blue-400 font-medium">
                {fmtNOK(Math.min(BSU_MAX_YEARLY, vk.bsuRemaining) * BSU_TAX_BENEFIT)}
              </span>{' '}
              tilbake i skatt ({(BSU_TAX_BENEFIT * 100).toFixed(0)}% skattefradrag).
            </p>
            <p className="text-[10px] text-muted-foreground">
              {fmtNOK(vk.bsuRemaining)} igjen til BSU-taket på 300 000 kr.
            </p>
          </div>
        )}

        {/* Stresstest */}
        {vk.stressMonthlyPayment > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1">
            <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wide">Stresstest</p>
            <p className="text-[11px] text-muted-foreground">
              Banken beregner om du tåler rente på{' '}
              <span className="text-amber-400 font-medium">{(vk.stressRate * 100).toFixed(1)}%</span>.
              Månedskostnad: <span className="text-amber-400 font-medium">{fmtNOK(vk.stressMonthlyPayment)}</span>/mnd.
            </p>
          </div>
        )}

        {/* Regelverk */}
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3 w-3" />
          {showInfo ? 'Skjul regelverk' : 'Vis regelverk (boliglånsforskriften 2025)'}
        </button>

        {showInfo && (
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-3 space-y-1.5 text-[11px]">
            <p className="font-medium text-muted-foreground mb-2">Boliglånsforskriften 2025</p>
            <div className="flex justify-between"><span className="text-muted-foreground">EK-krav</span><span>{(EK_KRAV * 100).toFixed(0)}% av kjøpesum</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Maks gjeldsgrad</span><span>{MAX_GJELDSGRAD}× bruttoinntekt</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stresstest</span><span>+3 pp, min 7%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">BSU maks/år</span><span>{fmtNOK(BSU_MAX_YEARLY)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">BSU maks totalt</span><span>300 000 kr</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">BSU skattefradrag</span><span>{(BSU_TAX_BENEFIT * 100).toFixed(0)}% av innskudd</span></div>
          </div>
        )}
      </div>

      {/* ── HØYRE — Scenarier og chart ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Map className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Fyll inn lønnsprofil og sparekonto for å se ditt boligveikart.
            </p>
          </div>
        ) : (
          <>
            {/* Kjøpekraft over tid */}
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Kjøpekraftutvikling
                </span>
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <TimelineChart scenarios={vk.scenarios} />
            </div>

            {/* 5 scenario-kort */}
            <div className="grid grid-cols-5 gap-2.5">
              {vk.scenarios.map((s, i) => (
                <ScenarioCard key={s.years} scenario={s} isFirst={i === 0} />
              ))}
            </div>

            {/* Hva øker / bremser kjøpekraft */}
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Hva øker kjøpekraften din?
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Driver
                  icon="📈"
                  label="Høyere inntekt"
                  desc={`+1 000 kr/mnd brutto = +${fmtNOK(1000 * 12 * MAX_GJELDSGRAD, true)} kjøpesum`}
                  positive
                />
                <Driver
                  icon="💰"
                  label="Mer sparing"
                  desc={`+${fmtNOK(vk.monthlySavings)}/mnd spares nå`}
                  positive={vk.monthlySavings > 0}
                />
                <Driver
                  icon="🏦"
                  label="BSU-optimalisering"
                  desc={vk.bsuCanSave ? `Maks ${fmtNOK(BSU_MAX_YEARLY)}/år + ${(BSU_TAX_BENEFIT * 100).toFixed(0)}% skatterabatt` : 'BSU er fylt opp'}
                  positive={vk.bsuCanSave}
                />
                <Driver
                  icon="📉"
                  label="Nedbetaling av gjeld"
                  desc={vk.existingDebt > 0 ? `Gjeld: ${fmtNOK(vk.existingDebt)} begrenser lånerammen` : 'Ingen eksisterende gjeld — bra!'}
                  positive={vk.existingDebt === 0}
                />
              </div>
            </div>

            {/* Advarsel om manglende data */}
            {vk.annualIncome === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Sett opp lønnsprofil under Lønn-fanen for nøyaktige beregninger.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Driver({ icon, label, desc, positive }: { icon: string; label: string; desc: string; positive: boolean }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-sm shrink-0">{icon}</span>
      <div>
        <p className={cn('text-[11px] font-medium', positive ? 'text-foreground' : 'text-muted-foreground')}>{label}</p>
        <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
      </div>
    </div>
  )
}
