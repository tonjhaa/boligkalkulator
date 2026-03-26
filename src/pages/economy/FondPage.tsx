import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useEconomyStore } from '@/application/useEconomyStore'
import type { FondEntry, FondPortfolio, FondPortfolioSnapshot } from '@/types/economy'

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function fmtNOK(n: number) {
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function monthsBetween(start: string, end: Date): number {
  const s = new Date(start)
  return Math.max(
    0,
    (end.getFullYear() - s.getFullYear()) * 12 + (end.getMonth() - s.getMonth()) + 1,
  )
}

const FUND_TYPE_LABELS: Record<FondEntry['type'], string> = {
  aktivt: 'Aktivt fond',
  indeks: 'Indeksfond',
  rente: 'Rentefond',
  annet: 'Annet',
}

// ------------------------------------------------------------
// TICKER
// ------------------------------------------------------------

interface TickerItem {
  name: string
  label: string
  isPositive: boolean | null
}

function Ticker({ funds }: { funds: FondEntry[] }) {
  const items: TickerItem[] = funds.map((f) => ({
    name: f.name,
    label: `${f.allocationPercent.toFixed(1)}%`,
    isPositive: null,
  }))

  const content = [...items, ...items] // duplicate for seamless loop

  return (
    <div
      className="overflow-hidden bg-zinc-950 border-b border-zinc-800 py-2"
      style={{ fontFamily: 'ui-monospace, monospace' }}
    >
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 40s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="ticker-track">
        {content.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 px-4 text-xs shrink-0">
            <span className="text-zinc-300 font-medium">{item.name}</span>
            <span
              className={
                item.isPositive === null
                  ? 'text-zinc-500'
                  : item.isPositive
                  ? 'text-green-400'
                  : 'text-red-400'
              }
            >
              {item.label}
            </span>
            <span className="text-zinc-700 mx-1">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// SUMMARY CARDS
// ------------------------------------------------------------

function SummaryCard({
  label,
  value,
  subvalue,
  highlight,
}: {
  label: string
  value: string
  subvalue?: string
  highlight?: 'positive' | 'negative' | 'neutral'
}) {
  const valueClass =
    highlight === 'positive'
      ? 'text-green-400'
      : highlight === 'negative'
      ? 'text-red-400'
      : 'text-foreground'

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono font-semibold text-sm ${valueClass}`}>{value}</p>
      {subvalue && <p className="text-xs text-muted-foreground">{subvalue}</p>}
    </div>
  )
}

// ------------------------------------------------------------
// DEVELOPMENT CHART
// ------------------------------------------------------------

interface ChartPoint {
  label: string
  investert: number
  faktisk: number | null
}

function buildChartData(portfolio: FondPortfolio, now: Date): ChartPoint[] {
  const months = monthsBetween(portfolio.startDate, now)
  if (months === 0) return []

  const sortedSnapshots = [...portfolio.snapshots].sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  const points: ChartPoint[] = []
  for (let i = 1; i <= months; i++) {
    const d = new Date(portfolio.startDate)
    d.setMonth(d.getMonth() + i - 1)
    const yearStr = d.getFullYear()
    const monthStr = String(d.getMonth() + 1).padStart(2, '0')
    const isoPrefix = `${yearStr}-${monthStr}`

    const investert = portfolio.monthlyDeposit * i

    // Find the latest snapshot at or before this month
    const snap = [...sortedSnapshots]
      .filter((s) => s.date.slice(0, 7) <= isoPrefix)
      .at(-1)

    points.push({
      label: `${monthStr}/${String(yearStr).slice(2)}`,
      investert,
      faktisk: snap ? snap.totalValue : null,
    })
  }

  return points
}

function DevelopmentChart({ portfolio, now }: { portfolio: FondPortfolio; now: Date }) {
  const data = buildChartData(portfolio, now)

  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Ingen data å vise ennå.
      </p>
    )
  }

  // Fill null faktisk forward/backward for chart continuity
  const filled = data.map((pt, i) => {
    if (pt.faktisk !== null) return pt
    // Find nearest snapshot after this point
    const next = data.slice(i + 1).find((p) => p.faktisk !== null)
    return { ...pt, faktisk: next ? next.faktisk : undefined }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={filled} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradInvestert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradFaktisk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          interval={Math.floor(filled.length / 6)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          width={42}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }}
          formatter={(v) => [fmtNOK(Number(v)), '']}
        />
        <Area
          type="monotone"
          dataKey="investert"
          name="Investert"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill="url(#gradInvestert)"
          dot={false}
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="faktisk"
          name="Faktisk verdi"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#gradFaktisk)"
          dot={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ------------------------------------------------------------
// DONUT + FUND LIST
// ------------------------------------------------------------

function AllocationSection({ portfolio, latestValue }: { portfolio: FondPortfolio; latestValue: number | null }) {
  if (portfolio.funds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Ingen fond registrert.
      </p>
    )
  }

  const pieData = portfolio.funds.map((f) => ({
    name: f.name,
    value: f.allocationPercent,
    color: f.color,
  }))

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Donut */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <PieChart width={180} height={180}>
          <Pie
            data={pieData}
            cx={85}
            cy={85}
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            isAnimationActive={false}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}
            formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Andel']}
          />
        </PieChart>
      </div>

      {/* Fund list */}
      <div className="flex-1 space-y-2 min-w-0">
        {portfolio.funds.map((fund) => {
          const fundValue = latestValue !== null ? (fund.allocationPercent / 100) * latestValue : null
          return (
            <div
              key={fund.id}
              className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: fund.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{fund.name}</p>
                <p className="text-xs text-muted-foreground">{FUND_TYPE_LABELS[fund.type]}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold font-mono">{fund.allocationPercent.toFixed(1)}%</p>
                {fundValue !== null && (
                  <p className="text-xs text-muted-foreground font-mono">{fmtNOK(fundValue)}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// SNAPSHOT SECTION
// ------------------------------------------------------------

function SnapshotSection({
  portfolio,
  onAdd,
  onRemove,
}: {
  portfolio: FondPortfolio
  onAdd: (s: FondPortfolioSnapshot) => void
  onRemove: (date: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [value, setValue] = useState('')

  const sorted = [...portfolio.snapshots].sort((a, b) => b.date.localeCompare(a.date))

  function handleAdd() {
    const v = parseFloat(value)
    if (!date || isNaN(v) || v <= 0) return
    onAdd({ date, totalValue: v })
    setValue('')
    setDate(today)
  }

  return (
    <div className="space-y-3">
      {/* Form */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
        <div className="space-y-1">
          <Label className="text-xs">Dato</Label>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Totalverdi (kr)</Label>
          <Input
            type="number"
            className="h-8 text-xs w-32"
            placeholder="f.eks. 28500"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={handleAdd}
          disabled={!date || !value || parseFloat(value) <= 0}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Legg til
        </Button>
      </div>

      {/* Snapshot list */}
      {sorted.length > 0 ? (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dato</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Verdi</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((snap) => (
                <tr key={snap.date} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(snap.date)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{fmtNOK(snap.totalValue)}</td>
                  <td className="px-1 py-2">
                    <button
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                      onClick={() => onRemove(snap.date)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Ingen verdimålinger registrert ennå. Logg din KRON-verdi ovenfor.
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// PORTFOLIO SETTINGS
// ------------------------------------------------------------

function PortfolioSettings({
  portfolio,
  onUpdate,
}: {
  portfolio: FondPortfolio
  onUpdate: (p: FondPortfolio) => void
}) {
  const [monthlyDeposit, setMonthlyDeposit] = useState(String(portfolio.monthlyDeposit))
  const [startDate, setStartDate] = useState(portfolio.startDate)
  const [funds, setFunds] = useState<FondEntry[]>(portfolio.funds)

  // New fund form
  const [newFundName, setNewFundName] = useState('')
  const [newFundType, setNewFundType] = useState<FondEntry['type']>('aktivt')
  const [newFundAlloc, setNewFundAlloc] = useState('')
  const [newFundColor, setNewFundColor] = useState('#6366f1')

  const isDirty =
    monthlyDeposit !== String(portfolio.monthlyDeposit) ||
    startDate !== portfolio.startDate ||
    JSON.stringify(funds) !== JSON.stringify(portfolio.funds)

  function handleSave() {
    onUpdate({
      ...portfolio,
      monthlyDeposit: parseFloat(monthlyDeposit) || portfolio.monthlyDeposit,
      startDate,
      funds,
    })
  }

  function handleAddFund() {
    const alloc = parseFloat(newFundAlloc)
    if (!newFundName.trim() || isNaN(alloc)) return
    const newFund: FondEntry = {
      id: crypto.randomUUID(),
      name: newFundName.trim(),
      type: newFundType,
      allocationPercent: alloc,
      color: newFundColor,
    }
    setFunds((prev) => [...prev, newFund])
    setNewFundName('')
    setNewFundAlloc('')
  }

  function handleRemoveFund(id: string) {
    setFunds((prev) => prev.filter((f) => f.id !== id))
  }

  function handleFundAllocationChange(id: string, val: string) {
    setFunds((prev) =>
      prev.map((f) => (f.id === id ? { ...f, allocationPercent: parseFloat(val) || f.allocationPercent } : f)),
    )
  }

  return (
    <div className="space-y-4">
      {/* Basic settings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Månedlig sparing (kr)</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={monthlyDeposit}
            onChange={(e) => setMonthlyDeposit(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Startdato</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
      </div>

      {/* Fund list */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Fond</p>
        {funds.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0 border border-border/50"
              style={{ background: f.color }}
            />
            <span className="flex-1 text-xs truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground">{FUND_TYPE_LABELS[f.type]}</span>
            <Input
              type="number"
              step="0.1"
              className="h-7 text-xs w-20"
              value={f.allocationPercent}
              onChange={(e) => handleFundAllocationChange(f.id, e.target.value)}
            />
            <span className="text-xs text-muted-foreground">%</span>
            <button
              className="text-muted-foreground hover:text-red-400 transition-colors"
              onClick={() => handleRemoveFund(f.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add fund */}
      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">Legg til fond</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1 flex-1 min-w-32">
            <Label className="text-xs">Navn</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Fondsnavn"
              value={newFundName}
              onChange={(e) => setNewFundName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={newFundType} onValueChange={(v) => setNewFundType(v as FondEntry['type'])}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FUND_TYPE_LABELS) as FondEntry['type'][]).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {FUND_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-20">
            <Label className="text-xs">Andel %</Label>
            <Input
              type="number"
              step="0.1"
              className="h-8 text-xs"
              placeholder="20"
              value={newFundAlloc}
              onChange={(e) => setNewFundAlloc(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Farge</Label>
            <input
              type="color"
              value={newFundColor}
              onChange={(e) => setNewFundColor(e.target.value)}
              className="h-8 w-8 rounded border border-border cursor-pointer"
            />
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleAddFund}
            disabled={!newFundName.trim() || !newFundAlloc}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Legg til
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave}>
            Lagre endringer
          </Button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

export function FondPage() {
  const { fondPortfolio, setFondPortfolio, addFondSnapshot, removeFondSnapshot } = useEconomyStore()

  const [showSettings, setShowSettings] = useState(false)
  const now = useRef(new Date()).current

  const months = monthsBetween(fondPortfolio.startDate, now)
  const investert = fondPortfolio.monthlyDeposit * months

  const sortedSnapshots = [...fondPortfolio.snapshots].sort((a, b) => b.date.localeCompare(a.date))
  const latestSnapshot = sortedSnapshots[0] ?? null
  const naverdi = latestSnapshot ? latestSnapshot.totalValue : investert
  const avkastning = naverdi - investert
  const avkastningPct = investert > 0 ? (avkastning / investert) * 100 : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Animated ticker */}
      {fondPortfolio.funds.length > 0 && <Ticker funds={fondPortfolio.funds} />}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">KRON-portefølje</h2>
            <p className="text-xs text-muted-foreground">
              {fondPortfolio.monthlyDeposit.toLocaleString('no-NO')} kr/mnd · startet{' '}
              {fmtDate(fondPortfolio.startDate)} · {months} mnd
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Innstillinger
            {showSettings ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="Investert"
            value={fmtNOK(investert)}
            subvalue={`${months} mnd × ${fondPortfolio.monthlyDeposit.toLocaleString('no-NO')} kr`}
            highlight="neutral"
          />
          <SummaryCard
            label="Nåverdi"
            value={fmtNOK(naverdi)}
            subvalue={latestSnapshot ? `per ${fmtDate(latestSnapshot.date)}` : 'Ingen måling ennå'}
            highlight="neutral"
          />
          <SummaryCard
            label="Avkastning"
            value={`${avkastning >= 0 ? '+' : ''}${fmtNOK(avkastning)}`}
            subvalue={`${avkastningPct >= 0 ? '+' : ''}${avkastningPct.toFixed(1)}%`}
            highlight={avkastning > 0 ? 'positive' : avkastning < 0 ? 'negative' : 'neutral'}
          />
        </div>

        {/* Development chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Utvikling</CardTitle>
          </CardHeader>
          <CardContent>
            <DevelopmentChart portfolio={fondPortfolio} now={now} />
          </CardContent>
        </Card>

        {/* Allocation donut + fund list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fordeling</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationSection
              portfolio={fondPortfolio}
              latestValue={latestSnapshot?.totalValue ?? null}
            />
          </CardContent>
        </Card>

        {/* Snapshot section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Logg KRON-verdi</CardTitle>
          </CardHeader>
          <CardContent>
            <SnapshotSection
              portfolio={fondPortfolio}
              onAdd={addFondSnapshot}
              onRemove={removeFondSnapshot}
            />
          </CardContent>
        </Card>

        {/* Portfolio settings (collapsible) */}
        {showSettings && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Porteføljeinnstillinger</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioSettings
                portfolio={fondPortfolio}
                onUpdate={(p) => {
                  setFondPortfolio(p)
                  setShowSettings(false)
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
