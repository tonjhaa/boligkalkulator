import * as XLSX from 'xlsx'
import type { AbsenceRecord, AbsenceEvent } from '@/types/economy'

// SAP-artskoder fra Forsvaret
const EGENMELDING_KODER = ['0120']
const SYKEMELDING_KODER = ['0110']

/**
 * Konverterer Excel seriedato til JavaScript Date.
 * Excel teller dager fra 1. jan 1900 (med en feil for 1900 som skuddår).
 */
function excelDateToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000)
}

/**
 * Prøver å parse en datoverdi fra Excel-cellen — enten som:
 * - Excel-serienummer (tall)
 * - Norsk tekstformat "DD.MM.YYYY"
 * - ISO-format "YYYY-MM-DD"
 * Returnerer null hvis ingen format matcher.
 */
function parseExcelDate(raw: unknown): Date | null {
  if (typeof raw === 'number') {
    const d = excelDateToDate(raw)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof raw === 'string') {
    const noMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (noMatch) {
      return new Date(Date.UTC(parseInt(noMatch[3]), parseInt(noMatch[2]) - 1, parseInt(noMatch[1])))
    }
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      return new Date(Date.UTC(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3])))
    }
  }
  return null
}

/**
 * Returnerer "YYYY-MM-01" for en gitt dato (brukt som period-nøkkel).
 */
function toPeriodKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/**
 * Henter artskode fra tekstfeltet, f.eks. "0120 Sykemeldt egenmld" → "0120"
 */
function parseKode(tekst: string): string {
  return tekst.trim().split(' ')[0]
}

export interface AbsenceImportResult {
  records: AbsenceRecord[]
  events: AbsenceEvent[]
  antallRader: number
  ukjenteTyper: string[]
}

/**
 * Parser en SAP-eksport (.xlsx) fra Forsvaret og returnerer AbsenceRecord[].
 *
 * Forventet kolonnestruktur (rad 0 = header):
 *   [0] Tekst frav.type  [1] Startdato  [2] Sluttdato
 *   [3] Frav.timer       [4] Frav.dager [5] Kal.dager
 *   [6] Teller           [7] Arb.førhet
 */
export function parseAbsenceExcel(file: File): Promise<AbsenceImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

        // Finn header-rad (rad 0)
        const header = (rows[0] as unknown[]).map((h) => String(h ?? '').trim())

        // Finn kolonneindekser dynamisk etter navn
        const colIdx = (candidates: string[]): number => {
          for (const name of candidates) {
            const idx = header.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()))
            if (idx !== -1) return idx
          }
          return -1
        }

        const idxType  = colIdx(['Tekst frav', 'frav.type', 'fraværstype', 'absence type'])
        const idxStart = colIdx(['Startdato', 'start date', 'fra dato'])
        const idxDager = colIdx(['Frav.dager', 'fraværsdager', 'absence days', 'dager'])

        const missing = [
          idxType  === -1 && 'Tekst frav.type',
          idxStart === -1 && 'Startdato',
          idxDager === -1 && 'Frav.dager',
        ].filter(Boolean)

        if (missing.length > 0) {
          throw new Error(`Filen mangler kolonner: ${missing.join(', ')}`)
        }

        // Aggreger per måned + bygg individuelle hendelser
        const monthMap = new Map<string, { selfCert: number; sickLeave: number }>()
        const ukjenteTyper = new Set<string>()
        const events: AbsenceEvent[] = []
        let antallRader = 0

        for (const row of rows.slice(1)) {
          const tekst = String(row[idxType] ?? '').trim()
          const startSerial = row[idxStart] as number
          const fravDager = Number(row[idxDager] ?? 0)

          if (!tekst || fravDager <= 0) continue
          antallRader++

          const kode = parseKode(tekst)
          const startDate = parseExcelDate(row[idxStart])
          if (!startDate) continue
          const period = toPeriodKey(startDate)

          if (!monthMap.has(period)) {
            monthMap.set(period, { selfCert: 0, sickLeave: 0 })
          }
          const entry = monthMap.get(period)!

          const endDate = new Date(startDate)
          endDate.setUTCDate(endDate.getUTCDate() + fravDager - 1)
          const toISODate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

          if (EGENMELDING_KODER.includes(kode)) {
            entry.selfCert += fravDager
            events.push({ id: `sap-${startSerial}-${kode}`, startDate: toISODate(startDate), endDate: toISODate(endDate), type: 'egenmelding', grade: 100, source: 'imported' })
          } else if (SYKEMELDING_KODER.includes(kode)) {
            entry.sickLeave += fravDager
            events.push({ id: `sap-${startSerial}-${kode}`, startDate: toISODate(startDate), endDate: toISODate(endDate), type: 'sykmelding', grade: 100, source: 'imported' })
          } else {
            ukjenteTyper.add(`${kode} ${tekst.split(' ').slice(1).join(' ')}`)
          }
        }

        const records: AbsenceRecord[] = [...monthMap.entries()].map(
          ([period, { selfCert, sickLeave }]) => ({
            period,
            selfCertDays: selfCert,
            sickLeaveDays: sickLeave,
          })
        )

        resolve({ records, events, antallRader, ukjenteTyper: [...ukjenteTyper] })
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(new Error('Kunne ikke lese filen'))
    reader.readAsArrayBuffer(file)
  })
}
