import type { DebtRatioAnalysis, LendingRulesConfig } from '@/types'

/**
 * Gjeldsgradsanalyse i henhold til Boliglånsforskriften.
 *
 * Kravet: Samlet gjeld ≤ 5 × samlet bruttoinntekt for husstanden
 *
 * Samlet gjeld = nytt boliglån + all eksisterende gjeld
 * Samlet inntekt = primær bruttoinntekt + medsøkers bruttoinntekt + annen inntekt
 *
 * Merk: Banken legger til grunn søkernes SAMLEDE gjeld og inntekt,
 * uavhengig av eierbrøk på boligen.
 */
export function analyzeDebtRatio(
  loanAmount: number,
  existingDebt: number,
  totalAnnualIncome: number,
  rules: LendingRulesConfig
): DebtRatioAnalysis {
  const totalDebt = loanAmount + existingDebt
  const debtRatio = totalAnnualIncome > 0 ? totalDebt / totalAnnualIncome : Infinity
  const maxDebtRatio = rules.maxDebtRatio
  const maxAllowedDebt = totalAnnualIncome * maxDebtRatio
  const debtBuffer = maxAllowedDebt - totalDebt
  const approved = debtRatio <= maxDebtRatio

  return {
    totalDebt: Math.round(totalDebt),
    totalAnnualIncome: Math.round(totalAnnualIncome),
    debtRatio: Math.round(debtRatio * 100) / 100,
    maxDebtRatio,
    approved,
    maxAllowedDebt: Math.round(maxAllowedDebt),
    debtBuffer: Math.round(debtBuffer),
  }
}
