import { describe, it, expect } from 'vitest'
import { calculateScenario, calculateAmortization } from '../calculator'
import { defaultConfig } from '@/config/default.config'
import type { ScenarioInput } from '@/types'

/** Et realistisk testscenario: to søkere, bolig 5M, EK 900k */
const baseScenario: ScenarioInput = {
  id: 'test-1',
  label: 'Testscenario',
  createdAt: Date.now(),
  isBase: true,
  property: {
    price: 5_000_000,
    type: 'leilighet',
    sharedDebt: 0,
    monthlyFee: 4_500,
    propertyTax: 0,
  },
  household: {
    primaryApplicant: {
      grossIncome: 750_000,
      existingDebt: 0,
      label: 'Person A',
    },
    coApplicant: {
      grossIncome: 650_000,
      existingDebt: 0,
      label: 'Person B',
    },
    children: 0,
    adults: 2,
  },
  loanParameters: {
    equity: 900_000,
    interestRate: 5.5,
    loanTermYears: 25,
    loanType: 'annuitet',
    extraMonthlyExpenses: 0,
  },
}

describe('calculateScenario — godkjent scenario', () => {
  const analysis = calculateScenario(baseScenario, defaultConfig)

  it('returnerer korrekt scenarioId', () => {
    expect(analysis.scenarioId).toBe('test-1')
  })

  it('beregner lånebehov korrekt', () => {
    // EK 900k - gebyrer (~125k for 5M bolig) ≈ 775k effektiv EK
    // Lån ≈ 5M - 775k ≈ 4 225 000
    expect(analysis.property.loanAmount).toBeGreaterThan(4_100_000)
    expect(analysis.property.loanAmount).toBeLessThan(4_400_000)
  })

  it('dokumentavgift er 2.5% av kjøpspris', () => {
    expect(analysis.property.stampDuty).toBe(125_000) // 5M × 2.5%
  })

  it('gjeldsgrad er under 5', () => {
    expect(analysis.debtRatio.debtRatio).toBeLessThan(5.0)
    expect(analysis.debtRatio.approved).toBe(true)
  })

  it('betjeningsevne er godkjent', () => {
    expect(analysis.affordability.approved).toBe(true)
    expect(analysis.affordability.disposableAmount).toBeGreaterThan(0)
  })

  it('maks kjøpsbeløp er beregnet', () => {
    expect(analysis.maxPurchase.maxPurchasePrice).toBeGreaterThan(0)
    expect(['equity', 'debtRatio', 'affordability']).toContain(
      analysis.maxPurchase.limitingFactor
    )
  })

  it('status er godkjent (nok EK, gjeldsgrad ok, betjeningsevne ok)', () => {
    expect(analysis.status.approved).toBe(true)
    expect(analysis.status.errorCount).toBe(0)
  })
})

describe('calculateScenario — for lite EK', () => {
  const lowEqScenario: ScenarioInput = {
    ...baseScenario,
    id: 'test-low-eq',
    loanParameters: { ...baseScenario.loanParameters, equity: 500_000 },
  }
  const analysis = calculateScenario(lowEqScenario, defaultConfig)

  it('EK-kravet er ikke oppfylt', () => {
    // 500k - gebyrer ≈ 375k effektiv, 15% av 5M = 750k → for lite
    expect(analysis.equity.approved).toBe(false)
  })

  it('status er ikke godkjent', () => {
    expect(analysis.status.approved).toBe(false)
    expect(analysis.status.errorCount).toBeGreaterThan(0)
  })
})

describe('calculateScenario — høy gjeldsgrad', () => {
  const highDebtScenario: ScenarioInput = {
    ...baseScenario,
    id: 'test-high-debt',
    household: {
      ...baseScenario.household,
      primaryApplicant: { grossIncome: 400_000, existingDebt: 0 },
      coApplicant: undefined,
    },
  }
  const analysis = calculateScenario(highDebtScenario, defaultConfig)

  it('gjeldsgrad er over 5x', () => {
    expect(analysis.debtRatio.debtRatio).toBeGreaterThan(5.0)
    expect(analysis.debtRatio.approved).toBe(false)
  })
})

describe('calculateAmortization', () => {
  const plan = calculateAmortization(baseScenario, defaultConfig)

  it('har 300 rader (25 år × 12)', () => {
    expect(plan.rows.length).toBe(300)
  })

  it('saldo starter på lånebeløpet og ender nær 0', () => {
    expect(plan.rows[0].balance).toBeLessThan(plan.loanAmount)
    expect(plan.rows[299].balance).toBeLessThan(1_000)
  })

  it('totalt betalt er mer enn lånebeløpet (pga renter)', () => {
    expect(plan.totalPaid).toBeGreaterThan(plan.loanAmount)
  })

  it('har 25 årstotaler', () => {
    expect(plan.yearlyTotals.length).toBe(25)
  })

  it('kumulativ rente øker monotont', () => {
    const r1 = plan.rows[11].cumulativeInterest
    const r2 = plan.rows[59].cumulativeInterest
    const r3 = plan.rows[119].cumulativeInterest
    expect(r2).toBeGreaterThan(r1)
    expect(r3).toBeGreaterThan(r2)
  })
})
