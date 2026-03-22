import type { AbsenceRecord, AbsenceStatus } from '@/types/economy'
import {
  EGENMELDING_KVOTE,
  ABSENCE_WARNING_THRESHOLD,
  ABSENCE_CRITICAL_THRESHOLD,
} from '@/config/economy.config'

// ------------------------------------------------------------
// KJERNEBEREGNINGER
// ------------------------------------------------------------

/**
 * Returnerer antall egenmeldingsdager brukt siste 12 måneder.
 * NB: Forsvarets særavtale = 24 egenmeldingsdager per 12 måneder.
 * Sykemelding teller IKKE mot kvoten.
 */
export function getDaysUsedLast12Months(
  records: AbsenceRecord[],
  referenceDate: Date = new Date()
): number {
  const cutoff = new Date(referenceDate)
  cutoff.setMonth(cutoff.getMonth() - 12)

  return records
    .filter((r) => {
      const d = new Date(r.period)
      return d > cutoff && d <= referenceDate
    })
    .reduce((s, r) => s + r.selfCertDays, 0)
}

/**
 * Beregner nåværende fravær-status.
 */
export function getAbsenceStatus(
  records: AbsenceRecord[],
  referenceDate: Date = new Date()
): AbsenceStatus {
  const days = getDaysUsedLast12Months(records, referenceDate)
  return daysToStatus(days)
}

/**
 * Fremskriver fraværsstatus til en fremtidig dato.
 * Hjelper å forutsi om man nærmer seg grensen.
 */
export function forecastAbsenceStatus(
  records: AbsenceRecord[],
  toDate: Date
): AbsenceStatus {
  return getAbsenceStatus(records, toDate)
}

// ------------------------------------------------------------
// HJELPERE
// ------------------------------------------------------------

function daysToStatus(days: number): AbsenceStatus {
  if (days >= EGENMELDING_KVOTE + 1) return 'over'
  if (days >= ABSENCE_CRITICAL_THRESHOLD) return 'critical'
  if (days >= ABSENCE_WARNING_THRESHOLD) return 'warning'
  return 'ok'
}

export function getStatusColor(status: AbsenceStatus): string {
  switch (status) {
    case 'ok':       return 'text-green-500'
    case 'warning':  return 'text-yellow-500'
    case 'critical': return 'text-red-400'
    case 'over':     return 'text-red-600'
  }
}

export function getStatusLabel(status: AbsenceStatus): string {
  switch (status) {
    case 'ok':       return 'OK'
    case 'warning':  return 'Advarsel'
    case 'critical': return 'Kritisk'
    case 'over':     return 'Overskredet'
  }
}

/** Antall kvotedager igjen */
export function getRemainingQuota(records: AbsenceRecord[], referenceDate: Date = new Date()): number {
  const used = getDaysUsedLast12Months(records, referenceDate)
  return Math.max(0, EGENMELDING_KVOTE - used)
}
