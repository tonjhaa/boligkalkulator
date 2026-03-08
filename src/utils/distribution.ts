import type {
  DistributionPlan,
  DistributionRow,
  DistributionInput,
  HouseholdInput,
  LoanParametersInput,
  PropertyInput,
} from '@/types'
import { annuityPayment } from './loan'

/**
 * Fordelingsplan mellom to sokere.
 *
 * Anbefalt eierbroek basert paa:
 *  - Egenkapitalbidrag (vekt 60%)
 *  - Inntektsandel (vekt 40%)
 */

function makeRow(
  label: string,
  primaryAmount: number,
  totalAmount: number
): DistributionRow {
  const coAmount = totalAmount - primaryAmount
  const primaryPercent = totalAmount > 0 ? (primaryAmount / totalAmount) * 100 : 50
  const coPercent = 100 - primaryPercent

  return {
    label,
    primaryAmount: Math.round(primaryAmount),
    coApplicantAmount: Math.round(coAmount),
    primaryPercent: Math.round(primaryPercent * 10) / 10,
    coApplicantPercent: Math.round(coPercent * 10) / 10,
  }
}

function calcRecommendedOwnershipPercent(
  primaryEK: number,
  totalEquity: number,
  primaryGross: number,
  totalGross: number
): number {
  if (totalEquity <= 0 || totalGross <= 0) return 50
  const ekShare = primaryEK / totalEquity
  const incomeShare = primaryGross / totalGross
  const weighted = ekShare * 0.6 + incomeShare * 0.4
  return Math.round(weighted * 100)
}

/**
 * Genererer konkrete notater om fordelingen, inkl. 50/50-analyse.
 */
function buildNotes(
  primaryLabel: string,
  coLabel: string,
  primaryEK: number,
  coEK: number,
  primaryGross: number,
  coGross: number,
  primaryOwnershipPct: number,
  totalMonthlyPayment: number,
  loanAmount: number
): string[] {
  const notes: string[] = []
  const totalEK = primaryEK + coEK
  const totalGross = primaryGross + coGross
  const coOwnershipPct = 100 - primaryOwnershipPct

  // Konkret grunnlag for anbefaling
  const ekShare1 = totalEK > 0 ? Math.round((primaryEK / totalEK) * 100) : 50
  const incomeShare1 = totalGross > 0 ? Math.round((primaryGross / totalGross) * 100) : 50
  notes.push(
    `Anbefaling: ${primaryOwnershipPct}/${coOwnershipPct} — basert paa at ` +
    `${primaryLabel} bidrar ${ekShare1}% av EK og ${incomeShare1}% av inntekten ` +
    `(EK vektes 60%, inntekt 40%).`
  )

  // 50/50-analyse
  const fiftyFiftyP1Payment = totalMonthlyPayment * 0.5
  const actualP1Payment = totalMonthlyPayment * (primaryOwnershipPct / 100)
  const paymentDiff = Math.abs(actualP1Payment - fiftyFiftyP1Payment)

  const fiftyFiftyP1EK = totalEK * 0.5
  const ekDiff = Math.abs(primaryEK - fiftyFiftyP1EK)
  const ekDiffDir = primaryEK > fiftyFiftyP1EK ? 'mer' : 'mindre'

  if (Math.abs(primaryOwnershipPct - 50) < 3) {
    notes.push(
      `50/50 fordeling er rimelig: EK-bidragene er naer like ` +
      `(${primaryLabel} ${Math.round(ekShare1)}%, ${coLabel} ${100 - ekShare1}%).`
    )
  } else {
    const paymentDir = actualP1Payment > fiftyFiftyP1Payment ? 'mer' : 'mindre'
    notes.push(
      `vs. 50/50: ${primaryLabel} betaler ${Math.round(paymentDiff).toLocaleString('nb-NO')} kr/mnd ` +
      `${paymentDir} enn ved lik fordeling, og bidrar ` +
      `${Math.round(ekDiff).toLocaleString('nb-NO')} kr ${ekDiffDir} i EK.`
    )
  }

  // Gjeldsandel vs. inntektsandel
  const debtShare1 = Math.round((loanAmount * primaryOwnershipPct) / 100)
  const maxDebtP1 = Math.round(primaryGross * 5)
  if (debtShare1 > maxDebtP1) {
    notes.push(
      `Merk: ${primaryLabel}s andel av gjelden (${debtShare1.toLocaleString('nb-NO')} kr) ` +
      `overskrider 5x egen inntekt (${maxDebtP1.toLocaleString('nb-NO')} kr). ` +
      `Vurder lavere eierbrøk for ${primaryLabel}.`
    )
  }

  notes.push('Eierbroeken boer tinglyses i skjoetet. Kontakt advokat/megler for juridisk raadgivning.')
  return notes
}

/**
 * Bygger komplett fordelingsplan mellom sokerne.
 */
export function buildDistributionPlan(
  scenarioId: string,
  property: PropertyInput,
  household: HouseholdInput,
  loanParams: LoanParametersInput,
  loanAmount: number,
  distribution?: DistributionInput
): DistributionPlan | null {
  if (!household.coApplicant) return null

  const primaryLabel = household.primaryApplicant.label ?? 'Soker 1'
  const coLabel = household.coApplicant.label ?? 'Soker 2'

  const primaryGross = household.primaryApplicant.grossIncome
  const coGross = household.coApplicant.grossIncome
  const totalGross = primaryGross + coGross

  // Egenkapitalbidrag — bruk separate EK-felter fra distribution om tilgjengelig
  let primaryEK: number
  let coEK: number

  if (distribution?.primaryEquityContribution !== undefined) {
    primaryEK = distribution.primaryEquityContribution
    coEK = distribution.coApplicantEquityContribution ?? Math.max(0, loanParams.equity - primaryEK)
  } else if (distribution && !distribution.equalSplit) {
    primaryEK = loanParams.equity * (distribution.primaryShare / 100)
    coEK = loanParams.equity - primaryEK
  } else {
    // Default: fordel EK etter inntektsandel
    primaryEK = totalGross > 0
      ? loanParams.equity * (primaryGross / totalGross)
      : loanParams.equity * 0.5
    coEK = loanParams.equity - primaryEK
  }

  const totalEquity = primaryEK + coEK

  // Eierbroek
  const primaryOwnershipPct = distribution?.primaryShare
    ?? calcRecommendedOwnershipPercent(primaryEK, totalEquity, primaryGross, totalGross)

  const totalProperty = property.price + (property.sharedDebt ?? 0)
  const primaryPropertyValue = totalProperty * (primaryOwnershipPct / 100)
  const primaryDebt = loanAmount * (primaryOwnershipPct / 100)

  const totalMonthlyPayment = annuityPayment(
    loanAmount,
    loanParams.interestRate,
    loanParams.loanTermYears
  )
  const primaryMonthlyPayment = totalMonthlyPayment * (primaryOwnershipPct / 100)

  const ownershipSplit = makeRow('Eierbroek (verdi)', primaryPropertyValue, totalProperty)
  const debtSplit = makeRow('Gjeldsandel', primaryDebt, loanAmount)
  const equitySplit = makeRow('Egenkapitalbidrag', primaryEK, totalEquity)
  const paymentSplit = makeRow('Maanedlig betaling', primaryMonthlyPayment, totalMonthlyPayment)

  const notes = buildNotes(
    primaryLabel,
    coLabel,
    primaryEK,
    coEK,
    primaryGross,
    coGross,
    primaryOwnershipPct,
    totalMonthlyPayment,
    loanAmount
  )

  return {
    scenarioId,
    primaryLabel,
    coApplicantLabel: coLabel,
    ownershipSplit,
    debtSplit,
    equitySplit,
    paymentSplit,
    recommendedOwnershipPercent: primaryOwnershipPct,
    notes,
  }
}
