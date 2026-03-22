import { describe, it, expect } from 'vitest'
import {
  calculateAccruedHolidayBase,
  forecastJune,
  forecastAllJunes,
} from '../holidayPayCalculator'
import type { EmploymentProfile, MonthRecord, ParsetLonnsslipp } from '@/types/economy'

// Basert på Tonjes faktiske tall
const PROFILE: EmploymentProfile = {
  employer: 'forsvaret',
  salaryGrade: 61,
  baseMonthly: 55_844,
  fixedAdditions: [
    { kode: '1501', label: 'Kompensasjonstillegg husleie', amount: 4_534 },
    { kode: '1162', label: 'HTA-tillegg', amount: 1_700 },
    { kode: '106G', label: 'Tillegg 106G', amount: 1_000 },
  ],
  lastKnownTaxWithholding: 18_478,
  extraTaxWithholding: 1_000,
  housingDeduction: 7_316,
  pensionPercent: 2,
  unionFee: 723,
  atfEnabled: true,
}

function makeSlip(
  year: number,
  month: number,
  overrides: Partial<ParsetLonnsslipp> = {},
): ParsetLonnsslipp {
  return {
    periode: { year, month },
    ansattnummer: '12345',
    loennstrinn: 61,
    maanedslonn: 55_844,
    fasteTillegg: [],
    trekk: [],
    bruttoSum: 63_078,
    nettoUtbetalt: 34_377,
    feriepengegrunnlag: 0,
    opptjentFerie: 0,
    skattetrekk: 18_478,
    ekstraTrekk: 1_000,
    husleietrekk: 7_316,
    pensjonstrekk: 1_151,
    fagforeningskontingent: 723,
    ouFond: 33,
    gruppelivspremie: 0,
    hittilBrutto: 0,
    hittilPensjon: 0,
    hittilForskuddstrekk: 0,
    tabelltrekkGrunnlag: 0,
    tabelltrekkBelop: 0,
    ...overrides,
  }
}

function makeRecord(
  year: number,
  month: number,
  slip?: ParsetLonnsslipp,
): MonthRecord {
  return {
    year,
    month,
    isLocked: !!slip,
    source: slip ? 'imported_slip' : 'forecast',
    lines: [],
    nettoUtbetalt: slip?.nettoUtbetalt ?? 0,
    disposable: slip?.nettoUtbetalt ?? 0,
    slipData: slip,
  }
}

// Desember 2025-slipp med feriepengegrunnlag 688 548 kr
const DEC_2025_SLIP = makeSlip(2025, 12, { feriepengegrunnlag: 688_548 })
const DEC_2025_RECORD = makeRecord(2025, 12, DEC_2025_SLIP)

describe('calculateAccruedHolidayBase', () => {
  it('bruker feriepengegrunnlag fra desember-slipp direkte', () => {
    const result = calculateAccruedHolidayBase(2025, [DEC_2025_RECORD], PROFILE)
    expect(result.actual).toBe(688_548)
    expect(result.projected).toBe(0)
    expect(result.total).toBe(688_548)
    expect(result.monthsWithSlip).toBe(1)
  })

  it('estimerer når ingen desember-slipp: 3 slipper + 9 estimert', () => {
    const records = [
      makeRecord(2025, 1, makeSlip(2025, 1)),
      makeRecord(2025, 2, makeSlip(2025, 2)),
      makeRecord(2025, 3, makeSlip(2025, 3)),
    ]
    const result = calculateAccruedHolidayBase(2025, records, PROFILE)
    const monthlyBase = 55_844 + 4_534 + 1_700 + 1_000 // 63 078
    expect(result.actual).toBe(63_078 * 3)
    expect(result.projected).toBe(monthlyBase * 9)
    expect(result.total).toBe(63_078 * 3 + monthlyBase * 9)
    expect(result.monthsWithSlip).toBe(3)
  })

  it('estimerer fullt år uten slipper', () => {
    const monthlyBase = 55_844 + 4_534 + 1_700 + 1_000 // 63 078
    const result = calculateAccruedHolidayBase(2027, [], PROFILE)
    expect(result.actual).toBe(0)
    expect(result.projected).toBe(monthlyBase * 12)
    expect(result.monthsWithSlip).toBe(0)
  })
})

describe('forecastJune — juni 2026 med desember-slipp 2025', () => {
  const monthHistory = [DEC_2025_RECORD]

  it('bruker feriepengegrunnlag fra des-2025-slipp', () => {
    const f = forecastJune(2026, monthHistory, PROFILE)
    expect(f.feriepengegrunnlag).toBe(688_548)
    expect(f.confidence).toBe('middels') // har des-slip men ikke jun-slip
    expect(f.kilder.feriepengegrunnlag).toBe('Slipp des 2025')
  })

  it('beregner feriepenger = 12% av grunnlag', () => {
    const f = forecastJune(2026, monthHistory, PROFILE)
    expect(f.feriepenger).toBe(Math.round(688_548 * 0.12)) // 82 626
  })

  it('beregner ferietrekk korrekt', () => {
    const f = forecastJune(2026, monthHistory, PROFILE)
    // (55844 × 12 + (4534 + 1700 + 1000) × 12) / 260 × 25
    // = (670128 + 86808) / 260 × 25 = 756936 / 260 × 25 = 2911.29 × 25 = 72782
    const expectedDagsats = Math.round((55_844 * 12 + (4_534 + 1_700 + 1_000) * 12) / 260)
    expect(f.ferietrekkDagsats).toBe(expectedDagsats)
    expect(f.ferietrekk).toBe(expectedDagsats * 25)
  })

  it('skattegrunnlag er 0 når ferietrekk > skattepliktig', () => {
    const f = forecastJune(2026, monthHistory, PROFILE)
    // skattepliktigJuni = 55844 + 7234 = 63078
    // ferietrekk ≈ 72782 > 63078 → skattegrunnlag = 0
    expect(f.skattepliktigJuni).toBe(63_078)
    expect(f.skattegrunnlag).toBe(0)
    expect(f.skattetrekk).toBe(0)
  })

  it('nettoJuni er rimelig (50k–80k for disse tallene)', () => {
    const f = forecastJune(2026, monthHistory, PROFILE)
    expect(f.nettoJuni).toBeGreaterThan(50_000)
    expect(f.nettoJuni).toBeLessThan(80_000)
  })

  it('nettoEkstra = feriepenger - ferietrekk', () => {
    const f = forecastJune(2026, monthHistory, PROFILE)
    expect(f.nettoEkstra).toBe(f.feriepenger - f.ferietrekk)
  })
})

describe('forecastJune — høy konfidens med begge slipper', () => {
  it('confidence = høy når både des- og jun-slipp finnes', () => {
    const monthHistory = [
      DEC_2025_RECORD,
      makeRecord(2026, 6, makeSlip(2026, 6)),
    ]
    const f = forecastJune(2026, monthHistory, PROFILE)
    expect(f.confidence).toBe('høy')
  })
})

describe('forecastJune — lav konfidens uten slipper', () => {
  it('confidence = lav uten noen slipper for forrige år', () => {
    const f = forecastJune(2026, [], PROFILE)
    expect(f.confidence).toBe('lav')
    expect(f.kilder.feriepengegrunnlag).toContain('Estimert')
  })
})

describe('forecastAllJunes', () => {
  it('returnerer riktig antall prognoser', () => {
    const result = forecastAllJunes(2026, [DEC_2025_RECORD], PROFILE, [], 5)
    expect(result).toHaveLength(6) // 2026 t.o.m. 2031
    expect(result[0].year).toBe(2026)
    expect(result[5].year).toBe(2031)
  })

  it('første prognose er høyest konfidens (har des-slipp)', () => {
    const result = forecastAllJunes(2026, [DEC_2025_RECORD], PROFILE, [], 2)
    expect(result[0].confidence).toBe('middels') // har des 2025
    expect(result[1].confidence).toBe('lav')     // mangler des 2026
  })
})
