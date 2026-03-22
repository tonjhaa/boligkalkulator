import { describe, it, expect } from 'vitest'
import {
  calculateATF,
  beregnTimesatsATab,
  beregnOT50Sats,
  sumATFByYear,
} from '../atfCalculator'
import type { ATFEntry } from '@/types/economy'

const ÅRSLØNN = 670_128 // 55 844 × 12

describe('beregnTimesatsATab', () => {
  it('er årslønn / 1850', () => {
    const sats = beregnTimesatsATab(ÅRSLØNN)
    expect(sats).toBeCloseTo(ÅRSLØNN / 1850, 2)
  })
})

describe('beregnOT50Sats', () => {
  it('er timesats × 1.5', () => {
    const timesats = beregnTimesatsATab(ÅRSLØNN)
    const ot50 = beregnOT50Sats(ÅRSLØNN)
    expect(ot50).toBeCloseTo(timesats * 1.5, 2)
  })
})

describe('calculateATF', () => {
  it('beregner dagssats hverdag korrekt', () => {
    const entry: ATFEntry = {
      id: '1',
      year: 2026,
      øvelsesnavn: 'Test',
      perioder: [{ kode: 'ØV_MAN_FRE', antallDager: 4 }],
      beregnetBeløp: 0,
      tidskompensasjonTimer: 0,
    }
    const result = calculateATF(entry, ÅRSLØNN)
    const timesats = ÅRSLØNN / 1850
    const dagssats = timesats * 7.5
    expect(result.totalEconomy).toBeCloseTo(dagssats * 4, 0)
  })

  it('beregner dagssats helg med helgetillegg (+65 kr/t)', () => {
    const entry: ATFEntry = {
      id: '1',
      year: 2026,
      øvelsesnavn: 'Test helg',
      perioder: [{ kode: 'ØV_LØR_SØN', antallDager: 2 }],
      beregnetBeløp: 0,
      tidskompensasjonTimer: 0,
    }
    const result = calculateATF(entry, ÅRSLØNN)
    const timesats = ÅRSLØNN / 1850
    const satsPerTime = timesats + 65 // helgetillegg
    const dagssats = satsPerTime * 8  // HE = 8 timer
    expect(result.totalEconomy).toBeCloseTo(dagssats * 2, 0)
  })

  it('beregner OT 50% korrekt', () => {
    const entry: ATFEntry = {
      id: '1',
      year: 2026,
      øvelsesnavn: 'Test OT',
      perioder: [{ kode: 'ØV_OT_50_MAN_FRE', antallTimer: 6 }],
      beregnetBeløp: 0,
      tidskompensasjonTimer: 0,
    }
    const result = calculateATF(entry, ÅRSLØNN)
    const ot50 = (ÅRSLØNN / 1850) * 1.5
    expect(result.totalEconomy).toBeCloseTo(ot50 * 6, 0)
  })

  it('summerer flere perioder', () => {
    const entry: ATFEntry = {
      id: '1',
      year: 2026,
      øvelsesnavn: 'Kombinert',
      perioder: [
        { kode: 'ØV_MAN_FRE', antallDager: 3 },
        { kode: 'ØV_LØR_SØN', antallDager: 1 },
      ],
      beregnetBeløp: 0,
      tidskompensasjonTimer: 0,
    }
    const result = calculateATF(entry, ÅRSLØNN)
    const timesats = ÅRSLØNN / 1850
    const hverdagSum = timesats * 7.5 * 3
    const helgSum = (timesats + 65) * 8 * 1
    expect(result.totalEconomy).toBeCloseTo(hverdagSum + helgSum, 0)
  })

  it('beregner tidskompensasjonTimer (dager × 7.5)', () => {
    const entry: ATFEntry = {
      id: '1',
      year: 2026,
      øvelsesnavn: 'Test',
      perioder: [{ kode: 'ØV_MAN_FRE', antallDager: 4 }],
      beregnetBeløp: 0,
      tidskompensasjonTimer: 0,
    }
    const result = calculateATF(entry, ÅRSLØNN)
    expect(result.tidskompensasjonTimer).toBe(4 * 7.5)
  })
})

describe('sumATFByYear', () => {
  it('summerer beregnetBeløp for riktig år', () => {
    const entries: ATFEntry[] = [
      { id: '1', year: 2026, øvelsesnavn: 'Ø1', perioder: [], beregnetBeløp: 5000, tidskompensasjonTimer: 0 },
      { id: '2', year: 2026, øvelsesnavn: 'Ø2', perioder: [], beregnetBeløp: 3000, tidskompensasjonTimer: 0 },
      { id: '3', year: 2025, øvelsesnavn: 'Ø3', perioder: [], beregnetBeløp: 7000, tidskompensasjonTimer: 0 },
    ]
    expect(sumATFByYear(entries, 2026)).toBe(8000)
    expect(sumATFByYear(entries, 2025)).toBe(7000)
    expect(sumATFByYear(entries, 2024)).toBe(0)
  })
})
