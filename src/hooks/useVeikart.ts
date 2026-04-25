import { useMemo } from 'react'
import { useEconomyStore } from '@/application/useEconomyStore'
import { computeEffectiveBalance } from '@/domain/economy/savingsCalculator'

// ── Norsk boliglånsforskrift 2025 ────────────────────────────
const EK_KRAV = 0.10           // 10% egenkapital
const MAX_GJELDSGRAD = 5       // maks gjeld / bruttoinntekt
const BSU_MAX_YEARLY = 27500
const BSU_MAX_TOTAL = 300000
const BSU_MAX_AGE = 33         // siste år man KAN spare (fyller 34)
const BSU_TAX_BENEFIT = 0.10   // 10% av innskudd
const STRESSTEST_MIN = 0.07    // 7% minimumrente
const STRESSTEST_PP = 0.03     // +3 pp

function calcMaxPurchase(equity: number, annualIncome: number, existingDebt: number): number {
  const maxByEK = equity / EK_KRAV
  const maxByIncome = (annualIncome * MAX_GJELDSGRAD - existingDebt) + equity
  return Math.min(maxByEK, maxByIncome)
}

function calcStressRate(currentRate: number): number {
  return Math.max(STRESSTEST_MIN, currentRate + STRESSTEST_PP)
}

function monthlyPayment(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 12
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export interface VeikartData {
  // Input (fra store)
  equity: number
  bsu: number
  fond: number
  annualIncome: number
  existingDebt: number
  monthlySavings: number

  // Beregnet
  totalEquity: number
  maxPurchase: number
  maxLoan: number
  stressRate: number
  stressMonthlyPayment: number

  // BSU
  bsuRemaining: number        // til BSU-taket
  bsuYearlyTaxSaving: number  // skattefordel per år
  bsuCanSave: boolean         // alder OK

  // Scenarier: { years, equity, bsu, maxPurchase }
  scenarios: VeikartScenario[]
}

export interface VeikartScenario {
  years: number
  label: string
  equity: number
  bsu: number
  maxPurchase: number
  monthlyPaymentAtStress: number
}

const CURRENT_RATE = 0.0425  // 4.25% (norges bank 2026)

export function useVeikart(): VeikartData {
  const { savingsAccounts, fondPortfolio, debts, profile } = useEconomyStore()

  return useMemo(() => {
    const now = new Date()
    // Egenkapital fra sparekonto (ikke BSU) — bruker effektiv saldo inkl. bidrag etter siste snapshot
    const equity = savingsAccounts
      .filter((a) => a.type === 'sparekonto')
      .reduce((s, a) => s + computeEffectiveBalance(a, now), 0)

    const bsu = savingsAccounts
      .filter((a) => a.type === 'BSU')
      .reduce((s, a) => s + computeEffectiveBalance(a, now), 0)

    const fondSnapshots = [...(fondPortfolio?.snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    const fond = fondSnapshots[0]?.totalValue ?? 0

    const annualIncome =
      (profile?.baseMonthly ?? 0) * 12 +
      (profile?.fixedAdditions.reduce((s, a) => s + a.amount, 0) ?? 0) * 12

    const existingDebt = debts.reduce((s, d) => s + d.currentBalance, 0)

    // Månedlig sparerate fra kontoer
    const monthlySavings = savingsAccounts.reduce((s, a) => {
      return s + (a.monthlyContribution ?? 0)
    }, 0) + (fondPortfolio?.monthlyDeposit ?? 0)

    const totalEquity = equity + bsu + fond
    const maxPurchase = calcMaxPurchase(totalEquity, annualIncome, existingDebt)
    const maxLoan = maxPurchase - totalEquity
    const stressRate = calcStressRate(CURRENT_RATE)
    const stressMonthlyPayment = maxLoan > 0 ? monthlyPayment(maxLoan, stressRate, 25) : 0

    const bsuRemaining = Math.max(0, BSU_MAX_TOTAL - bsu)
    const bsuYearlyTaxSaving = Math.min(BSU_MAX_YEARLY, bsuRemaining) * BSU_TAX_BENEFIT

    // Scenarier: nå, 1 år, 2 år, 3 år, 5 år
    const yearSteps = [0, 1, 2, 3, 5]
    const scenarios: VeikartScenario[] = yearSteps.map((years) => {
      const futureEquity = equity + monthlySavings * 12 * years
      const futureBsu = Math.min(BSU_MAX_TOTAL, bsu + Math.min(BSU_MAX_YEARLY, bsuRemaining) * years)
      const futureTotal = futureEquity + futureBsu + fond
      const futureMax = calcMaxPurchase(futureTotal, annualIncome, existingDebt)
      const futureLoan = futureMax - futureTotal
      const futureStressPayment = futureLoan > 0 ? monthlyPayment(futureLoan, stressRate, 25) : 0
      return {
        years,
        label: years === 0 ? 'I dag' : years === 1 ? '1 år' : `${years} år`,
        equity: futureEquity,
        bsu: futureBsu,
        maxPurchase: futureMax,
        monthlyPaymentAtStress: futureStressPayment,
      }
    })

    return {
      equity, bsu, fond, annualIncome, existingDebt, monthlySavings,
      totalEquity, maxPurchase, maxLoan, stressRate, stressMonthlyPayment,
      bsuRemaining, bsuYearlyTaxSaving, bsuCanSave: bsu < BSU_MAX_TOTAL,
      scenarios,
    }
  }, [savingsAccounts, fondPortfolio, debts, profile])
}

export { calcMaxPurchase, monthlyPayment, BSU_MAX_YEARLY, BSU_MAX_TOTAL, BSU_MAX_AGE, BSU_TAX_BENEFIT, EK_KRAV, MAX_GJELDSGRAD }
