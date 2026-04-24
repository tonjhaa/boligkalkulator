interface DataPoint {
  m: string
  v: number
}

interface FormueChartProps {
  history: DataPoint[]
  nettoFormue: number
  label?: string
}

export function FormueChart({ history, nettoFormue, label = 'Nettoinntekt' }: FormueChartProps) {
  if (history.length < 2) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 flex flex-col items-center justify-center gap-1 p-4">
        <p className="text-xs text-muted-foreground">Last opp lønnsslipper for å se trend</p>
      </div>
    )
  }

  const W = 300
  const H = 100
  const pad = { top: 14, right: 10, bottom: 22, left: 10 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const min = Math.min(...history.map((d) => d.v))
  const max = Math.max(...history.map((d) => d.v))
  const range = max - min || 1

  const pts = history.map((d, i) => ({
    x: pad.left + (i / (history.length - 1)) * innerW,
    y: pad.top + (1 - (d.v - min) / range) * innerH,
    ...d,
  }))

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  const areaPath =
    `${linePath} ` +
    `L${pts[pts.length - 1].x.toFixed(1)},${(H - pad.bottom).toFixed(1)} ` +
    `L${pts[0].x.toFixed(1)},${(H - pad.bottom).toFixed(1)} Z`

  const lastVal = history[history.length - 1].v
  const prevVal = history[history.length - 2].v
  const trendUp = lastVal > prevVal * 1.01
  const trendDown = lastVal < prevVal * 0.99

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-2 flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
          {trendUp ? '↑' : trendDown ? '↓' : '→'}{' '}
          {Math.round(nettoFormue).toLocaleString('no-NO')} kr netto formue
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full flex-1"
        style={{ minHeight: 64 }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fg-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Referanselinje — snitt */}
        <line
          x1={pad.left}
          y1={pad.top + innerH / 2}
          x2={W - pad.right}
          y2={pad.top + innerH / 2}
          stroke="hsl(217.2 32.6% 20%)"
          strokeDasharray="4 3"
          strokeWidth="0.8"
        />

        <path d={areaPath} fill="url(#fg-grad)" />
        <path
          d={linePath}
          fill="none"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Siste punkt markert */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r="2.5"
          fill="#22c55e"
        />

        {/* X-akse labels — vis annenhver hvis mange punkter */}
        {pts.map((p, i) => {
          const show = history.length <= 6 ? true : i % 2 === 0
          return show ? (
            <text
              key={i}
              x={p.x}
              y={H - pad.bottom + 10}
              textAnchor="middle"
              fontSize="6"
              fill="hsl(215 20.2% 50%)"
            >
              {p.m}
            </text>
          ) : null
        })}
      </svg>
    </div>
  )
}
