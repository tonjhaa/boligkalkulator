import { useState, useMemo } from 'react'
import { Map, TrendingUp, PiggyBank, Users, RefreshCw, CheckCircle2, XCircle, Info, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEconomyStore } from '@/application/useEconomyStore'
import {
  calcMaxPurchase, monthlyPayment,
  BSU_MAX_YEARLY, BSU_MAX_TOTAL, BSU_TAX_BENEFIT, EK_KRAV, MAX_GJELDSGRAD,
} from '@/hooks/useVeikart'
import { cn } from '@/lib/utils'

const CURRENT_RATE = 0.0425
const STRESS_RATE = Math.max(0.07, CURRENT_RATE + 0.03)

function fmtNOK(n: number, short = false): string {
  if (short) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mill`
    if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)} k`
    return String(Math.round(n))
  }
  return Math.round(n).toLocaleString('no-NO') + ' kr'
}

function fmtMonths(m: number): string {
  if (m === 0) return 'Nå'
  if (m < 12) return `${m} mnd`
  const y = Math.floor(m / 12)
  const mo = m % 12
  if (mo === 0) return `${y} år`
  return `${y}y ${mo}m`
}

function calcKjøpekraft(
  equity: number, bsu: number, fond: number,
  annualIncome: number, existingDebt: number,
  monthlySavings: number, // total ikke-BSU sparing per mnd (begge parter)
  monthlyBSU: number,     // BSU-innskudd per mnd
  month: number,
): number {
  const futureEquity = equity + monthlySavings * month
  const futureBsu = Math.min(BSU_MAX_TOTAL, bsu + monthlyBSU * month)
  return calcMaxPurchase(futureEquity + futureBsu + fond, annualIncome, existingDebt)
}

function findKlarMonth(
  equity: number, bsu: number, fond: number,
  annualIncome: number, existingDebt: number,
  monthlySavings: number, monthlyBSU: number, malPris: number,
): number | null {
  if (malPris <= 0) return null
  for (let m = 0; m <= 120; m++) {
    if (calcKjøpekraft(equity, bsu, fond, annualIncome, existingDebt, monthlySavings, monthlyBSU, m) >= malPris) {
      return m
    }
  }
  return null
}

// ── SVG Chart ────────────────────────────────────────────────
function KjøpekraftChart({
  points,
  klarMonth,
  malPris,
}: {
  points: { month: number; maxBuy: number }[]
  klarMonth: number | null
  malPris: number
}) {
  const W = 560, H = 170
  const pad = { top: 16, right: 20, bottom: 30, left: 52 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const rawMax = Math.max(...points.map(p => p.maxBuy), malPris || 0)
  const maxVal = rawMax > 0 ? rawMax * 1.12 : 10_000_000

  function xOf(month: number) { return pad.left + (month / 72) * innerW }
  function yOf(val: number) { return pad.top + (1 - val / maxVal) * innerH }

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.month).toFixed(1)},${yOf(p.maxBuy).toFixed(1)}`)
    .join(' ')

  const goalY = malPris > 0 ? yOf(malPris) : null
  const klarX = klarMonth !== null ? xOf(klarMonth) : null
  const klarY = klarMonth !== null ? yOf(points[Math.min(klarMonth, points.length - 1)].maxBuy) : null

  // Y ticks: 0, 25%, 50%, 75%, 100%
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    val: pct * maxVal,
    y: yOf(pct * maxVal),
  }))

  // X ticks: every year
  const xTicks = [0, 12, 24, 36, 48, 60, 72].map(m => ({
    month: m, x: xOf(m),
    label: m === 0 ? 'Nå' : `År ${m / 12}`,
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 130 }}>
      <defs>
        <linearGradient id="kp-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yTicks.map((t, i) => (
        <line key={i} x1={pad.left} y1={t.y} x2={W - pad.right} y2={t.y}
          stroke="hsl(215 20.2% 18%)" strokeWidth="0.5" />
      ))}

      {/* Area */}
      <path
        d={`${linePath} L${xOf(72).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${xOf(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`}
        fill="url(#kp-grad)"
      />

      {/* Goal line */}
      {goalY !== null && goalY >= pad.top && goalY <= pad.top + innerH && (
        <>
          <line x1={pad.left} y1={goalY} x2={W - pad.right} y2={goalY}
            stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" />
          <text x={W - pad.right + 3} y={goalY + 4} fontSize="7.5" fill="#f59e0b" fontWeight="600">Mål</text>
        </>
      )}

      {/* Main curve */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* KLAR point */}
      {klarX !== null && klarY !== null && (
        <g>
          <line x1={klarX} y1={klarY} x2={klarX} y2={pad.top + innerH}
            stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
          <circle cx={klarX} cy={klarY} r="6" fill="#22c55e" opacity="0.2" />
          <circle cx={klarX} cy={klarY} r="3.5" fill="#22c55e" />
          <text x={klarX} y={klarY - 9} textAnchor="middle" fontSize="8" fill="#22c55e" fontWeight="700">KLAR</text>
        </g>
      )}

      {/* Y axis labels */}
      {yTicks.filter((_, i) => i > 0).map((t, i) => (
        <text key={i} x={pad.left - 3} y={t.y + 3} textAnchor="end" fontSize="7" fill="hsl(215 20.2% 48%)">
          {t.val >= 1_000_000 ? `${(t.val / 1_000_000).toFixed(1)}M` : `${Math.round(t.val / 1000)}k`}
        </text>
      ))}

      {/* X axis labels */}
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={H - 4} textAnchor="middle" fontSize="7" fill="hsl(215 20.2% 48%)">{t.label}</text>
      ))}

      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH}
        stroke="hsl(215 20.2% 28%)" strokeWidth="0.5" />
      <line x1={pad.left} y1={pad.top + innerH} x2={W - pad.right} y2={pad.top + innerH}
        stroke="hsl(215 20.2% 28%)" strokeWidth="0.5" />
    </svg>
  )
}

// ── Scenario kort ─────────────────────────────────────────────
function ScenarioCard({
  label, maxBuy, equity, bsu, malPris, isNow,
}: {
  label: string; maxBuy: number
  equity: number; bsu: number; malPris: number; isNow: boolean
}) {
  const loan = Math.max(0, maxBuy - equity - bsu)
  const payment = loan > 0 ? monthlyPayment(loan, STRESS_RATE, 25) : 0
  const goalReached = malPris > 0 && maxBuy >= malPris

  return (
    <div className={cn(
      'rounded-xl border p-3.5 space-y-2 flex flex-col',
      isNow ? 'border-green-500/40 bg-green-500/5' : 'border-border/50 bg-card/60',
      goalReached && !isNow && 'border-blue-500/30 bg-blue-500/5',
    )}>
      <div className="flex items-center justify-between gap-1">
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          isNow ? 'text-green-400' : 'text-muted-foreground',
        )}>
          {label}
        </span>
        {goalReached && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30 leading-none shrink-0">
            ✓ Mål
          </span>
        )}
        {isNow && !goalReached && (
          <span className="text-[9px] border border-green-500/30 text-green-400 rounded px-1.5 py-0.5 leading-none">Nå</span>
        )}
      </div>

      <div>
        <p className={cn(
          'text-lg font-bold font-mono tabular-nums leading-none',
          isNow ? 'text-green-500' : goalReached ? 'text-blue-400' : 'text-foreground',
        )}>
          {fmtNOK(maxBuy, true)}
        </p>
        <p className="text-[9px] text-muted-foreground mt-0.5">Maks kjøpspris</p>
      </div>

      <div className="border-t border-border/30 pt-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">EK</span>
          <span className="font-mono">{fmtNOK(equity + bsu, true)}</span>
        </div>
        {payment > 0 && (
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Terminbeløp</span>
            <span className="font-mono text-amber-400">{fmtNOK(payment, true)}/mnd</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stacked EK Chart ──────────────────────────────────────────
function SparePlanChart({
  data, ekKrav, partnerEnabled,
}: {
  data: Array<{ month: number; s1: number; s2: number; s3: number; s4: number; total: number }>
  ekKrav: number  // EK-mål (10% av målpris), 0 = ikke satt
  partnerEnabled: boolean
}) {
  const W = 560, H = 160
  const pad = { top: 12, right: 20, bottom: 28, left: 52 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const maxVal = Math.max(...data.map(d => d.total), ekKrav > 0 ? ekKrav * 1.1 : 0) * 1.12 || 2_000_000

  function xOf(m: number) { return pad.left + (m / 72) * innerW }
  function yOf(v: number) { return pad.top + (1 - Math.min(v / maxVal, 1.05)) * innerH }

  function stackedArea(topFn: (d: typeof data[0]) => number, botFn: (d: typeof data[0]) => number) {
    const fwd = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(d.month).toFixed(1)},${yOf(topFn(d)).toFixed(1)}`).join(' ')
    const bwd = [...data].reverse().map(d => `L${xOf(d.month).toFixed(1)},${yOf(botFn(d)).toFixed(1)}`).join(' ')
    return `${fwd} ${bwd} Z`
  }

  const goalY = ekKrav > 0 ? yOf(ekKrav) : null
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({ val: pct * maxVal, y: yOf(pct * maxVal) }))
  const xTicks = [0, 12, 24, 36, 48, 60, 72]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 120 }}>
      {yTicks.map((t, i) => (
        <line key={i} x1={pad.left} y1={t.y} x2={W - pad.right} y2={t.y}
          stroke="hsl(215 20.2% 18%)" strokeWidth="0.5" />
      ))}

      {/* Stacked areas */}
      <path d={stackedArea(d => d.s1, _ => 0)} fill="#3b82f6" opacity="0.4" />
      <path d={stackedArea(d => d.s2, d => d.s1)} fill="#8b5cf6" opacity="0.4" />
      <path d={stackedArea(d => d.s3, d => d.s2)} fill="#14b8a6" opacity="0.4" />
      {partnerEnabled && (
        <path d={stackedArea(d => d.s4, d => d.s3)} fill="#f59e0b" opacity="0.4" />
      )}

      {/* EK-krav linje */}
      {goalY !== null && goalY >= pad.top && goalY <= pad.top + innerH && (
        <>
          <line x1={pad.left} y1={goalY} x2={W - pad.right} y2={goalY}
            stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5 3" />
          <text x={W - pad.right + 3} y={goalY + 4} fontSize="7.5" fill="#22c55e" fontWeight="600">EK</text>
        </>
      )}

      {yTicks.filter((_, i) => i > 0).map((t, i) => (
        <text key={i} x={pad.left - 3} y={t.y + 3} textAnchor="end" fontSize="7" fill="hsl(215 20.2% 48%)">
          {t.val >= 1_000_000 ? `${(t.val / 1_000_000).toFixed(1)}M` : `${Math.round(t.val / 1000)}k`}
        </text>
      ))}
      {xTicks.map((m, i) => (
        <text key={i} x={xOf(m)} y={H - 4} textAnchor="middle" fontSize="7" fill="hsl(215 20.2% 48%)">
          {m === 0 ? 'Nå' : `År ${m / 12}`}
        </text>
      ))}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH}
        stroke="hsl(215 20.2% 28%)" strokeWidth="0.5" />
      <line x1={pad.left} y1={pad.top + innerH} x2={W - pad.right} y2={pad.top + innerH}
        stroke="hsl(215 20.2% 28%)" strokeWidth="0.5" />
    </svg>
  )
}

// ── Hoved ─────────────────────────────────────────────────────
export function VeikartPage() {
  const { savingsAccounts, fondPortfolio, debts, profile } = useEconomyStore()

  // ── Defaults fra store ────────────────────────────────────
  const storeEquity = useMemo(() => savingsAccounts
    .filter(a => a.type === 'sparekonto')
    .reduce((s, a) => {
      const sorted = [...a.balanceHistory].sort((x, y) => x.year !== y.year ? y.year - x.year : y.month - x.month)
      return s + (sorted[0]?.balance ?? a.openingBalance)
    }, 0), [savingsAccounts])

  const storeBsu = useMemo(() => savingsAccounts
    .filter(a => a.type === 'BSU')
    .reduce((s, a) => {
      const sorted = [...a.balanceHistory].sort((x, y) => x.year !== y.year ? y.year - x.year : y.month - x.month)
      return s + (sorted[0]?.balance ?? a.openingBalance)
    }, 0), [savingsAccounts])

  const storeFond = useMemo(() => {
    const snaps = [...(fondPortfolio?.snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    return snaps[0]?.totalValue ?? 0
  }, [fondPortfolio])

  const storeArslonn = (profile?.baseMonthly ?? 0) * 12 +
    (profile?.fixedAdditions.reduce((s, a) => s + a.amount, 0) ?? 0) * 12

  const storeDebt = debts.reduce((s, d) => s + d.currentBalance, 0)

  // Ikke-BSU månedlig sparing (sparekonto + fond)
  const storeMndSparing = savingsAccounts
    .filter(a => a.type !== 'BSU')
    .reduce((s, a) => s + (a.monthlyContribution ?? 0), 0)
    + (fondPortfolio?.monthlyDeposit ?? 0)

  // Årlig BSU-innskudd
  const storeArligBSU = savingsAccounts
    .filter(a => a.type === 'BSU')
    .reduce((s, a) => s + (a.monthlyContribution ?? 0), 0) * 12

  const storeAlder = 0

  // ── Lokale inputs ─────────────────────────────────────────
  const [arslonn, setArslonn] = useState(() => storeArslonn > 0 ? String(Math.round(storeArslonn)) : '')
  const [partnerEnabled, setPartnerEnabled] = useState(false)
  const [partnerArslonn, setPartnerArslonn] = useState('')
  const [partnerEK, setPartnerEK] = useState('')
  const [sparekonto, setSparekonto] = useState(() => storeEquity > 0 ? String(Math.round(storeEquity)) : '')
  const [fond, setFond] = useState(() => storeFond > 0 ? String(Math.round(storeFond)) : '')
  const [bsu, setBsu] = useState(() => storeBsu > 0 ? String(Math.round(storeBsu)) : '')
  const [alder, setAlder] = useState(() => storeAlder > 0 ? String(storeAlder) : '')
  const [mndSparing, setMndSparing] = useState(() => storeMndSparing > 0 ? String(Math.round(storeMndSparing)) : '')
  const [partnerMndSparing, setPartnerMndSparing] = useState('')
  const [arligBSU, setArligBSU] = useState(() => storeArligBSU > 0 ? String(Math.round(storeArligBSU)) : '')
  const [malPrisInput, setMalPrisInput] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  function hentFraSparefanen() {
    setArslonn(storeArslonn > 0 ? String(Math.round(storeArslonn)) : '')
    setSparekonto(storeEquity > 0 ? String(Math.round(storeEquity)) : '')
    setFond(storeFond > 0 ? String(Math.round(storeFond)) : '')
    setBsu(storeBsu > 0 ? String(Math.round(storeBsu)) : '')
    setMndSparing(storeMndSparing > 0 ? String(Math.round(storeMndSparing)) : '')
    setArligBSU(storeArligBSU > 0 ? String(Math.round(storeArligBSU)) : '')
    if (storeAlder > 0) setAlder(String(storeAlder))
    // Nullstill partner-feltene siden sparefanen ikke har partnerdata
    setPartnerEnabled(false)
    setPartnerArslonn('')
    setPartnerEK('')
    setPartnerMndSparing('')
  }

  // ── Beregning ─────────────────────────────────────────────
  const inputs = useMemo(() => {
    const eq = (parseFloat(sparekonto) || 0) + (partnerEnabled ? (parseFloat(partnerEK) || 0) : 0)
    const bsuVal = parseFloat(bsu) || 0
    const fondVal = parseFloat(fond) || 0
    const income = (parseFloat(arslonn) || 0) + (partnerEnabled ? (parseFloat(partnerArslonn) || 0) : 0)
    const debt = storeDebt
    // Total ikke-BSU månedlig sparing (begge parter)
    const savings = (parseFloat(mndSparing) || 0) + (partnerEnabled ? (parseFloat(partnerMndSparing) || 0) : 0)
    // BSU-innskudd per måned (maks BSU_MAX_YEARLY)
    const bsuMonthly = Math.min(BSU_MAX_YEARLY, parseFloat(arligBSU) || 0) / 12
    const mal = parseFloat(malPrisInput.replace(/\s/g, '').replace(/,/g, '')) || 0
    const age = parseInt(alder) || 0
    const bsuCanSave = age === 0 || age <= 33
    return { eq, bsuVal, fondVal, income, debt, savings, bsuMonthly, mal, age, bsuCanSave }
  }, [arslonn, partnerEnabled, partnerArslonn, partnerEK, sparekonto, fond, bsu, mndSparing, partnerMndSparing, arligBSU, malPrisInput, alder, storeDebt])

  const chartPoints = useMemo(() => {
    return Array.from({ length: 73 }, (_, m) => ({
      month: m,
      maxBuy: calcKjøpekraft(inputs.eq, inputs.bsuVal, inputs.fondVal, inputs.income, inputs.debt, inputs.savings, inputs.bsuMonthly, m),
    }))
  }, [inputs])

  const klarMonth = useMemo(() =>
    findKlarMonth(inputs.eq, inputs.bsuVal, inputs.fondVal, inputs.income, inputs.debt, inputs.savings, inputs.bsuMonthly, inputs.mal),
    [inputs])

  const totalEquity = inputs.eq + inputs.bsuVal + inputs.fondVal

  // Stacked EK plan per kontogruppe over tid
  const sparePlanData = useMemo(() => {
    const spKonto = parseFloat(sparekonto) || 0
    const mndSpar = parseFloat(mndSparing) || 0
    const pEK = partnerEnabled ? (parseFloat(partnerEK) || 0) : 0
    const pMnd = partnerEnabled ? (parseFloat(partnerMndSparing) || 0) : 0
    return Array.from({ length: 73 }, (_, m) => {
      const bsu = Math.min(BSU_MAX_TOTAL, inputs.bsuVal + inputs.bsuMonthly * m)
      const fond = inputs.fondVal
      const din = spKonto + mndSpar * m
      const partner = pEK + pMnd * m
      const s1 = bsu
      const s2 = s1 + fond
      const s3 = s2 + din
      const s4 = s3 + partner
      return { month: m, s1, s2, s3, s4, total: s4 }
    })
  }, [inputs, sparekonto, mndSparing, partnerEnabled, partnerEK, partnerMndSparing])

  // Scenario-kort: nå, 6 mnd, 1 år, 2 år, 3 år
  const scenarioMonths = [0, 6, 12, 24, 36]
  const scenarios = scenarioMonths.map(m => {
    const pt = chartPoints[m]
    const futureEquity = inputs.eq + inputs.savings * m
    const futureBsu = Math.min(BSU_MAX_TOTAL, inputs.bsuVal + inputs.bsuMonthly * m)
    return {
      label: m === 0 ? 'Nå' : m < 12 ? `${m} mnd` : `${m / 12} år`,
      months: m,
      maxBuy: pt?.maxBuy ?? 0,
      equity: futureEquity,
      bsu: futureBsu,
    }
  })

  // "Raskere" metrics (bare hvis mål er satt og vi ikke er klar ennå)
  const raskere = useMemo(() => {
    if (inputs.mal <= 0 || klarMonth === 0) return []
    const items: { label: string; desc: string; gain: number | null }[] = []

    const with5kSavings = findKlarMonth(inputs.eq, inputs.bsuVal, inputs.fondVal, inputs.income, inputs.debt, inputs.savings + 5000, inputs.bsuMonthly, inputs.mal)
    if (klarMonth !== null && with5kSavings !== null) {
      items.push({ label: '+5 000 kr/mnd sparing', desc: `${fmtMonths(klarMonth - with5kSavings)} raskere`, gain: klarMonth - with5kSavings })
    } else if (klarMonth === null && with5kSavings !== null) {
      items.push({ label: '+5 000 kr/mnd sparing', desc: `Når målet om ${fmtMonths(with5kSavings)}`, gain: null })
    }

    const with10kIncome = findKlarMonth(inputs.eq, inputs.bsuVal, inputs.fondVal, inputs.income + 10000 * 12, inputs.debt, inputs.savings, inputs.bsuMonthly, inputs.mal)
    if (klarMonth !== null && with10kIncome !== null) {
      items.push({ label: '+10 000 kr/mnd brutto', desc: `${fmtMonths(klarMonth - with10kIncome)} raskere`, gain: klarMonth - with10kIncome })
    }

    if (inputs.debt > 100_000) {
      const withLessDebt = findKlarMonth(inputs.eq, inputs.bsuVal, inputs.fondVal, inputs.income, Math.max(0, inputs.debt - 100_000), inputs.savings, inputs.bsuMonthly, inputs.mal)
      if (klarMonth !== null && withLessDebt !== null) {
        items.push({ label: 'Nedbetal 100k gjeld', desc: `${fmtMonths(klarMonth - withLessDebt)} raskere`, gain: klarMonth - withLessDebt })
      }
    }

    if (inputs.bsuCanSave && inputs.bsuVal < BSU_MAX_TOTAL) {
      const bsuYearly = Math.min(BSU_MAX_YEARLY, BSU_MAX_TOTAL - inputs.bsuVal)
      const taxSaving = bsuYearly * BSU_TAX_BENEFIT
      if (taxSaving > 0) {
        items.push({ label: 'Maks BSU-innskudd', desc: `${fmtNOK(taxSaving, true)} i skattefradrag/år`, gain: null })
      }
    }

    return items.slice(0, 4)
  }, [inputs, klarMonth])

  // "Bremsen" sjekkliste
  const bremsene = useMemo(() => [
    {
      label: `Egenkapital ≥ ${(EK_KRAV * 100).toFixed(0)}% av mål`,
      ok: inputs.mal > 0 ? totalEquity >= inputs.mal * EK_KRAV : totalEquity > 0,
      detail: inputs.mal > 0
        ? `${fmtNOK(totalEquity, true)} av ${fmtNOK(inputs.mal * EK_KRAV, true)} krav`
        : totalEquity > 0 ? `${fmtNOK(totalEquity, true)}` : 'Sett inn mål-pris',
    },
    {
      label: `Gjeldsgrad under ${MAX_GJELDSGRAD}× inntekt`,
      ok: inputs.income <= 0 || inputs.debt <= inputs.income * MAX_GJELDSGRAD,
      detail: inputs.income > 0
        ? `${(inputs.debt / Math.max(inputs.income, 1)).toFixed(1)}× inntekt`
        : 'Ingen inntektsdata',
    },
    {
      label: 'Aktiv månedlig sparing',
      ok: inputs.savings >= 500,
      detail: inputs.savings > 0 ? `${fmtNOK(inputs.savings, true)}/mnd` : 'Ingen sparing registrert',
    },
    {
      label: 'BSU-mulighet utnyttet',
      ok: !inputs.bsuCanSave || inputs.bsuVal >= BSU_MAX_TOTAL,
      detail: inputs.bsuVal < BSU_MAX_TOTAL && inputs.bsuCanSave
        ? `${fmtNOK(BSU_MAX_TOTAL - inputs.bsuVal, true)} igjen til tak`
        : inputs.bsuVal >= BSU_MAX_TOTAL ? 'BSU fylt opp!' : 'Over 33 år',
    },
  ], [inputs, totalEquity])

  const hasData = inputs.income > 0 || totalEquity > 0 || inputs.savings > 0

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── VENSTRE — Inputs ── */}
      <div className="w-[280px] shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">

        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold">Boligveikart</h2>
        </div>

        {/* Hent fra sparefanen */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-7 gap-1.5"
          onClick={hentFraSparefanen}
        >
          <RefreshCw className="h-3 w-3" />
          Hent fra sparefanen
        </Button>

        {/* Inntekt */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inntekt</p>
          <div className="space-y-1">
            <Label className="text-[11px]">Din årslønn</Label>
            <Input
              type="number"
              value={arslonn}
              onChange={e => setArslonn(e.target.value)}
              placeholder="f.eks. 650000"
              className="h-7 text-xs"
            />
          </div>

          {/* Partner toggle */}
          <div>
            <button
              onClick={() => setPartnerEnabled(!partnerEnabled)}
              className={cn(
                'flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border w-full transition-colors',
                partnerEnabled ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Users className={cn('h-3 w-3', partnerEnabled ? 'text-primary' : '')} />
              <span>+ Partner</span>
              <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', partnerEnabled && 'rotate-180')} />
            </button>
            {partnerEnabled && (
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Partners årslønn</Label>
                  <Input
                    type="number"
                    value={partnerArslonn}
                    onChange={e => setPartnerArslonn(e.target.value)}
                    placeholder="f.eks. 550000"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Partners EK (sparekonto + BSU + fond)</Label>
                  <Input
                    type="number"
                    value={partnerEK}
                    onChange={e => setPartnerEK(e.target.value)}
                    placeholder="f.eks. 150000"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Partners mnd. sparing (eks. BSU)</Label>
                  <Input
                    type="number"
                    value={partnerMndSparing}
                    onChange={e => setPartnerMndSparing(e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Egenkapital */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Egenkapital</p>
          <div className="space-y-1">
            <Label className="text-[11px]">Sparekonto</Label>
            <Input
              type="number"
              value={sparekonto}
              onChange={e => setSparekonto(e.target.value)}
              placeholder="0"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Fond / aksjer</Label>
            <Input
              type="number"
              value={fond}
              onChange={e => setFond(e.target.value)}
              placeholder="0"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">BSU-saldo</Label>
            <Input
              type="number"
              value={bsu}
              onChange={e => setBsu(e.target.value)}
              placeholder="0"
              className="h-7 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[11px]">Alder</Label>
              <Input
                type="number"
                value={alder}
                onChange={e => setAlder(e.target.value)}
                placeholder="f.eks. 26"
                className="h-7 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-[11px]">Din mnd. sparing (eks. BSU)</Label>
              <Input
                type="number"
                value={mndSparing}
                onChange={e => setMndSparing(e.target.value)}
                placeholder="0"
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Årlig BSU-innskudd</Label>
            <Input
              type="number"
              value={arligBSU}
              onChange={e => setArligBSU(e.target.value)}
              placeholder={`maks ${BSU_MAX_YEARLY.toLocaleString('no-NO')}`}
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Mål */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Drømmeboligen</p>
          <div className="space-y-1">
            <Label className="text-[11px]">Målpris (kr)</Label>
            <Input
              type="text"
              value={malPrisInput}
              onChange={e => setMalPrisInput(e.target.value)}
              placeholder="f.eks. 4500000"
              className="h-7 text-xs"
            />
          </div>
          {inputs.mal > 0 && (
            <div className={cn(
              'rounded-lg px-3 py-2 text-center',
              klarMonth === 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-blue-500/10 border border-blue-500/20',
            )}>
              {klarMonth === 0 ? (
                <p className="text-xs font-semibold text-green-400">KLAR NÅ</p>
              ) : klarMonth !== null ? (
                <>
                  <p className="text-[10px] text-muted-foreground">Tilgjengelig om</p>
                  <p className="text-sm font-bold text-blue-400">{fmtMonths(klarMonth)}</p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">Ikke innenfor 10 år</p>
              )}
            </div>
          )}
        </div>

        {/* Regelverk toggle */}
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3 w-3" />
          {showInfo ? 'Skjul regelverk' : 'Vis regelverk (2025)'}
        </button>
        {showInfo && (
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-3 space-y-1.5 text-[11px]">
            <p className="font-medium text-muted-foreground mb-2">Boliglånsforskriften 2025</p>
            <div className="flex justify-between"><span className="text-muted-foreground">EK-krav</span><span>{(EK_KRAV * 100).toFixed(0)}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Maks gjeldsgrad</span><span>{MAX_GJELDSGRAD}× bruttoinntekt</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stresstest</span><span>+3 pp, min 7%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">BSU maks/år</span><span>{fmtNOK(BSU_MAX_YEARLY)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">BSU skattefradrag</span><span>{(BSU_TAX_BENEFIT * 100).toFixed(0)}%</span></div>
          </div>
        )}
      </div>

      {/* ── HØYRE — Chart + Cards + Metrics ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Map className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Fyll inn lønn og sparing for å se ditt boligveikart.
            </p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Kjøpekraftutvikling · 0–6 år
                  </span>
                  {inputs.mal > 0 && (
                    <span className="ml-2 text-[10px] text-amber-400">— mål: {fmtNOK(inputs.mal, true)}</span>
                  )}
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <KjøpekraftChart points={chartPoints} klarMonth={klarMonth} malPris={inputs.mal} />
            </div>

            {/* Scenario cards */}
            <div className="grid grid-cols-5 gap-2">
              {scenarios.map((s, i) => (
                <ScenarioCard
                  key={s.months}
                  label={s.label}
                  maxBuy={s.maxBuy}
                  equity={s.equity}
                  bsu={s.bsu}
                  malPris={inputs.mal}
                  isNow={i === 0}
                />
              ))}
            </div>

            {/* Spareplan – stacked EK */}
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Spareutvikling per kontogruppe
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-blue-500 opacity-70" /><span className="text-[9px] text-muted-foreground">BSU</span></div>
                  <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-violet-500 opacity-70" /><span className="text-[9px] text-muted-foreground">Fond</span></div>
                  <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-teal-500 opacity-70" /><span className="text-[9px] text-muted-foreground">Sparekonto</span></div>
                  {partnerEnabled && <div className="flex items-center gap-1"><div className="h-2 w-3 rounded-sm bg-amber-500 opacity-70" /><span className="text-[9px] text-muted-foreground">Partner</span></div>}
                  {inputs.mal > 0 && <div className="flex items-center gap-1"><div className="h-1.5 w-3 border-t-2 border-dashed border-green-500" /><span className="text-[9px] text-muted-foreground">EK-krav (10%)</span></div>}
                  <span className="text-[9px] text-muted-foreground/50 ml-1">· Fond vises som nåverdi</span>
                </div>
              </div>
              <SparePlanChart
                data={sparePlanData}
                ekKrav={inputs.mal > 0 ? inputs.mal * EK_KRAV : 0}
                partnerEnabled={partnerEnabled}
              />
              {/* Yearly milestones */}
              <div className="mt-2 grid grid-cols-6 gap-1 border-t border-border/30 pt-2">
                {[0, 12, 24, 36, 48, 60].map(m => {
                  const d = sparePlanData[m]
                  const yr = new Date().getFullYear() + Math.floor(m / 12)
                  const ekKravMet = inputs.mal > 0 && d.total >= inputs.mal * EK_KRAV
                  return (
                    <div key={m} className="text-center">
                      <p className="text-[9px] text-muted-foreground">{m === 0 ? 'Nå' : yr}</p>
                      <p className={cn('text-[11px] font-mono font-semibold', ekKravMet ? 'text-green-400' : 'text-foreground')}>
                        {fmtNOK(d.total, true)}
                      </p>
                      {inputs.mal > 0 && (
                        <p className="text-[9px] text-muted-foreground">
                          {Math.round(d.total / (inputs.mal * EK_KRAV) * 100)}%
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Hva øker kjøpekraften */}
              {raskere.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Hva øker kjøpekraften mest?
                  </p>
                  <div className="space-y-2">
                    {raskere.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] text-green-400 font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium">{item.label}</p>
                          <p className={cn(
                            'text-[10px]',
                            item.gain !== null && item.gain > 0 ? 'text-green-400' : 'text-muted-foreground',
                          )}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bremsen i dag */}
              <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Hva er bremsen i dag?
                </p>
                <div className="space-y-2">
                  {bremsene.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={cn('text-[11px] font-medium', item.ok ? 'text-foreground' : 'text-muted-foreground')}>
                          {item.label}
                        </p>
                        <p className={cn('text-[10px]', item.ok ? 'text-muted-foreground' : 'text-amber-400')}>
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Nåværende posisjon (compact) */}
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Din posisjon i dag
              </p>
              <div className="grid grid-cols-4 gap-3">
                <Metric label="Sparekonto" value={fmtNOK(inputs.eq, true)} color="text-foreground" icon={<PiggyBank className="h-3 w-3" />} />
                <Metric label="BSU" value={fmtNOK(inputs.bsuVal, true)} color="text-blue-400" />
                <Metric label="Fond" value={fmtNOK(inputs.fondVal, true)} color="text-violet-400" />
                <Metric label="Total EK" value={fmtNOK(totalEquity, true)} color="text-green-500" bold />
              </div>
              {inputs.debt > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Eksisterende gjeld (begrenser lånerammen)</span>
                  <span className="font-mono text-red-400">−{fmtNOK(inputs.debt, true)}</span>
                </div>
              )}
              {inputs.income > 0 && (
                <div className="mt-1 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Bruttoinntekt / år</span>
                  <span className="font-mono">{fmtNOK(inputs.income, true)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({
  label, value, color, icon, bold,
}: {
  label: string; value: string; color: string; icon?: React.ReactNode; bold?: boolean
}) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        {icon}{label}
      </p>
      <p className={cn('text-sm font-mono font-semibold mt-0.5', color, bold && 'text-base')}>{value}</p>
    </div>
  )
}
