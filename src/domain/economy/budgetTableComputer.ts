import type {
  EmploymentProfile,
  BudgetTemplate,
  MonthRecord,
  ATFEntry,
  SavingsAccount,
  DebtAccount,
  SubscriptionEntry,
  InsuranceEntry,
} from '@/types/economy'
import { calculateHolidayPay } from './salaryCalculator'

// ----------------------------------------------------------------
// Public types
// ----------------------------------------------------------------

export interface MonthMeta {
  month: number   // 1–12
  isLocked: boolean
  hasSlip: boolean
}

export interface BudgetCell {
  budget: number
  actual: number | null  // null = no slip/locked data for this month
}

export interface BudgetRow {
  id: string
  label: string
  cells: BudgetCell[]  // 12 items, index 0 = January
  annualBudget: number
  annualActual: number  // uses actual where available, budget as fallback
}

export interface BudgetSection {
  key: string
  label: string
  colorClass: string
  dualColumn: boolean  // true = show Bud|Fak for slip months; false = always colspan=2
  rows: BudgetRow[]
}

export interface BudgetTableData {
  year: number
  metas: MonthMeta[]
  sections: BudgetSection[]
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function mkRow(id: string, label: string, cells: BudgetCell[]): BudgetRow {
  return {
    id,
    label,
    cells,
    annualBudget: cells.reduce((s, c) => s + c.budget, 0),
    annualActual: cells.reduce((s, c) => s + (c.actual ?? c.budget), 0),
  }
}

function uniform12(budgetFn: (m: number) => number, actualFn: (m: number) => number | null): BudgetCell[] {
  return Array.from({ length: 12 }, (_, i) => ({
    budget: budgetFn(i + 1),
    actual: actualFn(i + 1),
  }))
}

function subMonthAmount(sub: SubscriptionEntry, year: number, month: number): number {
  const key = `${year}-${String(month).padStart(2, '0')}`
  return sub.monthlyAmounts[key] ?? sub.defaultMonthly
}

function insMonthAmount(ins: InsuranceEntry, year: number): number {
  return (ins.yearlyAmounts[String(year)] ?? 0) / 12
}

// ----------------------------------------------------------------
// Main export
// ----------------------------------------------------------------

export function computeBudgetTable(
  year: number,
  profile: EmploymentProfile | null,
  budgetTemplate: BudgetTemplate,
  monthHistory: MonthRecord[],
  atfEntries: ATFEntry[],
  savingsAccounts: SavingsAccount[],
  debts: DebtAccount[],
  subscriptions: SubscriptionEntry[],
  insurances: InsuranceEntry[],
): BudgetTableData {

  // ---- Month lookup (locked months in this year) ----
  const monthMap = new Map<number, MonthRecord>()
  monthHistory.filter((m) => m.year === year).forEach((m) => monthMap.set(m.month, m))

  // ---- Metas ----
  const metas: MonthMeta[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const rec = monthMap.get(m)
    return { month: m, isLocked: rec?.isLocked ?? false, hasSlip: !!(rec?.slipData) }
  })

  // ---- Derived constants ----
  const atfSum = atfEntries.filter((e) => e.year === year).reduce((s, e) => s + e.beregnetBeløp, 0)
  const juneHoliday = profile
    ? calculateHolidayPay(profile.baseMonthly * 12, profile.baseMonthly * 12)
    : null

  // ================================================================
  // INNTEKTER (dualColumn = true)
  // ================================================================
  const inntekterRows: BudgetRow[] = []

  if (profile) {
    // Månedslønn
    inntekterRows.push(mkRow('lonn', 'Månedslønn', uniform12(
      () => profile.baseMonthly,
      (m) => monthMap.get(m)?.slipData?.maanedslonn ?? null,
    )))

    // Tillegg (fast, sum from profile.fixedAdditions)
    const tilleggBudget = profile.fixedAdditions.reduce((s, a) => s + a.amount, 0)
    if (tilleggBudget > 0 || [...monthMap.values()].some((r) => (r.slipData?.fasteTillegg.length ?? 0) > 0)) {
      inntekterRows.push(mkRow('tillegg', 'Tillegg (fast)', uniform12(
        () => tilleggBudget,
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? slip.fasteTillegg.reduce((s, t) => s + t.belop, 0) : null
        },
      )))
    }

    // Feriepenger (June only)
    if (juneHoliday) {
      inntekterRows.push(mkRow('feriepenger', 'Feriepenger (juni)', uniform12(
        (m) => (m === 6 ? juneHoliday.holidayPay : 0),
        () => null,
      )))
    }

    // ATF (December only)
    if (atfSum > 0) {
      inntekterRows.push(mkRow('atf', 'ATF-utbetaling (des)', uniform12(
        (m) => (m === 12 ? atfSum : 0),
        () => null,
      )))
    }
  }

  // Template income lines (annen_inntekt)
  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && l.category === 'annen_inntekt')) {
    inntekterRows.push(mkRow(`income-${line.id}`, line.label, uniform12(() => line.amount, () => null)))
  }

  // ================================================================
  // TREKK (dualColumn = true)
  // ================================================================
  const trekkRows: BudgetRow[] = []

  if (profile) {
    // Skattetrekk
    trekkRows.push(mkRow('skatt', 'Skattetrekk', uniform12(
      () => -profile.lastKnownTaxWithholding,
      (m) => {
        const slip = monthMap.get(m)?.slipData
        return slip ? -slip.skattetrekk : null
      },
    )))

    // Pensjonstrekk
    const pensjonBudget = -(profile.baseMonthly * profile.pensionPercent / 100)
    trekkRows.push(mkRow('pensjon', 'Pensjonstrekk SPK', uniform12(
      () => pensjonBudget,
      (m) => {
        const slip = monthMap.get(m)?.slipData
        return slip ? -slip.pensjonstrekk : null
      },
    )))

    // Fagforeningskontingent
    if (profile.unionFee > 0) {
      trekkRows.push(mkRow('fagforening', 'Fagforeningskontingent', uniform12(
        () => -profile.unionFee,
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? -slip.fagforeningskontingent : null
        },
      )))
    }

    // Husleietrekk
    if (profile.housingDeduction > 0) {
      trekkRows.push(mkRow('husleie', 'Husleietrekk', uniform12(
        () => -profile.housingDeduction,
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? -slip.husleietrekk : null
        },
      )))
    }

    // Ekstra forskuddstrekk
    if (profile.extraTaxWithholding > 0) {
      trekkRows.push(mkRow('ekstra', 'Ekstra forskuddstrekk', uniform12(
        () => -profile.extraTaxWithholding,
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? (slip.ekstraTrekk > 0 ? -slip.ekstraTrekk : 0) : null
        },
      )))
    }

    // OU-fond (only if present in any slip)
    if ([...monthMap.values()].some((r) => (r.slipData?.ouFond ?? 0) > 0)) {
      trekkRows.push(mkRow('oufond', 'OU-fond', uniform12(
        () => 0,
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? -slip.ouFond : null
        },
      )))
    }

    // Ferietrekk (June only)
    if (juneHoliday) {
      trekkRows.push(mkRow('ferietrekk', 'Ferietrekk (25 dager)', uniform12(
        (m) => (m === 6 ? -juneHoliday.holidayLeaveDeduction : 0),
        () => null,
      )))
    }
  }

  // ================================================================
  // NETTO (dualColumn = true)
  // ================================================================
  const nettoCells: BudgetCell[] = Array.from({ length: 12 }, (_, i) => {
    const inntektBudget = inntekterRows.reduce((s, r) => s + r.cells[i].budget, 0)
    const trekkBudget = trekkRows.reduce((s, r) => s + r.cells[i].budget, 0)
    const rec = monthMap.get(i + 1)
    return {
      budget: inntektBudget + trekkBudget,
      actual: rec?.nettoUtbetalt ?? null,
    }
  })
  const nettoRows: BudgetRow[] = [mkRow('netto', 'Netto utbetalt', nettoCells)]

  // ================================================================
  // FASTE UTGIFTER (dualColumn = false)
  // ================================================================
  const EXPENSE_CATS = new Set([
    'bolig', 'transport', 'mat', 'helse', 'abonnement', 'forsikring', 'klær', 'fritid', 'annet_forbruk',
  ])
  const fasteRows: BudgetRow[] = []

  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && EXPENSE_CATS.has(l.category) && !l.isVariable)) {
    fasteRows.push(mkRow(`exp-${line.id}`, line.label, Array.from({ length: 12 }, () => ({ budget: line.amount, actual: null }))))
  }

  const activeSubs = subscriptions.filter((s) => s.isActive)
  if (activeSubs.length > 0) {
    fasteRows.push(mkRow('abonnement-auto', 'Abonnement', Array.from({ length: 12 }, (_, i) => ({
      budget: -activeSubs.reduce((s, sub) => s + subMonthAmount(sub, year, i + 1), 0),
      actual: null,
    }))))
  }

  const activeIns = insurances.filter((ins) => ins.isActive)
  if (activeIns.length > 0) {
    fasteRows.push(mkRow('forsikring-auto', 'Forsikringer', Array.from({ length: 12 }, () => ({
      budget: -activeIns.reduce((s, ins) => s + insMonthAmount(ins, year), 0),
      actual: null,
    }))))
  }

  // ================================================================
  // VARIABLE UTGIFTER (dualColumn = false)
  // ================================================================
  const variableRows: BudgetRow[] = []
  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && EXPENSE_CATS.has(l.category) && l.isVariable)) {
    variableRows.push(mkRow(`var-${line.id}`, line.label, Array.from({ length: 12 }, () => ({ budget: line.amount, actual: null }))))
  }

  // ================================================================
  // GJELD (dualColumn = false)
  // ================================================================
  const gjeldRows: BudgetRow[] = []
  for (const debt of debts) {
    gjeldRows.push(mkRow(`debt-${debt.id}`, debt.creditor, Array.from({ length: 12 }, () => ({
      budget: -(debt.monthlyPayment + debt.termFee),
      actual: null,
    }))))
  }

  // ================================================================
  // SPARING (dualColumn = false)
  // ================================================================
  const sparingRows: BudgetRow[] = []
  const SAVINGS_CATS = new Set(['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'])

  for (const acc of savingsAccounts.filter((a) => a.monthlyContribution > 0)) {
    sparingRows.push(mkRow(`sav-${acc.id}`, acc.label, Array.from({ length: 12 }, () => ({
      budget: -acc.monthlyContribution,
      actual: null,
    }))))
  }

  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && SAVINGS_CATS.has(l.category))) {
    sparingRows.push(mkRow(`sav-t-${line.id}`, line.label, Array.from({ length: 12 }, () => ({ budget: line.amount, actual: null }))))
  }

  // ================================================================
  // DISPONIBELT (summary, dualColumn = true)
  // ================================================================
  const allExpenseRows = [...fasteRows, ...variableRows, ...gjeldRows, ...sparingRows]
  const disponibeltCells: BudgetCell[] = Array.from({ length: 12 }, (_, i) => {
    const expenseSum = allExpenseRows.reduce((s, r) => s + r.cells[i].budget, 0)
    const netto = nettoCells[i]
    return {
      budget: netto.budget + expenseSum,
      actual: netto.actual !== null ? netto.actual + expenseSum : null,
    }
  })

  // ================================================================
  // Assemble sections
  // ================================================================
  const sections: BudgetSection[] = []

  if (inntekterRows.length > 0) {
    sections.push({ key: 'INNTEKTER', label: 'Inntekter', colorClass: 'text-green-400', dualColumn: true, rows: inntekterRows })
  }
  if (trekkRows.length > 0) {
    sections.push({ key: 'TREKK', label: 'Trekk', colorClass: 'text-red-400', dualColumn: true, rows: trekkRows })
  }

  sections.push({ key: 'NETTO', label: 'Netto utbetalt', colorClass: 'text-foreground', dualColumn: true, rows: nettoRows })

  if (fasteRows.length > 0) {
    sections.push({ key: 'FASTE', label: 'Faste utgifter', colorClass: 'text-blue-400', dualColumn: false, rows: fasteRows })
  }
  if (variableRows.length > 0) {
    sections.push({ key: 'VARIABLE', label: 'Variable utgifter', colorClass: 'text-yellow-400', dualColumn: false, rows: variableRows })
  }
  if (gjeldRows.length > 0) {
    sections.push({ key: 'GJELD', label: 'Gjeld', colorClass: 'text-orange-400', dualColumn: false, rows: gjeldRows })
  }
  if (sparingRows.length > 0) {
    sections.push({ key: 'SPARING', label: 'Sparing', colorClass: 'text-purple-400', dualColumn: false, rows: sparingRows })
  }

  sections.push({ key: 'DISPONIBELT', label: 'Disponibelt', colorClass: 'text-foreground font-bold', dualColumn: true, rows: [mkRow('disponibelt', 'Disponibelt', disponibeltCells)] })

  return { year, metas, sections }
}
