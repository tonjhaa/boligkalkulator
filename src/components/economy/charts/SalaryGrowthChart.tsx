import type { LonnsoppgjorRecord } from '@/types/economy'

interface Props {
  records: LonnsoppgjorRecord[]
  cagr: number | null
}

const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

export function SalaryGrowthChart({ records, cagr }: Props) {
  const sorted = [...records]
    .filter((r) => r.maanedslonn > 0)
    .sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.effectiveDate.localeCompare(b.effectiveDate)
    )

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Lønnsutvikling</p>
        <p className="text-xs text-muted-foreground">
          Ingen lønnsoppgjør registrert. Bruk "Hent fra slipper"-knappen eller legg til manuelt.
        </p>
      </div>
    )
  }

  const W = 400
  const H = 100
  const pad = { top: 14, right: 12, bottom: 28, left: 12 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const minV = Math.min(...sorted.map((r) => r.maanedslonn)) * 0.97
  const maxV = Math.max(...sorted.map((r) => r.maanedslonn)) * 1.03
  const range = maxV - minV || 1

  const pts = sorted.map((r, i) => ({
    x: pad.left + (sorted.length > 1 ? (i / (sorted.length - 1)) * innerW : innerW / 2),
    y: pad.top + (1 - (r.maanedslonn - minV) / range) * innerH,
    r,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Lønnsutvikling
        </span>
        {cagr !== null && (
          <span className="text-[10px] text-muted-foreground font-mono">
            CAGR: {(cagr * 100).toFixed(1)}% / år
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 80 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="salary-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {pts.length > 1 && (
          <path
            d={`${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(H - pad.bottom).toFixed(1)} L${pts[0].x.toFixed(1)},${(H - pad.bottom).toFixed(1)} Z`}
            fill="url(#salary-grad)"
          />
        )}

        {/* Linje */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Punkter */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={p.r.source === 'forventet' ? '#f59e0b' : '#3b82f6'}
            stroke="hsl(240 10% 3.9%)"
            strokeWidth="1"
          />
        ))}

        {/* Labels — vis kun noen for å unngå overlapp */}
        {pts.map((p, i) => {
          const show = sorted.length <= 5 || i === 0 || i === sorted.length - 1 || i % Math.ceil(sorted.length / 5) === 0
          const month = Number(p.r.effectiveDate?.slice(5, 7) ?? 1)
          const label = `${MONTH_SHORT[month] ?? ''} ${p.r.year}`
          return show ? (
            <text key={i} x={p.x} y={H - pad.bottom + 10} textAnchor="middle" fontSize="6" fill="hsl(215 20.2% 50%)">
              {label}
            </text>
          ) : null
        })}

        {/* Lønnsverdier for første og siste */}
        {pts.length > 0 && (
          <>
            <text x={pts[0].x} y={pts[0].y - 5} textAnchor="middle" fontSize="6" fill="hsl(215 20.2% 65%)">
              {Math.round(sorted[0].maanedslonn / 1000)}k
            </text>
            {pts.length > 1 && (
              <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 5} textAnchor="middle" fontSize="6" fill="#3b82f6">
                {Math.round(sorted[sorted.length - 1].maanedslonn / 1000)}k
              </text>
            )}
          </>
        )}
      </svg>

      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-[10px] text-muted-foreground">Historisk</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-muted-foreground">Forventet</span>
        </div>
      </div>
    </div>
  )
}
