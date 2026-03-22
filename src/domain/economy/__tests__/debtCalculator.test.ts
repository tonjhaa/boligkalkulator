import { describe, it, expect } from 'vitest'
import {
  getCurrentRate,
  buildRepaymentPlan,
  calculateTotalMonthlyDebtCost,
} from '../debtCalculator'
import type { DebtAccount } from '@/types/economy'

function makeDebt(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: 'debt-1',
    creditor: 'Lånekassen',
    type: 'studielaan',
    originalAmount: 400_000,
    currentBalance: 350_000,
    rateHistory: [{ fromDate: '2020-01-01', nominalRate: 3.5 }],
    monthlyPayment: 3_000,
    termFee: 0,
    startDate: '2020-01-01',
    ...overrides,
  }
}

describe('getCurrentRate', () => {
  it('returnerer den gjeldende renten for en dato', () => {
    const debt = makeDebt({
      rateHistory: [
        { fromDate: '2020-01-01', nominalRate: 3.5 },
        { fromDate: '2023-06-01', nominalRate: 5.25 },
        { fromDate: '2024-01-01', nominalRate: 6.0 },
      ],
    })

    expect(getCurrentRate(debt, new Date('2022-01-01'))).toBe(3.5)
    expect(getCurrentRate(debt, new Date('2023-07-01'))).toBe(5.25)
    expect(getCurrentRate(debt, new Date('2024-06-01'))).toBe(6.0)
  })

  it('returnerer første rate ved dato før historikk', () => {
    const debt = makeDebt({
      rateHistory: [{ fromDate: '2023-01-01', nominalRate: 5.0 }],
    })
    expect(getCurrentRate(debt, new Date('2020-01-01'))).toBe(5.0)
  })

  it('returnerer 0 ved tom rateHistory', () => {
    const debt = makeDebt({ rateHistory: [] })
    expect(getCurrentRate(debt)).toBe(0)
  })
})

describe('buildRepaymentPlan', () => {
  it('starter på currentBalance', () => {
    const debt = makeDebt({ currentBalance: 100_000, monthlyPayment: 2_000, rateHistory: [{ fromDate: '2024-01-01', nominalRate: 5.0 }] })
    const plan = buildRepaymentPlan(debt)
    expect(plan.rows[0].balance).toBeLessThan(100_000)
  })

  it('balansen synker for hvert termin', () => {
    const debt = makeDebt({ currentBalance: 50_000, monthlyPayment: 2_000 })
    const plan = buildRepaymentPlan(debt)
    for (let i = 1; i < plan.rows.length; i++) {
      expect(plan.rows[i].balance).toBeLessThanOrEqual(plan.rows[i - 1].balance)
    }
  })

  it('total rentekostnad er positiv', () => {
    const debt = makeDebt({ currentBalance: 100_000 })
    const plan = buildRepaymentPlan(debt)
    expect(plan.totalInterestCost).toBeGreaterThan(0)
  })

  it('tar hensyn til renteendring midtveis (rateHistory)', () => {
    const debt = makeDebt({
      currentBalance: 100_000,
      monthlyPayment: 2_000,
      startDate: '2024-01-01',
      rateHistory: [
        { fromDate: '2024-01-01', nominalRate: 4.0 },
        { fromDate: '2025-01-01', nominalRate: 6.0 },  // rentehopp etter 12 mnd
      ],
    })
    const plan = buildRepaymentPlan(debt)

    // Rente i mnd 1 = 4%
    const month1Rate = plan.rows[0].rate
    // Rente i mnd 13 = 6%
    const month13Rate = plan.rows[12]?.rate ?? 0

    expect(month1Rate).toBe(4.0)
    expect(month13Rate).toBe(6.0)
  })
})

describe('calculateTotalMonthlyDebtCost', () => {
  it('summerer terminbeløp + gebyr', () => {
    const debts: DebtAccount[] = [
      makeDebt({ monthlyPayment: 2_000, termFee: 50 }),
      makeDebt({ id: 'd2', monthlyPayment: 1_500, termFee: 0 }),
    ]
    expect(calculateTotalMonthlyDebtCost(debts)).toBe(3_550)
  })

  it('returnerer 0 for tom liste', () => {
    expect(calculateTotalMonthlyDebtCost([])).toBe(0)
  })
})
