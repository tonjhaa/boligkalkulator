import type { MaxPurchaseAnalysis, AppConfig, HouseholdInput } from '@/types'
import { calcAcquisitionFees, calcEffectiveEquity } from './property'
import { calcStressTestRate } from './affordability'
import { calcSIFOExpenses } from './sifo'
import { calcHouseholdMonthlyNetIncome, calcTotalAnnualIncome } from './tax'
import { maxLoanFromPayment } from './loan'

/**
 * Beregner maksimalt kjøpsbeløp begrenset av tre uavhengige regler:
 *
 *  1. EGENKAPITAL: pris <= EK / (EK-krav% + gebyrsats)
 *     Løses med binærsøk siden gebyrer avhenger av prisen.
 *
 *  2. GJELDSGRAD: lån <= inntekt × 5 - eksisterende gjeld
 *     pris = max lån + effektiv EK
 *
 *  3. BETJENINGSEVNE: max månedsbetaling ved stressrente
 *     pris = max lån (invers annuitet) + effektiv EK
 *
 * Den bindende grensen (minste tall) er det reelle makstaket.
 */

/** Løser max pris ved egenkapitalkravet med binærsøk */
function maxPriceByEquity(
  equity: number,
  sharedDebt: number,
  config: AppConfig
): number {
  const minEqPct = config.lendingRules.minEquityPercent / 100
  const fees = config.fees

  // Binærsøk: finn P slik at effectiveEquity(P) >= (P + sharedDebt) * minEqPct
  let lo = 0
  let hi = equity * 20 // øvre grense langt over realistisk verdi

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const feeBreakdown = calcAcquisitionFees(mid, fees)
    const effEq = calcEffectiveEquity(equity, feeBreakdown.totalFees)
    const required = (mid + sharedDebt) * minEqPct

    if (effEq >= required) {
      lo = mid
    } else {
      hi = mid
    }

    if (hi - lo < 100) break
  }

  return Math.round(lo)
}

/** Max pris ved gjeldsgradsregelen */
function maxPriceByDebtRatio(
  equity: number,
  sharedDebt: number,
  existingDebt: number,
  totalAnnualIncome: number,
  config: AppConfig
): number {
  const maxTotalDebt = totalAnnualIncome * config.lendingRules.maxDebtRatio
  const maxNewLoan = Math.max(0, maxTotalDebt - existingDebt)
  const fees = config.fees

  // Lag estimat på gebyrer (avhenger av pris, men er liten andel)
  const estimatedPrice = maxNewLoan + equity
  const feeBreakdown = calcAcquisitionFees(estimatedPrice, fees)
  const effEq = calcEffectiveEquity(equity, feeBreakdown.totalFees)

  // pris = lån + effEq - sharedDebt
  const maxPrice = maxNewLoan + effEq - sharedDebt
  return Math.max(0, Math.round(maxPrice))
}

/** Max pris ved betjeningsevne (stresstest) */
function maxPriceByAffordability(
  equity: number,
  sharedDebt: number,
  household: HouseholdInput,
  monthlyFee: number,
  propertyTaxAnnual: number,
  extraMonthlyExpenses: number,
  config: AppConfig
): number {
  const primaryGross = household.primaryApplicant.grossIncome
  const coGross = household.coApplicant?.grossIncome
  const monthlyNetIncome = calcHouseholdMonthlyNetIncome(primaryGross, coGross, config.tax)

  const stressRate = calcStressTestRate(
    config.loanDefaults.defaultInterestRate,
    config.lendingRules
  )

  const sifo = calcSIFOExpenses(household, config.sifo)
  const otherExpenses =
    monthlyFee / 12 + // fellesutgifter legges ved som månedlig allerede
    propertyTaxAnnual / 12 +
    extraMonthlyExpenses +
    config.fees.termFee

  const maxPayment = monthlyNetIncome - sifo - otherExpenses - monthlyFee
  const maxLoan = maxLoanFromPayment(Math.max(0, maxPayment), stressRate, config.loanDefaults.defaultLoanTermYears)

  const fees = config.fees
  const estimatedPrice = maxLoan + equity
  const feeBreakdown = calcAcquisitionFees(estimatedPrice, fees)
  const effEq = calcEffectiveEquity(equity, feeBreakdown.totalFees)

  const maxPrice = maxLoan + effEq - sharedDebt
  return Math.max(0, Math.round(maxPrice))
}

/**
 * Beregner maksimalt kjøpsbeløp fra alle tre regelperspektiver.
 */
export function analyzeMaxPurchase(
  equity: number,
  sharedDebt: number,
  existingDebt: number,
  household: HouseholdInput,
  monthlyFee: number,
  propertyTaxAnnual: number,
  extraMonthlyExpenses: number,
  config: AppConfig
): MaxPurchaseAnalysis {
  const totalAnnualIncome = calcTotalAnnualIncome(
    household.primaryApplicant.grossIncome,
    household.primaryApplicant.otherIncome,
    household.coApplicant?.grossIncome,
    household.coApplicant?.otherIncome
  )

  const maxByEquity = maxPriceByEquity(equity, sharedDebt, config)
  const maxByDebtRatio = maxPriceByDebtRatio(
    equity,
    sharedDebt,
    existingDebt,
    totalAnnualIncome,
    config
  )
  const maxByAffordability = maxPriceByAffordability(
    equity,
    sharedDebt,
    household,
    monthlyFee,
    propertyTaxAnnual,
    extraMonthlyExpenses,
    config
  )

  const maxPurchasePrice = Math.min(maxByEquity, maxByDebtRatio, maxByAffordability)

  let limitingFactor: 'equity' | 'debtRatio' | 'affordability'
  if (maxPurchasePrice === maxByEquity) {
    limitingFactor = 'equity'
  } else if (maxPurchasePrice === maxByDebtRatio) {
    limitingFactor = 'debtRatio'
  } else {
    limitingFactor = 'affordability'
  }

  const feeBreakdown = calcAcquisitionFees(maxPurchasePrice, config.fees)
  const effEq = calcEffectiveEquity(equity, feeBreakdown.totalFees)
  const maxLoanAmount = Math.max(0, maxPurchasePrice + sharedDebt - effEq)

  return {
    maxByEquity,
    maxByDebtRatio,
    maxByAffordability,
    maxPurchasePrice,
    limitingFactor,
    maxLoanAmount: Math.round(maxLoanAmount),
  }
}
