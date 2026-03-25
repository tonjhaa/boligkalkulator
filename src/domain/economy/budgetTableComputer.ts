import type {
  EmploymentProfile,
  BudgetTemplate,
  MonthRecord,
  ATFEntry,
  SavingsAccount,
  DebtAccount,
  SubscriptionEntry,
  InsuranceEntry,
  TemporaryPayEntry,
  JuneForecast,
} from '@/types/economy'
import { estimateSalaryTrend, projectMonthlySalary } from './salaryCalculator'
import { computeMonthContributions } from './savingsCalculator'

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
  /** true = celler viser løpende YTD-sum, ikke månedlig beløp */
  isCumulative?: boolean
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
  /** Estimert årlig lønnsøkning (desimal). null = ikke nok data. */
  estimatedAnnualGrowthRate: number | null
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
  overrides: Record<string, number> = {},
  temporaryPayEntries: TemporaryPayEntry[] = [],
  juneForecast?: JuneForecast,
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

  // Override helper: use manual override if present, otherwise computed value
  function budgetVal(rowId: string, m: number, computed: number): number {
    return overrides[`${m}:${rowId}`] ?? computed
  }

  // ---- Lønnsutvikling ----
  const trend = estimateSalaryTrend(monthHistory)

  // Bygger opp fungering-oppslag per måned (1–12) for dette året
  const fungeringByMonth = new Map<number, TemporaryPayEntry>()
  for (const entry of temporaryPayEntries) {
    const from = new Date(entry.fromDate)
    const to = new Date(entry.toDate)
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(year, m - 1, 1)
      const monthEnd = new Date(year, m, 0)  // siste dag i måneden
      if (monthStart <= to && monthEnd >= from) {
        fungeringByMonth.set(m, entry)
      }
    }
  }

  // For prognose: bruk fremskrevet lønn basert på trend, eller fungering hvis aktiv
  const budgetSalary = (month: number): number => {
    if (!profile) return 0
    // Har vi slipp for denne måneden i budsjettåret, bruk faktisk lønn
    const slip = monthMap.get(month)?.slipData
    if (slip) return slip.maanedslonn
    // Midlertidig lønn (fungering) overstyrer prognose
    const fungering = fungeringByMonth.get(month)
    if (fungering) return fungering.maanedslonn
    return projectMonthlySalary(trend, year, month)
  }

  // ---- ATF: summer per utbetalingsmåned ----
  // Prioritet: 1) eksplisitt payoutMonth/payoutYear, 2) tilDateISO + 1 mnd, 3) desember fallback
  const atfByMonth = new Map<number, number>()
  for (const entry of atfEntries) {
    let payoutYear: number
    let payoutMonth: number
    if (entry.payoutMonth !== undefined && entry.payoutYear !== undefined) {
      payoutYear = entry.payoutYear
      payoutMonth = entry.payoutMonth
    } else if (entry.tilDateISO) {
      const til = new Date(entry.tilDateISO)
      const d = new Date(til.getFullYear(), til.getMonth() + 1, 1)
      payoutYear = d.getFullYear()
      payoutMonth = d.getMonth() + 1
    } else {
      payoutYear = entry.year
      payoutMonth = 12
    }
    if (payoutYear !== year) continue
    atfByMonth.set(payoutMonth, (atfByMonth.get(payoutMonth) ?? 0) + entry.beregnetBeløp)
  }

  // Bruk JuneForecast som eneste kilde til sannhet for feriepenger.
  // Alle tall i budsjett-juni speiler feriepengefanen.
  const juneHoliday = juneForecast
    ? {
        holidayPay: juneForecast.feriepenger,
        holidayLeaveDeduction: juneForecast.ferietrekk,
        netJune: juneForecast.nettoJuni,
        juneSkattetrekk: juneForecast.skattetrekk,
      }
    : null

  // ================================================================
  // INNTEKTER (dualColumn = true)
  // ================================================================
  const inntekterRows: BudgetRow[] = []

  if (profile) {
    // Månedslønn — fremskrevet per måned basert på trend (inkl. fungering)
    inntekterRows.push(mkRow('lonn', 'Månedslønn', uniform12(
      (m) => budgetVal('lonn', m, budgetSalary(m)),
      (m) => monthMap.get(m)?.slipData?.maanedslonn ?? null,
    )))

    // Tillegg — én rad per artskode fra profil (viser som på slippen)
    for (const addition of profile.fixedAdditions) {
      if (addition.amount <= 0) continue
      const rowId = `tillegg-${addition.kode}`
      inntekterRows.push(mkRow(rowId, `${addition.label} (${addition.kode})`, uniform12(
        (m) => budgetVal(rowId, m, addition.amount),
        (m) => {
          const slip = monthMap.get(m)?.slipData
          if (!slip) return null
          return slip.fasteTillegg.find((t) => t.artskode === addition.kode)?.belop ?? null
        },
      )))
    }

    // Feriepenger (June only)
    if (juneHoliday) {
      inntekterRows.push(mkRow('feriepenger', 'Feriepenger (juni)', uniform12(
        (m) => budgetVal('feriepenger', m, m === 6 ? juneHoliday.holidayPay : 0),
        () => null,
      )))
    }

    // ATF: plasser i korrekt utbetalingsmåned
    if (atfByMonth.size > 0) {
      inntekterRows.push(mkRow('atf', 'ATF-utbetaling', uniform12(
        (m) => budgetVal('atf', m, atfByMonth.get(m) ?? 0),
        () => null,
      )))
    }
  }

  // Template income lines (annen_inntekt)
  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && l.category === 'annen_inntekt')) {
    inntekterRows.push(mkRow(`income-${line.id}`, line.label, uniform12((m) => budgetVal(`income-${line.id}`, m, line.amount), () => null)))
  }

  // ================================================================
  // TREKK (dualColumn = true)
  // ================================================================
  const trekkRows: BudgetRow[] = []

  // Pensjonerbare artskoder fra SPK-regelverket (1162 = HTA-tillegg)
  // 10P2 (fungering) er variabel og ikke inkludert i budsjettbasen
  const PENSJONABLE_ARTSKODER = new Set(['1162'])
  const pensjonableTillegg = profile
    ? profile.fixedAdditions
        .filter((a) => PENSJONABLE_ARTSKODER.has(a.kode))
        .reduce((s, a) => s + a.amount, 0)
    : 0

  if (profile) {
    // Effektiv lønn per måned: inkluderer manuelle overrides, fungering og trend-prognose.
    const effectiveSalaryForMonth = (m: number) => budgetVal('lonn', m, budgetSalary(m))

    // Effektive faste tillegg per måned (inkl. manuelle overrides per tilleggslinje).
    // Disse inngår i /440-grunnlaget på slippen akkurat som lønn.
    const effectiveTilleggForMonth = (m: number) =>
      profile.fixedAdditions.reduce((s, a) => {
        if (a.amount <= 0) return s
        return s + budgetVal(`tillegg-${a.kode}`, m, a.amount)
      }, 0)

    // Effektivt /440-grunnlag = lønn + tillegg (samme som slippen)
    // Fallback-rate: bruker tabelltrekkBelop/tabelltrekkGrunnlag direkte fra siste slipp
    const effectiveTaxRate = profile.lastKnownTableTaxPercent != null && profile.lastKnownTableTaxPercent > 0
      ? profile.lastKnownTableTaxPercent / 100
      : (() => {
          // Estimat: lastKnownTaxWithholding delt på (lønn + tillegg) fra profilen
          const baseGrunnlag = budgetSalary(1) + profile.fixedAdditions.reduce((s, a) => s + Math.max(0, a.amount), 0)
          return baseGrunnlag > 0 ? profile.lastKnownTaxWithholding / baseGrunnlag : 0
        })()

    trekkRows.push(mkRow('skatt', 'Skattetrekk', uniform12(
      (m) => {
        const atfAmount = atfByMonth.get(m) ?? 0
        if (m === 6 && juneHoliday) {
          // Juni: bruk skattetrekk direkte fra JuneForecast (samme kilde som feriepengefanen)
          if ('juneSkattetrekk' in juneHoliday) {
            return budgetVal('skatt', m, -juneHoliday.juneSkattetrekk)
          }
        }
        // /440-grunnlag = lønn + faste tillegg + ATF (speiler slippen nøyaktig)
        const grunnlag = effectiveSalaryForMonth(m) + effectiveTilleggForMonth(m) + atfAmount
        return budgetVal('skatt', m, -Math.round(grunnlag * effectiveTaxRate))
      },
      (m) => {
        const slip = monthMap.get(m)?.slipData
        return slip ? -slip.skattetrekk : null
      },
    )))

    // Pensjonstrekk — 2% av (effektiv lønn inkl. override + pensjonerbare faste tillegg, f.eks. 1162 HTA)
    trekkRows.push(mkRow('pensjon', 'Pensjonstrekk SPK', uniform12(
      (m) => budgetVal('pensjon', m, -((effectiveSalaryForMonth(m) + pensjonableTillegg) * profile.pensionPercent / 100)),
      (m) => {
        const slip = monthMap.get(m)?.slipData
        return slip ? -slip.pensjonstrekk : null
      },
    )))

    // Fagforeningskontingent
    if (profile.unionFee > 0) {
      trekkRows.push(mkRow('fagforening', 'Fagforeningskontingent', uniform12(
        (m) => budgetVal('fagforening', m, -profile.unionFee),
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? -slip.fagforeningskontingent : null
        },
      )))
    }

    // Husleietrekk
    if (profile.housingDeduction > 0) {
      trekkRows.push(mkRow('husleie', 'Husleietrekk', uniform12(
        (m) => budgetVal('husleie', m, -profile.housingDeduction),
        (m) => {
          const slip = monthMap.get(m)?.slipData
          return slip ? -slip.husleietrekk : null
        },
      )))
    }

    // Ekstra forskuddstrekk
    if (profile.extraTaxWithholding > 0) {
      trekkRows.push(mkRow('ekstra', 'Ekstra forskuddstrekk', uniform12(
        (m) => budgetVal('ekstra', m, -profile.extraTaxWithholding),
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
        (m) => budgetVal('ferietrekk', m, m === 6 ? -juneHoliday.holidayLeaveDeduction : 0),
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
    fasteRows.push(mkRow(`exp-${line.id}`, line.label, uniform12((m) => budgetVal(`exp-${line.id}`, m, line.amount), () => null)))
  }

  const activeSubs = subscriptions.filter((s) => s.isActive)
  if (activeSubs.length > 0) {
    fasteRows.push(mkRow('abonnement-auto', 'Abonnement', uniform12(
      (m) => budgetVal('abonnement-auto', m, -activeSubs.reduce((s, sub) => s + subMonthAmount(sub, year, m), 0)),
      () => null,
    )))
  }

  const activeIns = insurances.filter((ins) => ins.isActive)
  if (activeIns.length > 0) {
    fasteRows.push(mkRow('forsikring-auto', 'Forsikringer', uniform12(
      (m) => budgetVal('forsikring-auto', m, -activeIns.reduce((s, ins) => s + insMonthAmount(ins, year), 0)),
      () => null,
    )))
  }

  // ================================================================
  // VARIABLE UTGIFTER (dualColumn = false)
  // ================================================================
  const variableRows: BudgetRow[] = []
  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && EXPENSE_CATS.has(l.category) && l.isVariable)) {
    variableRows.push(mkRow(`var-${line.id}`, line.label, uniform12((m) => budgetVal(`var-${line.id}`, m, line.amount), () => null)))
  }

  // ================================================================
  // GJELD (dualColumn = false)
  // ================================================================
  const gjeldRows: BudgetRow[] = []
  for (const debt of debts) {
    gjeldRows.push(mkRow(`debt-${debt.id}`, debt.creditor, uniform12(
      (m) => budgetVal(`debt-${debt.id}`, m, -(debt.monthlyPayment + debt.termFee)),
      () => null,
    )))
  }

  // ================================================================
  // SPARING (dualColumn = false)
  // ================================================================
  const sparingRows: BudgetRow[] = []
  const SAVINGS_CATS = new Set(['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'])

  for (const acc of savingsAccounts.filter((a) => a.monthlyContribution > 0 || (a.contributions ?? []).length > 0)) {
    sparingRows.push(mkRow(`sav-${acc.id}`, acc.label, uniform12(
      (m) => budgetVal(`sav-${acc.id}`, m, -acc.monthlyContribution),
      (m) => {
        const actual = computeMonthContributions(acc, year, m)
        return actual > 0 ? -actual : null
      },
    )))
  }

  for (const line of budgetTemplate.lines.filter((l) => l.isRecurring && SAVINGS_CATS.has(l.category))) {
    sparingRows.push(mkRow(`sav-t-${line.id}`, line.label, uniform12((m) => budgetVal(`sav-t-${line.id}`, m, line.amount), () => null)))
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
    sections.push({ key: 'SPARING', label: 'Sparing', colorClass: 'text-purple-400', dualColumn: true, rows: sparingRows })
  }

  sections.push({ key: 'DISPONIBELT', label: 'Disponibelt', colorClass: 'text-foreground font-bold', dualColumn: true, rows: [mkRow('disponibelt', 'Disponibelt', disponibeltCells)] })

  // ================================================================
  // ÅRSOPPSUMMERING — løpende YTD-totaler (kun når profil er satt)
  // ================================================================
  if (profile) {
    const allTillegg = profile.fixedAdditions.reduce((s, a) => s + a.amount, 0)

    // YTD brutto: lønn + alle faste tillegg + ATF (samme som hittilBrutto på slippen)
    const ytdBruttoCells: BudgetCell[] = []
    let ytdBruttoBudget = 0
    for (let i = 0; i < 12; i++) {
      const m = i + 1
      const slip = monthMap.get(m)?.slipData
      ytdBruttoBudget += budgetSalary(m) + allTillegg + (atfByMonth.get(m) ?? 0)
      ytdBruttoCells.push({ budget: ytdBruttoBudget, actual: slip?.hittilBrutto ?? null })
    }

    // YTD feriepengegrunnlag: lønn + pensjonerbare tillegg, ingen ATF (samme som feriepengegrunnlag på slippen)
    const ytdFerieCells: BudgetCell[] = []
    let ytdFerieBudget = 0
    for (let i = 0; i < 12; i++) {
      const m = i + 1
      const slip = monthMap.get(m)?.slipData
      ytdFerieBudget += budgetSalary(m) + pensjonableTillegg
      ytdFerieCells.push({ budget: ytdFerieBudget, actual: slip?.feriepengegrunnlag ?? null })
    }

    sections.push({
      key: 'OPPSUMMERING',
      label: 'Årsoppsummering',
      colorClass: 'text-muted-foreground',
      dualColumn: true,
      rows: [
        {
          id: 'ytd-brutto',
          label: 'Brutto lønn hittil',
          cells: ytdBruttoCells,
          annualBudget: ytdBruttoCells[11].budget,
          annualActual: ytdBruttoCells[11].actual ?? ytdBruttoCells[11].budget,
          isCumulative: true,
        },
        {
          id: 'ytd-ferie',
          label: 'Feriepengegrunnlag hittil',
          cells: ytdFerieCells,
          annualBudget: ytdFerieCells[11].budget,
          annualActual: ytdFerieCells[11].actual ?? ytdFerieCells[11].budget,
          isCumulative: true,
        },
      ],
    })
  }

  return { year, metas, sections, estimatedAnnualGrowthRate: trend.annualGrowthRate }
}
