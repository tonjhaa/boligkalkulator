import type { ScenarioInput } from '@/types'
import { useEconomyStore } from './useEconomyStore'
import { computeEffectiveBalance } from '@/domain/economy/savingsCalculator'

/**
 * Henter relevante felt fra EconomyStore til boligkalkulator.
 * Brukes av "Bruk min profil"-knappen i boligkalkulatoren.
 */
export function extractLoanInputFromEconomy(): Partial<ScenarioInput> {
  const state = useEconomyStore.getState()
  const { profile, savingsAccounts, debts } = state

  if (!profile) return {}

  const grossAnnualIncome =
    profile.baseMonthly * 12 +
    profile.fixedAdditions.reduce((s, a) => s + a.amount * 12, 0)

  const now = new Date()
  const totalEquity = savingsAccounts
    .filter(a => a.type === 'sparekonto' || a.type === 'BSU')
    .reduce((s, a) => s + computeEffectiveBalance(a, now), 0)

  const existingDebt = debts.filter(d => d.status !== 'nedbetalt').reduce((s, d) => s + d.currentBalance, 0)

  return {
    household: {
      primaryApplicant: {
        grossIncome: grossAnnualIncome,
        existingDebt,
      },
      adults: 1,
      children: 0,
    },
    loanParameters: {
      equity: totalEquity,
      interestRate: 5.5,
      loanTermYears: 25,
      loanType: 'annuitet',
    },
  }
}

/**
 * Henter tekst som forklarer hvilke felter som ble hentet og fra hvilke kilder.
 */
export function getProfileBridgeSummary(): string[] {
  const state = useEconomyStore.getState()
  const { profile, savingsAccounts, debts } = state
  const lines: string[] = []

  if (!profile) {
    lines.push('Ingen lønnsprofil registrert i Min Økonomi.')
    return lines
  }

  const grossAnnualIncome = profile.baseMonthly * 12
  lines.push(
    `Bruttoårslønn: ${grossAnnualIncome.toLocaleString('no-NO')} kr (fra lønnsprofil)`
  )

  const now2 = new Date()
  const totalEquity = savingsAccounts
    .filter(a => a.type === 'sparekonto' || a.type === 'BSU')
    .reduce((s, a) => s + computeEffectiveBalance(a, now2), 0)
  if (totalEquity > 0) {
    const ekAccounts = savingsAccounts.filter(a => a.type === 'sparekonto' || a.type === 'BSU')
    lines.push(
      `Egenkapital: ${totalEquity.toLocaleString('no-NO')} kr (sum av ${ekAccounts.length} sparekonto(er)/BSU)`
    )
  }

  const existingDebt = debts.filter(d => d.status !== 'nedbetalt').reduce((s, d) => s + d.currentBalance, 0)
  if (existingDebt > 0) {
    lines.push(
      `Eksisterende gjeld: ${existingDebt.toLocaleString('no-NO')} kr (${debts.length} lån)`
    )
  }

  return lines
}
