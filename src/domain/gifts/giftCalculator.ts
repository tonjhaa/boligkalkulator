import type {
  GiftEvent, GiftRecipient, GiftSettings, WeightRules,
  EventShare, MonthlyBreakdown, GiftCalculationResult,
} from '@/types/gifts'
import { getMilestoneWeight } from './defaultWeights'

// ── Hjelpere ──────────────────────────────────────────────────

export function getEventMonth(event: GiftEvent): number | null {
  if (event.date) {
    const m = parseInt(event.date.split('-')[1], 10)
    if (!isNaN(m) && m >= 1 && m <= 12) return m
  }
  if (event.month && event.month >= 1 && event.month <= 12) return event.month
  return null
}

export function roundGiftAmount(amount: number, nearest: 50 | 100): number {
  return Math.round(amount / nearest) * nearest
}

function recipientAge(recipient: GiftRecipient): number | undefined {
  const currentYear = new Date().getFullYear()
  if (recipient.birthYear) return currentYear - recipient.birthYear
  if (recipient.birthDate) {
    const yr = parseInt(recipient.birthDate.split('-')[0], 10)
    if (!isNaN(yr)) return currentYear - yr
  }
  return undefined
}

// ── Kjernekalkulator ───────────────────────────────────────────

/**
 * Beregner gavebeløp basert på formelen:
 * C = B_O × W_R × W_N × W_A × W_J
 */
export function calculateGiftAmount(
  event: GiftEvent,
  recipient: GiftRecipient,
  weights: WeightRules,
): number {
  const base = weights.occasionBaseAmounts[event.occasion] ?? 400
  const wR = weights.relationshipWeights[recipient.relationshipType] ?? 1.0
  const wN = weights.closenessWeights[recipient.closeness] ?? 1.0
  const wA = weights.lifePhaseWeights[recipient.lifePhase] ?? 1.0
  const age = recipientAge(recipient)
  const wJ = getMilestoneWeight(event.occasion, age)

  return base * wR * wN * wA * wJ
}

/** Returnerer en forklarende tekst for beregnet beløp */
export function giftAmountExplanation(
  event: GiftEvent,
  recipient: GiftRecipient,
  weights: WeightRules,
): string {
  const base = weights.occasionBaseAmounts[event.occasion] ?? 400
  const wR = weights.relationshipWeights[recipient.relationshipType] ?? 1.0
  const wN = weights.closenessWeights[recipient.closeness] ?? 1.0
  const wA = weights.lifePhaseWeights[recipient.lifePhase] ?? 1.0
  const age = recipientAge(recipient)
  const wJ = getMilestoneWeight(event.occasion, age)
  const factors = [base, wR, wN, wA, wJ].filter(f => f !== 1.0 || true)
  return `${base} kr × ${wR} (relasjon) × ${wN} (nærhet) × ${wA} (livsfase) × ${wJ} (milepæl)`
}

// ── Inntektsandeler ────────────────────────────────────────────

export interface IncomeShares {
  pA: number  // andel 0–1
  pB: number
  totalIncome: number
  fallback50_50: boolean
}

export function calculateIncomeShares(settings: GiftSettings): IncomeShares {
  const nA = settings.memberA.monthlyNetIncome
  const nB = settings.memberB.monthlyNetIncome
  const total = nA + nB
  if (total === 0) {
    return { pA: 0.5, pB: 0.5, totalIncome: 0, fallback50_50: true }
  }
  return { pA: nA / total, pB: nB / total, totalIncome: total, fallback50_50: false }
}

// ── Fordeling per hendelse ─────────────────────────────────────

/**
 * Beregner Person A og Person B sin andel av en gavehendelse.
 */
export function calculateEventShare(
  event: GiftEvent,
  amount: number,
  settings: GiftSettings,
  incomeShares: IncomeShares,
): EventShare {
  const model = settings.distributionModel
  const { pA, pB } = incomeShares
  const h = settings.primaryResponsibilityShare   // 0.80
  const s = settings.supportShare                  // 0.20

  if (model === '50_50') {
    return { personA: amount * 0.5, personB: amount * 0.5 }
  }

  if (model === 'inntekt') {
    return { personA: amount * pA, personB: amount * pB }
  }

  if (model === 'eierskap') {
    if (event.ownership === 'A') return { personA: amount, personB: 0 }
    if (event.ownership === 'B') return { personA: 0, personB: amount }
    // Felles: etter inntekt
    return { personA: amount * pA, personB: amount * pB }
  }

  // Hybrid (standard)
  if (event.ownership === 'A') {
    return { personA: amount * h, personB: amount * s }
  }
  if (event.ownership === 'B') {
    return { personA: amount * s, personB: amount * h }
  }
  // Felles: etter inntekt
  return { personA: amount * pA, personB: amount * pB }
}

// ── Normalisering mot tak ──────────────────────────────────────

/**
 * Tar inn beregnede gavebeløp og normaliserer mot annualCap.
 * Låste hendelser holdes utenfor nedskalering.
 */
export function calculateNormalizedAmounts(
  events: GiftEvent[],
  recipients: GiftRecipient[],
  settings: GiftSettings,
  weights: WeightRules,
): GiftEvent[] {
  // Beregn råbeløp for alle hendelser
  const recipientMap = new Map(recipients.map((r) => [r.id, r]))

  const eventsWithAmounts = events.map((event) => {
    if (event.manualAmount !== undefined) {
      return { ...event, calculatedAmount: event.manualAmount }
    }
    const recipient = recipientMap.get(event.recipientId)
    if (!recipient) return { ...event, calculatedAmount: 0 }
    const raw = calculateGiftAmount(event, recipient, weights)
    const rounded = roundGiftAmount(raw, settings.roundingNearest)
    return { ...event, calculatedAmount: rounded }
  })

  if (!settings.annualCap) return eventsWithAmounts

  const cap = settings.annualCap
  const lockedTotal = eventsWithAmounts
    .filter((e) => e.isLocked)
    .reduce((s, e) => s + e.calculatedAmount, 0)

  if (lockedTotal >= cap) {
    // Låste hendelser overskrider allerede taket — returner som-er med advarsel
    return eventsWithAmounts
  }

  const remainingCap = cap - lockedTotal
  const unlocked = eventsWithAmounts.filter((e) => !e.isLocked)
  const unlockedTotal = unlocked.reduce((s, e) => s + e.calculatedAmount, 0)

  if (unlockedTotal <= remainingCap) return eventsWithAmounts

  const scaleFactor = remainingCap / unlockedTotal

  return eventsWithAmounts.map((event) => {
    if (event.isLocked || event.manualAmount !== undefined) return event
    return {
      ...event,
      calculatedAmount: roundGiftAmount(event.calculatedAmount * scaleFactor, settings.roundingNearest),
    }
  })
}

// ── Månedlig fordeling ─────────────────────────────────────────

export function calculateMonthlyBreakdown(
  events: GiftEvent[],
  settings: GiftSettings,
): MonthlyBreakdown[] {
  const incomeShares = calculateIncomeShares(settings)
  const activeEvents = events.filter((e) => e.status !== 'droppet')

  const totalAnnual = activeEvents.reduce((s, e) => {
    const amt = e.manualAmount ?? e.calculatedAmount
    return s + amt
  }, 0)
  const avg = totalAnnual / 12

  const months: MonthlyBreakdown[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    totalCost: 0,
    personAShare: 0,
    personBShare: 0,
    events: [],
    isHeavy: false,
  }))

  for (const event of activeEvents) {
    const m = getEventMonth(event)
    if (m === null) continue
    const idx = m - 1
    const amount = event.manualAmount ?? event.calculatedAmount
    const share = calculateEventShare(event, amount, settings, incomeShares)
    months[idx].totalCost += amount
    months[idx].personAShare += share.personA
    months[idx].personBShare += share.personB
    months[idx].events.push(event)
  }

  // Marker tunge måneder (mer enn 1.5x gjennomsnittet)
  const threshold = avg * 1.5
  for (const m of months) {
    m.isHeavy = m.totalCost > threshold && m.totalCost > 0
  }

  return months
}

// ── Hovedberegning ─────────────────────────────────────────────

export function calculateGiftResult(
  events: GiftEvent[],
  settings: GiftSettings,
): GiftCalculationResult {
  const incomeShares = calculateIncomeShares(settings)
  const activeEvents = events.filter((e) => e.status !== 'droppet')

  let personATotal = 0
  let personBTotal = 0

  for (const event of activeEvents) {
    const amount = event.manualAmount ?? event.calculatedAmount
    const share = calculateEventShare(event, amount, settings, incomeShares)
    personATotal += share.personA
    personBTotal += share.personB
  }

  const annualTotal = personATotal + personBTotal
  const bufferFactor = 1 + settings.bufferPercent / 100
  const annualTotalWithBuffer = annualTotal * bufferFactor
  const personATotalWithBuffer = personATotal * bufferFactor
  const personBTotalWithBuffer = personBTotal * bufferFactor

  const monthlyBreakdown = calculateMonthlyBreakdown(events, settings)

  const warnings: string[] = []
  const insights: string[] = []

  // Cap-advarsel
  if (settings.annualCap && annualTotal > settings.annualCap) {
    warnings.push(
      `Planlagt gavebudsjett (${Math.round(annualTotal).toLocaleString('no-NO')} kr) overstiger maksrammen på ${Math.round(settings.annualCap).toLocaleString('no-NO')} kr.`
    )
  }

  // Fallback-advarsel
  if (incomeShares.fallback50_50) {
    insights.push('Nettoinntekt ikke lagt inn — benytter 50/50 fordeling.')
  }

  // Tunge måneder
  const heavyMonths = monthlyBreakdown.filter((m) => m.isHeavy)
  if (heavyMonths.length > 0) {
    const names = heavyMonths.map((m) => MONTH_NO[m.month - 1])
    insights.push(`${names.join(', ')} er gaveintensive måneder med over 1,5× gjennomsnittsbelastning.`)
  }

  // Neste 30 dager
  const today = new Date()
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcoming = activeEvents.filter((e) => {
    if (!e.date) return false
    const d = new Date(e.date)
    return d >= today && d <= in30Days
  })
  if (upcoming.length > 0) {
    const sum = upcoming.reduce((s, e) => s + (e.manualAmount ?? e.calculatedAmount), 0)
    insights.push(`Neste 30 dager: ${upcoming.length} planlagte gaver for totalt ${Math.round(sum).toLocaleString('no-NO')} kr.`)
  }

  // Familiebelastning
  const aEvents = activeEvents.filter((e) => e.ownership === 'A').length
  const bEvents = activeEvents.filter((e) => e.ownership === 'B').length
  if (aEvents > bEvents * 1.5 && bEvents > 0) {
    insights.push(`${settings.memberA.name} har vesentlig flere familiehendelser enn ${settings.memberB.name} (${aEvents} vs ${bEvents}).`)
  } else if (bEvents > aEvents * 1.5 && aEvents > 0) {
    insights.push(`${settings.memberB.name} har vesentlig flere familiehendelser enn ${settings.memberA.name} (${bEvents} vs ${aEvents}).`)
  }

  return {
    annualTotal,
    annualTotalWithBuffer,
    personATotal: personATotalWithBuffer,
    personBTotal: personBTotalWithBuffer,
    personAMonthlySaving: personATotalWithBuffer / 12,
    personBMonthlySaving: personBTotalWithBuffer / 12,
    monthlyBreakdown,
    warnings,
    insights,
  }
}

/** Beregner faktisk vs planlagt avvik */
export function calculateActualVsPlanned(events: GiftEvent[]): {
  planned: number
  actual: number
  deviation: number
} {
  const purchased = events.filter((e) => e.status === 'kjøpt')
  const planned = purchased.reduce((s, e) => s + (e.manualAmount ?? e.calculatedAmount), 0)
  const actual = purchased.reduce((s, e) => s + (e.actualAmount ?? 0), 0)
  return { planned, actual, deviation: actual - planned }
}

const MONTH_NO = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
export { MONTH_NO }
