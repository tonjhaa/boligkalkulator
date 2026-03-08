// Skatteberegning
export {
  calcAnnualTax,
  calcMonthlyNetIncome,
  calcHouseholdMonthlyNetIncome,
  calcTotalAnnualIncome,
} from './tax'

// SIFO
export { calcSIFOExpenses, calcSIFOBreakdown } from './sifo'

// Lånformler
export {
  annuityPayment,
  seriesPayment,
  annuityBalance,
  monthlyPayment,
  maxLoanFromPayment,
  effectiveRate,
} from './loan'

// Amortisering
export {
  buildAmortizationPlan,
  getYearlySnapshot,
  balanceAfterYears,
} from './amortization'

// Eiendom
export {
  calcAcquisitionFees,
  calcEffectiveEquity,
  calcTotalPropertyValue,
  analyzeProperty,
} from './property'

// Analyser
export { analyzeEquity } from './equity'
export { analyzeDebtRatio } from './debtRatio'
export { analyzeAffordability, calcStressTestRate, calcOtherMonthlyExpenses } from './affordability'
export { analyzeMaxPurchase } from './maxPurchase'

// Regler
export { buildScenarioStatus } from './rules'

// Fordeling
export { buildDistributionPlan } from './distribution'

// Kalkulator (orchestrator)
export { calculateScenario, calculateAmortization, calculateDistribution, calculateAll } from './calculator'
