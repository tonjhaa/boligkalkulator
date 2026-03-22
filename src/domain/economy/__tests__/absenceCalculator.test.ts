import { describe, it, expect } from 'vitest'
import {
  getDaysUsedLast12Months,
  getAbsenceStatus,
  getRemainingQuota,
} from '../absenceCalculator'
import { EGENMELDING_KVOTE } from '@/config/economy.config'
import type { AbsenceRecord } from '@/types/economy'

// Forsvarets kvote = 24 (IKKE 12 som AML)
describe('EGENMELDING_KVOTE', () => {
  it('er 24 (Forsvarets særavtale, ikke 12 som AML)', () => {
    expect(EGENMELDING_KVOTE).toBe(24)
  })
})

describe('getDaysUsedLast12Months', () => {
  it('teller bare egenmeldingsdager (selfCertDays)', () => {
    const ref = new Date('2026-03-01')
    const records: AbsenceRecord[] = [
      { period: '2025-06-01', selfCertDays: 3, sickLeaveDays: 5 },
      { period: '2025-12-01', selfCertDays: 2, sickLeaveDays: 0 },
    ]
    const days = getDaysUsedLast12Months(records, ref)
    // Sykemelding (5 dager) teller IKKE
    expect(days).toBe(5) // 3 + 2
  })

  it('sykemelding teller IKKE mot kvoten', () => {
    const ref = new Date('2026-03-01')
    const records: AbsenceRecord[] = [
      { period: '2025-10-01', selfCertDays: 0, sickLeaveDays: 30 },
    ]
    const days = getDaysUsedLast12Months(records, ref)
    expect(days).toBe(0)
  })

  it('teller ikke perioder eldre enn 12 måneder', () => {
    const ref = new Date('2026-03-01')
    const records: AbsenceRecord[] = [
      { period: '2024-01-01', selfCertDays: 10, sickLeaveDays: 0 }, // > 12 mnd siden
      { period: '2025-12-01', selfCertDays: 3, sickLeaveDays: 0 },  // innenfor 12 mnd
    ]
    const days = getDaysUsedLast12Months(records, ref)
    expect(days).toBe(3)
  })

  it('bruker dagens dato som standard referanse', () => {
    const records: AbsenceRecord[] = []
    expect(() => getDaysUsedLast12Months(records)).not.toThrow()
  })
})

describe('getAbsenceStatus', () => {
  const ref = new Date('2026-03-01')

  function makeRecords(days: number): AbsenceRecord[] {
    return [{ period: '2025-10-01', selfCertDays: days, sickLeaveDays: 0 }]
  }

  it('status ok ved 0–20 dager', () => {
    expect(getAbsenceStatus(makeRecords(0), ref)).toBe('ok')
    expect(getAbsenceStatus(makeRecords(15), ref)).toBe('ok')
    expect(getAbsenceStatus(makeRecords(20), ref)).toBe('ok')
  })

  it('status warning ved 21–22 dager', () => {
    expect(getAbsenceStatus(makeRecords(21), ref)).toBe('warning')
    expect(getAbsenceStatus(makeRecords(22), ref)).toBe('warning')
  })

  it('status critical ved 23–24 dager', () => {
    expect(getAbsenceStatus(makeRecords(23), ref)).toBe('critical')
    expect(getAbsenceStatus(makeRecords(24), ref)).toBe('critical')
  })

  it('status over ved 25+ dager', () => {
    expect(getAbsenceStatus(makeRecords(25), ref)).toBe('over')
    expect(getAbsenceStatus(makeRecords(30), ref)).toBe('over')
  })
})

describe('getRemainingQuota', () => {
  it('er 24 minus brukte dager', () => {
    const ref = new Date('2026-03-01')
    const records: AbsenceRecord[] = [
      { period: '2025-10-01', selfCertDays: 10, sickLeaveDays: 0 },
    ]
    expect(getRemainingQuota(records, ref)).toBe(14)
  })

  it('er aldri negativt', () => {
    const ref = new Date('2026-03-01')
    const records: AbsenceRecord[] = [
      { period: '2025-10-01', selfCertDays: 30, sickLeaveDays: 0 },
    ]
    expect(getRemainingQuota(records, ref)).toBe(0)
  })
})
