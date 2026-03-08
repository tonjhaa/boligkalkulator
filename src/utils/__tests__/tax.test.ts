import { describe, it, expect } from 'vitest'
import { calcAnnualTax, calcMonthlyNetIncome, calcTotalAnnualIncome } from '../tax'
import { defaultConfig } from '@/config/default.config'

const tax = defaultConfig.tax

describe('calcAnnualTax', () => {
  it('600 000 kr brutto → ~145 000 kr samlet skatt (~24% effektiv)', () => {
    const gross = 600_000
    const annualTax = calcAnnualTax(gross, tax)
    // Komponenter: alminnelig ~85k + trygdeavgift ~47k + trinnskatt ~13k = ~145k
    expect(annualTax).toBeGreaterThan(130_000)
    expect(annualTax).toBeLessThan(160_000)
  })

  it('0 kr brutto → 0 kr skatt', () => {
    expect(calcAnnualTax(0, tax)).toBe(0)
  })

  it('200 000 kr brutto → ingen trinnskatt (under terskel)', () => {
    const gross = 200_000
    const result = calcAnnualTax(gross, tax)
    // Ingen trinnskatt under 217 400
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(gross * 0.30) // under 30% effektiv
  })

  it('1 000 000 kr brutto → ~31% effektiv skattesats', () => {
    const gross = 1_000_000
    const result = calcAnnualTax(gross, tax)
    // Alminnelig ~173k + trygdeavgift ~78k + trinnskatt ~60k = ~311k (~31%)
    expect(result / gross).toBeGreaterThan(0.28)
    expect(result / gross).toBeLessThan(0.36)
  })
})

describe('calcMonthlyNetIncome', () => {
  it('600 000 kr brutto → ~34 000–38 000 kr netto per måned', () => {
    const monthly = calcMonthlyNetIncome(600_000, tax)
    expect(monthly).toBeGreaterThan(33_000)
    expect(monthly).toBeLessThan(40_000)
  })

  it('nettoinntekt er alltid lavere enn brutto / 12', () => {
    const gross = 800_000
    const monthly = calcMonthlyNetIncome(gross, tax)
    expect(monthly).toBeLessThan(gross / 12)
  })
})

describe('calcTotalAnnualIncome', () => {
  it('to søkere + annen inntekt summeres korrekt', () => {
    const total = calcTotalAnnualIncome(600_000, 50_000, 500_000, 0)
    expect(total).toBe(1_150_000)
  })

  it('undefined verdier behandles som 0', () => {
    const total = calcTotalAnnualIncome(600_000, undefined, undefined, undefined)
    expect(total).toBe(600_000)
  })
})
