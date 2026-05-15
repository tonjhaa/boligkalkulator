import type { ParsetLonnsslipp } from '@/types/economy'

/**
 * Parser norsk beløp: "55.844,40" → 55844.40, "1.150,80-" → -1150.80
 */
function parseNOK(s: string): number {
  const neg = s.endsWith('-')
  const clean = s.replace(/-$/, '').replace(/\./g, '').replace(',', '.')
  const val = parseFloat(clean)
  return isNaN(val) ? 0 : neg ? -val : val
}

const NOK_TOKEN = /\d{1,3}(?:\.\d{3})*,\d{2}-?/g

function findNOKAmounts(s: string): string[] {
  return s.match(NOK_TOKEN) ?? []
}

const MONTH_NAMES: Record<string, number> = {
  januar: 1, februar: 2, mars: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, desember: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7,
  oct: 10, december: 12,
}

function parsePeriod(text: string): { year: number; month: number } {
  const today = new Date()
  let year = today.getFullYear()
  let month = today.getMonth() + 1

  // "Januar 2026", "Lønnsperiode: Januar 2026", "Periode: 01.2026"
  const monthYear = text.match(/\b(\w{3,10})\s+(20\d{2})\b/i)
  if (monthYear) {
    const mn = MONTH_NAMES[monthYear[1].toLowerCase()]
    if (mn) {
      month = mn
      year = parseInt(monthYear[2], 10)
      return { year, month }
    }
  }

  // "01/2026", "01.2026", "01-2026"
  const numPeriod = text.match(/\b(0?[1-9]|1[0-2])[/.\-](20\d{2})\b/)
  if (numPeriod) {
    month = parseInt(numPeriod[1], 10)
    year = parseInt(numPeriod[2], 10)
    return { year, month }
  }

  // "2026-01"
  const isoMonth = text.match(/\b(20\d{2})-(0?[1-9]|1[0-2])\b/)
  if (isoMonth) {
    year = parseInt(isoMonth[1], 10)
    month = parseInt(isoMonth[2], 10)
    return { year, month }
  }

  // "01.26", "01/26"
  const shortYear = text.match(/\b(0?[1-9]|1[0-2])[./](2\d)\b/)
  if (shortYear) {
    month = parseInt(shortYear[1], 10)
    year = 2000 + parseInt(shortYear[2], 10)
    return { year, month }
  }

  return { year, month }
}

/**
 * Finner beløp etter et nøkkelord (caseinsensitiv, første NOK-beløp på linjen eller neste linje)
 */
function findAmountAfterKeyword(lines: string[], keywords: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    const matched = keywords.some((kw) => lower.includes(kw.toLowerCase()))
    if (!matched) continue

    // Sjekk gjeldende linje
    const amounts = findNOKAmounts(lines[i])
    if (amounts.length > 0) {
      return Math.abs(parseNOK(amounts[amounts.length - 1]))
    }

    // Sjekk neste linje
    if (i + 1 < lines.length) {
      const nextAmounts = findNOKAmounts(lines[i + 1])
      if (nextAmounts.length > 0) {
        return Math.abs(parseNOK(nextAmounts[0]))
      }
    }
  }
  return 0
}

/**
 * Generisk parser for norske lønnsslipper (Visma, SAP, Huldt & Lillevik, Tripletex, m.fl.)
 *
 * Prøver å hente ut: periode, bruttolønn, skattetrekk, pensjonstrekk, netto utbetalt,
 * feriepengegrunnlag, og fagforeningskontingent.
 */
export function parseGenericSlipp(pdfText: string): ParsetLonnsslipp {
  const lines = pdfText.split('\n').map((l) => l.trim()).filter(Boolean)

  const periode = parsePeriod(pdfText)

  // Bruttolønn
  const maanedslonn = findAmountAfterKeyword(lines, [
    'grunnlønn', 'fastlønn', 'grunnlonn', 'fastlonn',
    'månedsl', 'manedslonn', 'maanedslonn',
    'lønn per måned', 'grunnloenn',
  ])

  const bruttoRaw = findAmountAfterKeyword(lines, [
    'bruttolønn', 'brutto lønn', 'bruttolonn', 'brutto lonn',
    'sum lønn', 'sum lonn', 'brutto grunnlag', 'sum grunnlag',
    'bruttoinntekt',
  ])

  const bruttoSum = bruttoRaw || maanedslonn

  // Skattetrekk
  const skattetrekk = findAmountAfterKeyword(lines, [
    'skattetrekk', 'forskuddstrekk', 'trekk skatt', 'skatt',
    'skatetrekk', 'forskudstrekk',
  ])

  // Pensjonstrekk
  const pensjonstrekk = findAmountAfterKeyword(lines, [
    'pensjonstrekk', 'tjenestepensjon', 'pensjonspremie',
    'innskuddspensjon', 'pensjon trekk', 'pensjonskasse',
  ])

  // Fagforeningskontingent
  const fagforeningskontingent = findAmountAfterKeyword(lines, [
    'fagforeningskontingent', 'fagforening', 'kontingent',
    'forbundskontingent',
  ])

  // Netto utbetalt
  const nettoUtbetalt = findAmountAfterKeyword(lines, [
    'netto til utbetaling', 'netto utbetalt', 'utbetalt beløp',
    'til utbetaling', 'netto beløp', 'nettobeløp', 'nettoutbetaling',
    'utbetaling', 'netto lønn',
  ]) || (bruttoSum > 0
    ? bruttoSum - skattetrekk - pensjonstrekk - fagforeningskontingent
    : 0)

  // Feriepengegrunnlag
  const feriepengegrunnlag = findAmountAfterKeyword(lines, [
    'feriepengegrunnlag', 'grunnlag feriepenger', 'feriegrunnlag',
    'trekkgrunnlag ferie', 'ferie grunnlag',
  ])

  return {
    periode,
    ansattnummer: '',
    loennstrinn: 0,
    maanedslonn,
    fasteTillegg: [],
    trekk: [],
    bruttoSum,
    nettoUtbetalt,
    feriepengegrunnlag,
    opptjentFerie: 0,
    skattetrekk,
    ekstraTrekk: 0,
    husleietrekk: 0,
    pensjonstrekk,
    fagforeningskontingent,
    ouFond: 0,
    gruppelivspremie: 0,
    hittilBrutto: 0,
    hittilPensjon: 0,
    hittilForskuddstrekk: 0,
    tabelltrekkGrunnlag: 0,
    tabelltrekkBelop: skattetrekk,
    tabellnummer: undefined,
  }
}

/**
 * Enkel heuristikk for å avgjøre om teksten er en Forsvaret-lønnsslipp.
 * Forsvaret bruker artskoder (f.eks. "1S01", "/440", "7000") og "Lønnsavregning for".
 */
export function isForsvarsSlipp(pdfText: string): boolean {
  const hasLonnsavregning = /lønnsavregning\s+for/i.test(pdfText)
  const hasArtskode = /\b(1S01|1001|\/440|\/441|7000|2230|2232|10P2)\b/.test(pdfText)
  const hasSPENN = /\bSPENN\b/.test(pdfText)
  return hasLonnsavregning || (hasArtskode && hasSPENN)
}
