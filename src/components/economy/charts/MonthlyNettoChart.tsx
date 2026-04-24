import type { MonthRecord } from '@/types/economy'

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

interface Props {
  slips: MonthRecord[]
}

export function MonthlyNettoChart({ slips }: Props) {
  const data = [...slips]
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .slice(-24)
    .map((m) => ({
      label: `${MONTH_NAMES[m.month]} ${String(m.year).slice(2)}`,
      netto: m.slipData?.nettoUtbetalt ?? m.nettoUtbetalt,
      month: m.month,
      year: m.year,
    }))

  if (data.length === 0) return null

  const maxNetto = Math.max(...data.map((d) => d.netto))
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const W = 400
  const H = 100
  const pad = { top: 10, right: 4, bottom: 22, left: 4 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const barW = Math.max(4, (innerW / data.length) - 2)

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Netto utbetalt per måned
        </span>
        <span className="text-[10px] text-muted-foreground">
          Siste {data.length} måneder
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 80 }} preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const x = pad.left + (i / data.length) * innerW + (innerW / data.length - barW) / 2
          const barH = Math.max(2, (d.netto / (maxNetto || 1)) * innerH)
          const y = pad.top + innerH - barH
          const isCurrent = d.year === curYear && d.month === curMonth
          const color = isCurrent ? '#22c55e' : '#3b82f6'
          const opacity = isCurrent ? '0.85' : '0.45'

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="1"
                fill={color}
                fillOpacity={opacity}
              />
              {/* Label annenhver */}
              {(data.length <= 12 || i % 3 === 0) && (
                <text
                  x={x + barW / 2}
                  y={H - pad.bottom + 10}
                  textAnchor="middle"
                  fontSize="5.5"
                  fill="hsl(215 20.2% 50%)"
                >
                  {d.label}
                </text>
              )}
              {/* Verdi på toppen av siste søyle */}
              {isCurrent && (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#22c55e"
                >
                  {Math.round(d.netto / 1000)}k
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
