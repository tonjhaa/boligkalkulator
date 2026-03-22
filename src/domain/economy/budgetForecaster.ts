import type {
  BudgetTemplate,
  MonthRecord,
  BudgetLine,
  EmploymentProfile,
  ATFEntry,
} from '@/types/economy'
import { calculateHolidayPay } from './salaryCalculator'

// ------------------------------------------------------------
// KOPIÉR BUDSJETTMAL TIL NY MÅNED
// ------------------------------------------------------------

/**
 * Oppretter en ny MonthRecord fra budsjettmalen.
 * - Låste poster beholdes
 * - Manuelle poster kopieres
 * - Engangsposter (isRecurring=false) kopieres IKKE
 */
export function createMonthFromTemplate(
  template: BudgetTemplate,
  year: number,
  month: number
): MonthRecord {
  const lines: BudgetLine[] = template.lines
    .filter((l) => l.isRecurring)
    .map((l) => ({
      ...l,
      id: crypto.randomUUID(),
      isLocked: false,
      source: 'auto' as const,
    }))

  const nettoUtbetalt = calcNettoUtbetalt(lines)
  const disposable = calcDisposable(lines)

  return {
    year,
    month,
    isLocked: false,
    source: 'forecast',
    lines,
    nettoUtbetalt,
    disposable,
  }
}

// ------------------------------------------------------------
// FREMSKRIV HELE ÅR
// ------------------------------------------------------------

/**
 * Fremskriver alle 12 måneder for et år.
 * - Inkluderer korrekt juni-beregning (feriepenger)
 * - Inkluderer ATF-utbetalinger der de er registrert
 */
export function forecastYear(
  profile: EmploymentProfile,
  template: BudgetTemplate,
  atfEntries: ATFEntry[],
  year: number
): MonthRecord[] {
  const months: MonthRecord[] = []

  for (let month = 1; month <= 12; month++) {
    const base = createMonthFromTemplate(template, year, month)

    // Juni: legg til feriepenger, trekk ferietrekk
    if (month === 6) {
      base.lines = applyJuneAdjustment(base.lines, profile, year)
    }

    // Desember: legg til ATF-utbetaling
    if (month === 12) {
      const atfSum = atfEntries
        .filter((e) => e.year === year)
        .reduce((s, e) => s + e.beregnetBeløp, 0)
      if (atfSum > 0) {
        base.lines.push({
          id: crypto.randomUUID(),
          label: `ATF-utbetaling ${year}`,
          category: 'atf',
          amount: atfSum,
          isRecurring: false,
          source: 'auto',
          isLocked: false,
          isVariable: false,
        })
      }
    }

    base.nettoUtbetalt = calcNettoUtbetalt(base.lines)
    base.disposable = calcDisposable(base.lines)
    months.push(base)
  }

  return months
}

// ------------------------------------------------------------
// HJELPERE
// ------------------------------------------------------------

function applyJuneAdjustment(
  lines: BudgetLine[],
  profile: EmploymentProfile,
  _year: number
): BudgetLine[] {
  const annualSalary = profile.baseMonthly * 12
  // Feriepengegrunnlag: estimert fra årslønn (ideelt fra desember-slipp)
  const basis = annualSalary
  const { holidayPay, holidayLeaveDeduction } = calculateHolidayPay(basis, annualSalary)

  const updated = [...lines]

  // Legg til feriepenge-linje
  updated.push({
    id: crypto.randomUUID(),
    label: 'Feriepenger',
    category: 'feriepenger',
    amount: holidayPay,
    isRecurring: false,
    source: 'auto',
    isLocked: false,
    isVariable: false,
  })

  // Trekk ferietrekk
  updated.push({
    id: crypto.randomUUID(),
    label: 'Ferietrekk (25 virkedager)',
    category: 'skatt',
    amount: -holidayLeaveDeduction,
    isRecurring: false,
    source: 'auto',
    isLocked: false,
    isVariable: false,
  })

  return updated
}

const INCOME_CATEGORIES = new Set([
  'lonn', 'tillegg', 'atf', 'feriepenger', 'annen_inntekt',
])

function calcNettoUtbetalt(lines: BudgetLine[]): number {
  return lines
    .filter((l) => INCOME_CATEGORIES.has(l.category))
    .reduce((s, l) => s + l.amount, 0)
}

function calcDisposable(lines: BudgetLine[]): number {
  return lines.reduce((s, l) => s + l.amount, 0)
}
