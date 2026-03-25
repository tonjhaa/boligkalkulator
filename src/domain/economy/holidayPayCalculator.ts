import type {
  MonthRecord,
  EmploymentProfile,
  ATFEntry,
  JuneForecast,
  AccruedHolidayBase,
} from '@/types/economy'
import {
  FERIEPENGER_PROSENT,
  FERIEDAGER_TREKK,
  FERIETREKK_DIVISOR,
} from '@/config/economy.config'
import { estimateSalaryTrend, projectMonthlySalary } from './salaryCalculator'

// ------------------------------------------------------------
// OPPTJENING
// ------------------------------------------------------------

/**
 * Beregner opptjent feriepengegrunnlag for et gitt år.
 *
 * Desember-slippen inneholder det akkumulerte grunnlaget for hele året,
 * og er den mest presise kilden. Uten den summeres bruttoSum fra
 * tilgjengelige slipper og estimeres for manglende måneder.
 */
export function calculateAccruedHolidayBase(
  year: number,
  monthHistory: MonthRecord[],
  profile: EmploymentProfile,
): AccruedHolidayBase {
  // Desember-slipp: akkumulert feriepengegrunnlag for hele året
  const decRecord = monthHistory.find(
    (r) => r.year === year && r.month === 12 && (r.slipData?.feriepengegrunnlag ?? 0) > 0,
  )
  if (decRecord?.slipData?.feriepengegrunnlag) {
    const monthsWithSlip = monthHistory.filter(
      (r) => r.year === year && r.slipData != null,
    ).length
    return {
      actual: decRecord.slipData.feriepengegrunnlag,
      projected: 0,
      total: decRecord.slipData.feriepengegrunnlag,
      monthsWithSlip,
    }
  }

  const monthlyBase =
    profile.baseMonthly +
    (profile.fixedAdditions?.reduce((s, a) => s + a.amount, 0) ?? 0)

  let actual = 0
  let projected = 0
  let monthsWithSlip = 0

  for (let month = 1; month <= 12; month++) {
    const record = monthHistory.find((r) => r.year === year && r.month === month)
    if (record?.slipData) {
      actual += record.slipData.bruttoSum
      monthsWithSlip++
    } else {
      projected += monthlyBase
    }
  }

  return { actual, projected, total: actual + projected, monthsWithSlip }
}

// ------------------------------------------------------------
// HJELPERE
// ------------------------------------------------------------

function getMonthlyFixedAdditions(profile: EmploymentProfile): number {
  return profile.fixedAdditions?.reduce((s, a) => s + a.amount, 0) ?? 0
}

/** Sum ATF-linjer registrert på juni for gitt år. */
function getJuneATF(year: number, monthHistory: MonthRecord[]): number {
  const juneRecord = monthHistory.find((r) => r.year === year && r.month === 6)
  if (!juneRecord) return 0
  return juneRecord.lines
    .filter((l) => l.category === 'atf')
    .reduce((s, l) => s + l.amount, 0)
}

// ------------------------------------------------------------
// PROGNOSE FOR ENKELT-JUNI
// ------------------------------------------------------------

/**
 * Beregner estimert juni-utbetaling for et gitt år.
 *
 * Feriepengegrunnlaget hentes fra forrige års desember-slipp hvis tilgjengelig,
 * ellers estimeres det fra importerte slipper + profil.
 */
export function forecastJune(
  year: number,
  monthHistory: MonthRecord[],
  profile: EmploymentProfile,
  _atfEntries: ATFEntry[] = [],
): JuneForecast {
  // --- FERIEPENGEGRUNNLAG (opptjent forrige år) ---
  const prevDecRecord = monthHistory.find(
    (r) =>
      r.year === year - 1 &&
      r.month === 12 &&
      (r.slipData?.feriepengegrunnlag ?? 0) > 0,
  )

  let feriepengegrunnlag: number
  let grunnlagKilde: string

  if (prevDecRecord?.slipData?.feriepengegrunnlag) {
    feriepengegrunnlag = prevDecRecord.slipData.feriepengegrunnlag
    grunnlagKilde = `Slipp des ${year - 1}`
  } else {
    const prevBase = calculateAccruedHolidayBase(year - 1, monthHistory, profile)
    feriepengegrunnlag = prevBase.total
    grunnlagKilde = `Estimert (${prevBase.monthsWithSlip}/12 slipper)`
  }

  const feriepenger = Math.round(feriepengegrunnlag * FERIEPENGER_PROSENT)

  // --- ÅRSLØNN I JUNI ---
  const juneSlip = monthHistory.find(
    (r) => r.year === year && r.month === 6 && r.slipData != null,
  )
  // Bruk fremskrevet lønn for måneder vi ikke har slipp for (steg-funksjon fra mai)
  const trend = estimateSalaryTrend(monthHistory)
  const projectedJune = projectMonthlySalary(trend, year, 6)
  const juneMaanedslonn = juneSlip?.slipData?.maanedslonn ?? (projectedJune > 0 ? projectedJune : profile.baseMonthly)
  const juneFixedTillegg = getMonthlyFixedAdditions(profile)
  const juneArslonn = juneMaanedslonn * 12
  const juneFasteTilleggAar = juneFixedTillegg * 12

  const ferietrekkDagsats = Math.round((juneArslonn + juneFasteTilleggAar) / FERIETREKK_DIVISOR)
  const ferietrekk = ferietrekkDagsats * FERIEDAGER_TREKK

  // --- SKATTEPLIKTIG OG SKATTEGRUNNLAG ---
  const skattepliktigJuni = juneMaanedslonn + juneFixedTillegg
  const juneATF = getJuneATF(year, monthHistory)
  const skattegrunnlag = Math.max(0, skattepliktigJuni + juneATF - ferietrekk)

  // Utleder effektiv skatteprosent fra profil (kr/mnd → prosent)
  const taxPercent =
    skattepliktigJuni > 0
      ? Math.min(60, Math.round((profile.lastKnownTaxWithholding / skattepliktigJuni) * 100))
      : 44
  const skattetrekk =
    skattegrunnlag > 0 ? Math.round(skattegrunnlag * (taxPercent / 100)) : 0

  // --- ANDRE TREKK ---
  const pensjonstrekk =
    juneSlip?.slipData?.pensjonstrekk ??
    Math.round(skattepliktigJuni * (profile.pensionPercent / 100))
  const fagforening =
    juneSlip?.slipData?.fagforeningskontingent ?? profile.unionFee
  const husleie =
    juneSlip?.slipData?.husleietrekk ?? profile.housingDeduction
  const ouFond = juneSlip?.slipData?.ouFond ?? 33
  const ekstraTrekk =
    juneSlip?.slipData?.ekstraTrekk ?? profile.extraTaxWithholding
  const andreJuneTrekk = pensjonstrekk + fagforening + husleie + ouFond + ekstraTrekk

  // --- NETTO ---
  const nettoJuni =
    skattepliktigJuni + feriepenger - ferietrekk - skattetrekk - andreJuneTrekk

  // --- KONFIDENSGRAD ---
  const hasLastDecSlip = !!prevDecRecord
  const hasJuneSlip = !!juneSlip
  const confidence: 'høy' | 'middels' | 'lav' =
    hasLastDecSlip && hasJuneSlip ? 'høy' : hasLastDecSlip ? 'middels' : 'lav'

  return {
    year,
    feriepengegrunnlag,
    feriepenger,
    ferietrekkDagsats,
    ferietrekk,
    skattepliktigJuni,
    juneATF,
    skattegrunnlag,
    skattetrekk,
    andreJuneTrekk,
    nettoJuni,
    nettoEkstra: feriepenger - ferietrekk,
    confidence,
    kilder: {
      feriepengegrunnlag: grunnlagKilde,
      juneLonn: hasJuneSlip ? `Slipp jun ${year}` : 'Estimert fra lønnsprofil',
    },
  }
}

// ------------------------------------------------------------
// PROGNOSE FOR ALLE FREMTIDIGE JUNIER
// ------------------------------------------------------------

export function forecastAllJunes(
  currentYear: number,
  monthHistory: MonthRecord[],
  profile: EmploymentProfile,
  atfEntries: ATFEntry[] = [],
  yearsAhead = 5,
): JuneForecast[] {
  const forecasts: JuneForecast[] = []
  for (let year = currentYear; year <= currentYear + yearsAhead; year++) {
    forecasts.push(forecastJune(year, monthHistory, profile, atfEntries))
  }
  return forecasts
}
