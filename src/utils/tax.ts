import type { TaxConfig } from '@/types'

/**
 * Beregner norsk inntektsskatt for lonnsmottakere.
 *
 * Komponenter:
 *  1. Alminnelig inntektsskatt 22% (etter minstefradrag og personfradrag)
 *  2. Trygdeavgift 7.8% av bruttoinntekt
 *  3. Trinnskatt (marginalt progressiv paa personinntekt)
 *
 * Alle satser og grenser hentes fra TaxConfig (oppdateres i default.config.ts).
 */

function minstefradrag(grossIncome: number, config: TaxConfig): number {
  // Fallback-verdier sikrer korrekt beregning selv om config er delvis lagret fra eldre versjon
  const rate = config.minstefradragRate ?? 0.46
  const min  = config.minstefradragMin  ?? 31_800
  const max  = config.minstefradragMax  ?? 104_450
  const calc = grossIncome * rate
  return Math.min(max, Math.max(min, calc))
}

/**
 * Beregner trinnskatt basert paa personinntekt (bruttolonnen).
 * Satsene i config er marginale rater per trinn.
 */
function calcBracketTax(
  grossIncome: number,
  brackets: { threshold: number; rate: number }[]
): number {
  let tax = 0
  const sorted = [...brackets].sort((a, b) => a.threshold - b.threshold)

  for (let i = 0; i < sorted.length; i++) {
    const lower = sorted[i].threshold
    const upper = sorted[i + 1]?.threshold ?? Infinity
    const rate = sorted[i].rate / 100

    if (grossIncome <= lower) break

    const taxableInBracket = Math.min(grossIncome, upper) - lower
    tax += taxableInBracket * rate
  }
  return Math.max(0, tax)
}

/**
 * Beregner estimert samlet aarsskatt for en person.
 */
export function calcAnnualTax(grossIncome: number, config: TaxConfig): number {
  const mf = minstefradrag(grossIncome, config)
  const alminneligInntekt = Math.max(0, grossIncome - mf)
  const personfradrag = config.personfradrag ?? 108_550
  const skattegrunnlag = Math.max(0, alminneligInntekt - personfradrag)

  const ordinaryTax = skattegrunnlag * (config.incomeTaxRate / 100)
  const nationalInsurance = grossIncome * (config.nationalInsuranceRate / 100)
  const bracketTax = calcBracketTax(grossIncome, config.bracketTax)

  return ordinaryTax + nationalInsurance + bracketTax
}

/**
 * Beregner maanedlig nettoinntekt etter skatt for en person.
 */
export function calcMonthlyNetIncome(grossIncome: number, config: TaxConfig): number {
  const annualNet = grossIncome - calcAnnualTax(grossIncome, config)
  return annualNet / 12
}

/**
 * Beregner total maanedlig nettoinntekt for en husholdning.
 */
export function calcHouseholdMonthlyNetIncome(
  primaryGross: number,
  coApplicantGross: number | undefined,
  config: TaxConfig
): number {
  const primary = calcMonthlyNetIncome(primaryGross, config)
  const co = coApplicantGross ? calcMonthlyNetIncome(coApplicantGross, config) : 0
  return primary + co
}

/**
 * Beregner total bruttoinntekt for husstanden per aar.
 */
export function calcTotalAnnualIncome(
  primaryGross: number,
  primaryOtherIncome: number | undefined,
  coApplicantGross: number | undefined,
  coApplicantOtherIncome: number | undefined
): number {
  return (
    primaryGross +
    (primaryOtherIncome ?? 0) +
    (coApplicantGross ?? 0) +
    (coApplicantOtherIncome ?? 0)
  )
}
