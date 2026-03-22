import { describe, it, expect } from 'vitest'
import { checkBSULimits, calculateGoalProgress, projectSavingsGrowth } from '../savingsCalculator'
import type { SavingsAccount, SavingsGoal } from '@/types/economy'

function makeBSUAccount(overrides: Partial<SavingsAccount> = {}): SavingsAccount {
  return {
    id: 'bsu-1',
    type: 'BSU',
    label: 'BSU',
    openingBalance: 100_000,
    openingDate: '2025-01-01',
    monthlyContribution: 2_291,
    interestCreditFrequency: 'yearly',
    rateHistory: [{ fromDate: '2025-01-01', rate: 5.5 }],
    balanceHistory: [],
    withdrawals: [],
    maxYearlyContribution: 27_500,
    maxTotalBalance: 300_000,
    ...overrides,
  }
}

describe('checkBSULimits', () => {
  it('er ikke maxed under 300 000', () => {
    const account = makeBSUAccount({ openingBalance: 100_000 })
    const status = checkBSULimits(account, 2026)
    expect(status.isMaxed).toBe(false)
    expect(status.currentBalance).toBe(100_000)
  })

  it('er maxed ved 300 000', () => {
    const account = makeBSUAccount({
      openingBalance: 300_000,
      balanceHistory: [{ year: 2026, month: 1, balance: 300_000, isManual: false }],
    })
    const status = checkBSULimits(account, 2026)
    expect(status.isMaxed).toBe(true)
    expect(status.warning).toBeDefined()
  })

  it('total rom = 300 000 - saldo', () => {
    const account = makeBSUAccount({ openingBalance: 200_000 })
    const status = checkBSULimits(account, 2026)
    expect(status.totalRemainingRoom).toBe(100_000)
  })

  it('returnerer advarsel når nærmer seg tak', () => {
    const account = makeBSUAccount({
      openingBalance: 295_000,
      balanceHistory: [{ year: 2026, month: 1, balance: 295_000, isManual: false }],
    })
    const status = checkBSULimits(account, 2026)
    expect(status.warning).toBeDefined()
  })
})

describe('calculateGoalProgress', () => {
  const account = makeBSUAccount({ openingBalance: 100_000 })

  it('beregner korrekt prosent', () => {
    const goal: SavingsGoal = {
      id: 'g1',
      label: 'Egenkapital',
      icon: '🏠',
      targetAmount: 200_000,
      linkedAccountIds: ['bsu-1'],
    }
    const progress = calculateGoalProgress(goal, [account])
    expect(progress.currentTotal).toBe(100_000)
    expect(progress.percent).toBe(50)
  })

  it('returnerer 100% når mål er nådd', () => {
    const goal: SavingsGoal = {
      id: 'g1',
      label: 'Mål',
      icon: '✅',
      targetAmount: 50_000,
      linkedAccountIds: ['bsu-1'],
    }
    const progress = calculateGoalProgress(goal, [account])
    expect(progress.percent).toBe(100)
    expect(progress.monthsRemaining).toBe(0)
  })

  it('ignorerer kontoer som ikke er koblet', () => {
    const goal: SavingsGoal = {
      id: 'g1',
      label: 'Mål',
      icon: '💰',
      targetAmount: 300_000,
      linkedAccountIds: ['other-account'],
    }
    const progress = calculateGoalProgress(goal, [account])
    expect(progress.currentTotal).toBe(0)
  })
})

describe('projectSavingsGrowth — BSU rente krediteres yearly', () => {
  it('krediterer rente i desember, ikke månedlig', () => {
    const account = makeBSUAccount({
      openingBalance: 100_000,
      monthlyContribution: 0,
      rateHistory: [{ fromDate: '2025-01-01', rate: 5.5 }],
    })

    // Kjør jan–des 2025
    const projections = projectSavingsGrowth(account, { year: 2025, month: 12 })

    // Saldo i november (mnd 11) skal være lik åpningsbalanse (rente ennå ikke kreditert)
    const novemberBalance = projections[10] // 0-basert, mnd 11 = index 10
    const desemberBalance = projections[11]

    // Desember skal være høyere (rente kreditert)
    expect(desemberBalance).toBeGreaterThan(novemberBalance)

    // Saldo januar–november skal vokse bare med innskudd (0 her) — dvs. være ca. lik åpning
    // Men i praksis akkumulerer vi renteberegning inne. Sjekk at november == åpning (ingen innskudd, rente ikke kreditert ennå)
    expect(novemberBalance).toBe(100_000)
  })
})
