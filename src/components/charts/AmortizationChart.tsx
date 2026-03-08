import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { AmortizationPlan } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  plan: AmortizationPlan
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-2">År {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function AmortizationChart({ plan }: Props) {
  if (plan.rows.length === 0) return null

  const rateChangeYear = plan.rateChangeMonth
    ? Math.ceil(plan.rateChangeMonth / 12)
    : undefined

  const data = plan.yearlyTotals.map((y) => ({
    year: y.year,
    Avdrag: Math.round(y.totalPrincipal),
    Renter: Math.round(y.totalInterest),
    Restgjeld: Math.round(y.endBalance),
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'År',
              position: 'insideBottom',
              offset: -2,
              fontSize: 11,
              fill: 'hsl(var(--muted-foreground))',
            }}
          />
          <YAxis
            yAxisId="bar"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                ? `${Math.round(v / 1_000)}k`
                : String(v)
            }
            width={48}
          />
          <YAxis
            yAxisId="line"
            orientation="right"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                ? `${Math.round(v / 1_000)}k`
                : String(v)
            }
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}
            iconType="circle"
            iconSize={8}
          />

          {/* Markering for renteendring */}
          {rateChangeYear !== undefined && (
            <ReferenceLine
              yAxisId="bar"
              x={rateChangeYear}
              stroke="#facc15"
              strokeDasharray="4 2"
              strokeWidth={2}
              label={{
                value: `Ny rente ${plan.newRateAfterChange?.toFixed(1)}%`,
                position: 'top',
                fontSize: 9,
                fill: '#facc15',
              }}
            />
          )}

          <Bar yAxisId="bar" dataKey="Avdrag" stackId="payments" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar yAxisId="bar" dataKey="Renter" stackId="payments" fill="#f87171" radius={[2, 2, 0, 0]} />
          <Line
            yAxisId="line"
            type="monotone"
            dataKey="Restgjeld"
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground mt-1">
        <span>
          Totalt betalt:{' '}
          <span className="text-foreground font-medium">{formatCurrency(plan.totalPaid)}</span>
        </span>
        <span>
          Herav renter:{' '}
          <span className="text-red-400 font-medium">{formatCurrency(plan.totalInterestPaid)}</span>
        </span>
        {plan.monthsSavedByExtraPayment !== undefined && plan.monthsSavedByExtraPayment > 0 && (
          <span>
            Spart:{' '}
            <span className="text-green-400 font-medium">{plan.monthsSavedByExtraPayment} mnd kortere</span>

          </span>
        )}
      </div>
    </div>
  )
}
