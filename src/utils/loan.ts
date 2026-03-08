/**
 * Grunnleggende låneberegningsformler.
 *
 * Annuitetslån: Fast terminbeløp, avdragsdelen øker og rentedelen minker
 * Serielån:     Fast avdrag, terminbeløp synker over tid (høyest i starten)
 */

/**
 * Beregner månedlig terminbeløp for et annuitetslån.
 *
 * Formel: PMT = PV × r(1+r)^n / ((1+r)^n - 1)
 * der r = månedlig rente, n = antall måneder
 *
 * @param principal  Lånebeløp i NOK
 * @param annualRate Nominell rente i prosent (f.eks. 5.5 for 5,5%)
 * @param termYears  Lånets løpetid i år
 */
export function annuityPayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (principal <= 0) return 0
  const n = termYears * 12
  const r = annualRate / 100 / 12

  // Unngå divisjon på null ved rente = 0
  if (r === 0) return principal / n

  const factor = Math.pow(1 + r, n)
  return (principal * r * factor) / (factor - 1)
}

/**
 * Beregner månedlig terminbeløp for serielån i en gitt måned.
 *
 * For serielån er avdraget fast (PV/n), mens renten minker.
 * Høyeste betaling er i måned 1.
 *
 * @param principal      Opprinnelig lånebeløp i NOK
 * @param annualRate     Nominell rente i prosent
 * @param termYears      Lånets løpetid i år
 * @param monthNumber    Måned (1-basert, default = 1 = høyeste betaling)
 */
export function seriesPayment(
  principal: number,
  annualRate: number,
  termYears: number,
  monthNumber = 1
): number {
  if (principal <= 0) return 0
  const n = termYears * 12
  const r = annualRate / 100 / 12
  const fixedPrincipal = principal / n
  const remainingBalance = principal - fixedPrincipal * (monthNumber - 1)
  return fixedPrincipal + remainingBalance * r
}

/**
 * Beregner gjenstående saldo på annuitetslån etter k måneder.
 */
export function annuityBalance(
  principal: number,
  annualRate: number,
  termYears: number,
  monthsPaid: number
): number {
  if (principal <= 0) return 0
  const n = termYears * 12
  const r = annualRate / 100 / 12

  if (r === 0) return principal * (1 - monthsPaid / n)

  const factor = Math.pow(1 + r, n)
  const factorPaid = Math.pow(1 + r, monthsPaid)
  return principal * (factor - factorPaid) / (factor - 1)
}

/**
 * Splitter ett terminbeløp i rente- og avdragsdel for annuitetslån.
 */
export function annuitySplit(
  currentBalance: number,
  annualRate: number
): { interest: number; principal: number; payment: number } {
  const r = annualRate / 100 / 12
  const interest = currentBalance * r
  // payment beregnes utenfor og sendes inn – denne hjelpen brukes i amortiseringsloopen
  return { interest, principal: 0, payment: 0 }
}

/**
 * Returnerer månedlig betaling basert på lånetype.
 * For stresstesting bruker vi alltid annuitet (høyest mulig kostnad).
 */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number,
  loanType: 'annuitet' | 'serie'
): number {
  if (loanType === 'serie') {
    return seriesPayment(principal, annualRate, termYears, 1)
  }
  return annuityPayment(principal, annualRate, termYears)
}

/**
 * Beregner maks lån gitt et maksimumsbeløp for månedlig betaling.
 * Løser annuitetformelen baklengs: PV = PMT × ((1+r)^n - 1) / (r × (1+r)^n)
 *
 * @param maxMonthlyPayment  Maks akseptabel månedsbetaling i NOK
 * @param annualRate         Rente i prosent
 * @param termYears          Lånets løpetid i år
 */
export function maxLoanFromPayment(
  maxMonthlyPayment: number,
  annualRate: number,
  termYears: number
): number {
  if (maxMonthlyPayment <= 0) return 0
  const n = termYears * 12
  const r = annualRate / 100 / 12

  if (r === 0) return maxMonthlyPayment * n

  const factor = Math.pow(1 + r, n)
  return maxMonthlyPayment * (factor - 1) / (r * factor)
}

/**
 * Effektiv rente (ÅOP) inkludert gebyrer.
 * Bruk Newton-Raphson for å løse ligning numerisk.
 *
 * @param principal        Lånebeløp
 * @param monthlyPayment   Månedlig terminbeløp
 * @param termYears        Løpetid i år
 * @param establishFee     Etableringsgebyr NOK (engangs)
 * @param monthlyFee       Termingebyr NOK per måned
 */
export function effectiveRate(
  principal: number,
  monthlyPaymentAmt: number,
  termYears: number,
  establishFee: number,
  monthlyFee: number
): number {
  const n = termYears * 12
  const netPrincipal = principal - establishFee
  const totalPayment = monthlyPaymentAmt + monthlyFee

  if (netPrincipal <= 0 || totalPayment <= 0) return 0

  // Newton-Raphson iterasjon for å finne månedlig rente
  let r = 0.005 // startgjett 6% p.a.
  for (let i = 0; i < 200; i++) {
    const factor = Math.pow(1 + r, n)
    const f = netPrincipal * r * factor - totalPayment * (factor - 1)
    const df = netPrincipal * (factor + r * n * Math.pow(1 + r, n - 1)) -
               totalPayment * n * Math.pow(1 + r, n - 1)
    const rNext = r - f / df
    if (Math.abs(rNext - r) < 1e-10) {
      r = rNext
      break
    }
    r = rNext
  }

  // Konverter månedlig rente til effektiv årsrente
  return (Math.pow(1 + r, 12) - 1) * 100
}
