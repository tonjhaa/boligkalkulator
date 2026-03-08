import { describe, it, expect } from 'vitest'
import { annuityPayment, seriesPayment, maxLoanFromPayment, annuityBalance } from '../loan'

describe('annuityPayment', () => {
  it('4 000 000 lån, 5.5%, 25 år → ~24 500–26 500 kr/mnd', () => {
    const pmt = annuityPayment(4_000_000, 5.5, 25)
    expect(pmt).toBeGreaterThan(24_500)
    expect(pmt).toBeLessThan(26_500)
  })

  it('ingen lån → 0', () => {
    expect(annuityPayment(0, 5.5, 25)).toBe(0)
  })

  it('rente 0% → lik nedbetaling', () => {
    const pmt = annuityPayment(1_200_000, 0, 10)
    // 1 200 000 / 120 måneder = 10 000
    expect(pmt).toBeCloseTo(10_000, 0)
  })

  it('høyere rente → høyere terminbeløp', () => {
    const low = annuityPayment(3_000_000, 4.0, 25)
    const high = annuityPayment(3_000_000, 7.0, 25)
    expect(high).toBeGreaterThan(low)
  })

  it('kortere løpetid → høyere terminbeløp', () => {
    const long = annuityPayment(3_000_000, 5.5, 30)
    const short = annuityPayment(3_000_000, 5.5, 15)
    expect(short).toBeGreaterThan(long)
  })
})

describe('seriesPayment', () => {
  it('første terminbeløp er høyere enn annuitet for samme lån', () => {
    const series = seriesPayment(4_000_000, 5.5, 25, 1)
    const annuity = annuityPayment(4_000_000, 5.5, 25)
    expect(series).toBeGreaterThan(annuity)
  })

  it('siste terminbeløp er lavere enn annuitet', () => {
    const lastMonth = 25 * 12
    const series = seriesPayment(4_000_000, 5.5, 25, lastMonth)
    const annuity = annuityPayment(4_000_000, 5.5, 25)
    expect(series).toBeLessThan(annuity)
  })
})

describe('maxLoanFromPayment', () => {
  it('er invers av annuityPayment', () => {
    const principal = 3_500_000
    const rate = 5.5
    const years = 25
    const pmt = annuityPayment(principal, rate, years)
    const backCalculated = maxLoanFromPayment(pmt, rate, years)
    expect(backCalculated).toBeCloseTo(principal, -2) // ±100 kr
  })

  it('0 kr maks betaling → 0 kr lån', () => {
    expect(maxLoanFromPayment(0, 5.5, 25)).toBe(0)
  })
})

describe('annuityBalance', () => {
  it('etter 0 måneder = opprinnelig saldo', () => {
    const principal = 4_000_000
    const bal = annuityBalance(principal, 5.5, 25, 0)
    expect(bal).toBeCloseTo(principal, -2)
  })

  it('etter alle måneder ≈ 0', () => {
    const bal = annuityBalance(3_000_000, 5.5, 25, 300)
    expect(bal).toBeLessThan(100) // Nær null (avrundingsfeil er ok)
  })

  it('saldo synker over tid', () => {
    const b10 = annuityBalance(4_000_000, 5.5, 25, 10 * 12)
    const b20 = annuityBalance(4_000_000, 5.5, 25, 20 * 12)
    expect(b10).toBeGreaterThan(b20)
  })
})
