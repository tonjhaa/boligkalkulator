import { useState, useEffect } from 'react'
import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from '@/lib/syncEconomyData'

// ── Isolert klokke (re-renderer hvert sekund) ───────────────
function LiveKlokke() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums text-foreground font-mono leading-tight">
        {now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-[11px] text-muted-foreground capitalize leading-tight">
        {now.toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  )
}

function SyncDot() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus)
  useEffect(() => onSyncStatusChange(setStatus), [])
  if (status === 'idle') return null
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
      {status === 'saving' && <><Loader2 className="h-2.5 w-2.5 animate-spin" />Lagrer…</>}
      {status === 'saved' && <><Cloud className="h-2.5 w-2.5 text-green-500" />Lagret</>}
      {status === 'error' && <><CloudOff className="h-2.5 w-2.5 text-red-400" />Feil</>}
    </span>
  )
}

// ── Health-score ring ────────────────────────────────────────
function HealthRing({ score }: { score: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(217.2 32.6% 14%)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  )
}

// ── Metrikkfelt med venstrekant ──────────────────────────────
function MetricCell({
  label, value, colorClass, sub, sign, delta,
}: {
  label: string
  value: number
  colorClass?: string
  sub?: string
  sign?: boolean
  delta?: number
}) {
  const prefix = sign && value > 0 ? '+' : sign && value < 0 ? '−' : ''
  const showDelta = delta !== undefined && Math.abs(delta) > 200
  return (
    <div className="flex flex-col justify-center border-l border-border/40 px-5 min-w-0 flex-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <p className={cn('text-base font-semibold font-mono tabular-nums truncate', colorClass ?? 'text-foreground')}>
          {prefix}{Math.round(Math.abs(value)).toLocaleString('no-NO')} kr
        </p>
        {showDelta && (
          <span className={cn('text-[9px] font-semibold tabular-nums shrink-0', delta! > 0 ? 'text-green-400' : 'text-red-400')}>
            {delta! > 0 ? '↑' : '↓'} {Math.round(Math.abs(delta!)).toLocaleString('no-NO')}
          </span>
        )}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  )
}

// ── Offentlig API ────────────────────────────────────────────

export interface HeroBandProps {
  healthScore: number
  nettoFormue: number
  totalSparing: number
  totalGjeld: number
  nettoInn: number
  nettoInnDelta?: number
  sparerate: number
  daysToPayday: number
  nextPayday: Date
  juneForecast: { nettoJuni: number; nettoEkstra: number } | null
}

export function calcHealthScore(params: {
  sparerate: number
  absenceDays: number
  nettoFormue: number
  overskudd: number | null
  totalSparing: number
  totalGjeld: number
}): number {
  return Math.min(100, Math.round(
    (params.sparerate >= 15 ? 25 : params.sparerate >= 10 ? 18 : 8) +
    (params.absenceDays <= 8 ? 20 : params.absenceDays <= 16 ? 12 : 4) +
    (params.nettoFormue > 0 ? 25 : 10) +
    ((params.overskudd ?? 0) > 0 ? 20 : 5) +
    (params.totalGjeld < params.totalSparing ? 10 : 4)
  ))
}

export function HeroBand({
  healthScore,
  nettoFormue,
  totalSparing,
  totalGjeld,
  nettoInn,
  nettoInnDelta,
  sparerate,
  daysToPayday,
  nextPayday,
  juneForecast,
}: HeroBandProps) {
  const paydayColor = daysToPayday <= 3
    ? 'text-green-400'
    : daysToPayday <= 7
    ? 'text-yellow-400'
    : 'text-foreground'

  return (
    <div className="flex items-stretch border-b border-border/50 bg-card/30 shrink-0 overflow-x-auto">
      {/* Cell 1: Helse-score + klokke */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0">
        <HealthRing score={healthScore} />
        <div>
          <LiveKlokke />
          <SyncDot />
        </div>
      </div>

      {/* Cell 2: Netto formue */}
      <MetricCell
        label="Netto formue"
        value={nettoFormue}
        colorClass={nettoFormue >= 0 ? 'text-green-500' : 'text-red-400'}
        sub={totalGjeld > 0 ? `Gjeld: ${Math.round(totalGjeld).toLocaleString('no-NO')} kr` : undefined}
      />

      {/* Cell 3: Total sparing */}
      <MetricCell
        label="Total sparing"
        value={totalSparing}
        colorClass="text-blue-400"
      />

      {/* Cell 4: Netto inn + sparerate */}
      <MetricCell
        label="Netto inn"
        value={nettoInn}
        colorClass={nettoInn > 0 ? 'text-foreground' : 'text-muted-foreground'}
        sub={sparerate > 0 ? `Sparerate: ${sparerate}%` : 'Ingen slipp lastet'}
        delta={nettoInnDelta}
      />

      {/* Cell 5: Neste lønning */}
      <div className="flex flex-col justify-center border-l border-border/40 px-5 min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Neste lønning</p>
        <p className={cn('text-base font-semibold font-mono tabular-nums mt-0.5', paydayColor)}>
          {daysToPayday} dager
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {nextPayday.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
          {juneForecast != null && ` · Juni: ${Math.round(juneForecast.nettoJuni).toLocaleString('no-NO')} kr`}
        </p>
      </div>
    </div>
  )
}
