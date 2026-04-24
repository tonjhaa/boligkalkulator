interface Props {
  data: { year: number; pct: number }[]
  currentRate: number | null
}

export function TaxRateChart({ data, currentRate }: Props) {
  if (data.length === 0) return null

  const W = 400
  const H = 80
  const pad = { top: 14, right: 12, bottom: 22, left: 12 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const minP = Math.max(0, Math.min(...data.map((d) => d.pct)) - 2)
  const maxP = Math.min(60, Math.max(...data.map((d) => d.pct)) + 2)
  const range = maxP - minP || 1

  const pts = data.map((d, i) => ({
    x: pad.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y: pad.top + (1 - (d.pct - minP) / range) * innerH,
    ...d,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Effektiv skattesats
        </span>
        {currentRate !== null && (
          <span className="text-[10px] font-mono text-amber-400">
            Nå: {currentRate.toFixed(1)}%
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 60 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tax-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {pts.length > 1 && (
          <path
            d={`${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(H - pad.bottom).toFixed(1)} L${pts[0].x.toFixed(1)},${(H - pad.bottom).toFixed(1)} Z`}
            fill="url(#tax-grad)"
          />
        )}

        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill="#f59e0b" />
            <text x={p.x} y={H - pad.bottom + 10} textAnchor="middle" fontSize="6" fill="hsl(215 20.2% 50%)">
              {p.year}
            </text>
            <text x={p.x} y={p.y - 5} textAnchor="middle" fontSize="6" fill="#f59e0b">
              {p.pct.toFixed(1)}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
