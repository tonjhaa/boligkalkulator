import type {
  SavingsAccount,
  SavingsGoal,
  BSUStatus,
  GoalProgress,
  BalanceHistoryEntry,
  RateHistoryEntry,
} from '@/types/economy'
import { BSU_MAX_YEARLY, BSU_MAX_TOTAL } from '@/config/economy.config'

// ------------------------------------------------------------
// INNSKUDDS-HJELPERE
// ------------------------------------------------------------

/**
 * Estimert gjennomsnittlig månedsinnskudd basert på siste 12 måneders innskudd.
 * Faller tilbake på account.monthlyContribution hvis ingen innskudd er registrert.
 */
export function computeMonthlyContributionEstimate(account: SavingsAccount): number {
  const contribs = account.contributions ?? []
  if (contribs.length === 0) return account.monthlyContribution

  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 12, 1)
  const recent = contribs.filter((c) => new Date(c.date) >= cutoff)
  if (recent.length === 0) return account.monthlyContribution

  const total = recent.reduce((s, c) => s + c.amount, 0)
  return Math.round(total / 12)
}

/**
 * Sum av innskudd for et gitt år.
 */
export function computeYTDContributions(account: SavingsAccount, year: number): number {
  return (account.contributions ?? [])
    .filter((c) => new Date(c.date).getFullYear() === year)
    .reduce((s, c) => s + c.amount, 0)
}

/**
 * Sum av innskudd for en gitt måned (year + month).
 */
export function computeMonthContributions(account: SavingsAccount, year: number, month: number): number {
  return (account.contributions ?? [])
    .filter((c) => {
      const d = new Date(c.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
    .reduce((s, c) => s + c.amount, 0)
}

/**
 * Estimert dato for å nå targetBalance gitt nåværende saldo og estimert månedssparing.
 * Returnerer null hvis saldo allerede er nådd eller månedssparing = 0.
 */
export function computeETA(account: SavingsAccount, targetBalance: number): string | null {
  const currentBalance = account.balanceHistory.at(-1)?.balance ?? account.openingBalance
  if (currentBalance >= targetBalance) return null

  const monthly = computeMonthlyContributionEstimate(account)
  if (monthly <= 0) return null

  const remaining = targetBalance - currentBalance
  const months = Math.ceil(remaining / monthly)

  const eta = new Date()
  eta.setMonth(eta.getMonth() + months)
  return eta.toLocaleDateString('no-NO', { year: 'numeric', month: 'long' })
}

// ------------------------------------------------------------
// HJELPEFUNKSJONER
// ------------------------------------------------------------

/** Henter gjeldende rentesats for en dato fra rateHistory */
function getCurrentRateForDate(rateHistory: RateHistoryEntry[], date: Date): number {
  if (rateHistory.length === 0) return 0
  const sorted = [...rateHistory].sort(
    (a, b) => new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime()
  )
  let rate = sorted[0].rate
  for (const entry of sorted) {
    if (new Date(entry.fromDate) <= date) {
      rate = entry.rate
    } else {
      break
    }
  }
  return rate
}

/** Konverterer year/month til en Date (første dag i måneden) */
function toDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}

/** Finner faktisk saldo fra balanceHistory for en gitt måned */
function getActualBalance(
  account: SavingsAccount,
  year: number,
  month: number
): number | null {
  const entry = account.balanceHistory.find(
    (b) => b.year === year && b.month === month
  )
  return entry?.balance ?? null
}

// ------------------------------------------------------------
// SPAREPROGNOSER
// ------------------------------------------------------------

/**
 * Beregner månedlige saldoer fra openingDate til toMonth.
 *
 * - Fond/krypto: bruker faktisk balanceHistory (manuelt tastet inn)
 * - BSU: rente krediteres én gang per år (31. desember)
 * - Andre: månedlig renteberegning
 */
export function projectSavingsGrowth(
  account: SavingsAccount,
  toMonth: { year: number; month: number }
): number[] {
  const openingDate = new Date(account.openingDate)
  const startYear = openingDate.getFullYear()
  const startMonth = openingDate.getMonth() + 1

  const results: number[] = []
  let currentBalance = account.openingBalance
  let yearlyInterestAccrued = 0

  let y = startYear
  let m = startMonth

  while (y < toMonth.year || (y === toMonth.year && m <= toMonth.month)) {
    const date = toDate(y, m)

    // Legg til månedlig innskudd (BSU maks 27 500/år)
    let contribution = account.monthlyContribution
    if (account.type === 'BSU') {
      const yearContrib = results.length > 0
        ? Math.min(account.monthlyContribution, (BSU_MAX_YEARLY) / 12)
        : Math.min(account.monthlyContribution, (BSU_MAX_YEARLY) / 12)
      contribution = currentBalance >= BSU_MAX_TOTAL ? 0 : yearContrib
    }

    // Sjekk for uttak denne måneden
    const withdrawalThisMonth = account.withdrawals
      .filter((w) => {
        const d = new Date(w.date)
        return d.getFullYear() === y && d.getMonth() + 1 === m
      })
      .reduce((s, w) => s + w.amount, 0)

    // Faktisk saldo har forrang for fond/krypto
    const actualBalance = getActualBalance(account, y, m)
    if (
      actualBalance !== null &&
      (account.type === 'fond' || account.type === 'krypto')
    ) {
      currentBalance = actualBalance
      results.push(currentBalance)
      advanceMonth()
      continue
    }

    currentBalance += contribution + withdrawalThisMonth

    const rate = getCurrentRateForDate(account.rateHistory, date)
    const monthlyRate = rate / 100 / 12

    if (account.interestCreditFrequency === 'yearly') {
      // BSU: akkumuler rente, kreditér 31. desember
      yearlyInterestAccrued += currentBalance * monthlyRate
      if (m === 12) {
        currentBalance += yearlyInterestAccrued
        yearlyInterestAccrued = 0
      }
    } else {
      currentBalance += currentBalance * monthlyRate
    }

    // BSU-tak
    if (account.type === 'BSU' && currentBalance > BSU_MAX_TOTAL) {
      currentBalance = BSU_MAX_TOTAL
    }

    results.push(Math.round(currentBalance))
    advanceMonth()
  }

  function advanceMonth() {
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  return results
}

// ------------------------------------------------------------
// SPAREMÅL
// ------------------------------------------------------------

export function calculateGoalProgress(
  goal: SavingsGoal,
  accounts: SavingsAccount[],
  fondCurrentValue = 0,
  fondMonthlyDeposit = 0,
): GoalProgress {
  const linked = accounts.filter((a) => goal.linkedAccountIds.includes(a.id))

  const accountsTotal = linked.reduce((s, a) => {
    const last = a.balanceHistory.at(-1)
    if (last) return s + last.balance
    return s + a.openingBalance
  }, 0)

  const currentTotal = accountsTotal + (goal.includeFond ? fondCurrentValue : 0)

  const percent = Math.min(100, (currentTotal / goal.targetAmount) * 100)
  const remaining = goal.targetAmount - currentTotal

  if (remaining <= 0) {
    return { currentTotal, targetAmount: goal.targetAmount, percent: 100, monthsRemaining: 0, monthlyNeeded: 0 }
  }

  const totalMonthlyContrib =
    linked.reduce((s, a) => s + a.monthlyContribution, 0) +
    (goal.includeFond ? fondMonthlyDeposit : 0)

  let monthsRemaining: number | null = null
  let monthlyNeeded: number | null = null

  if (goal.targetDate) {
    const target = new Date(goal.targetDate)
    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    monthsRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
    monthlyNeeded = monthsRemaining > 0 ? remaining / monthsRemaining : null
  } else if (totalMonthlyContrib > 0) {
    monthsRemaining = Math.ceil(remaining / totalMonthlyContrib)
    monthlyNeeded = totalMonthlyContrib
  }

  return { currentTotal, targetAmount: goal.targetAmount, percent, monthsRemaining, monthlyNeeded }
}

// ------------------------------------------------------------
// RENTEINNTEKTER FOR ET ÅR
// ------------------------------------------------------------

/**
 * Beregner renteinntekter for en sparekonto i et gitt år.
 *
 * - BSU: renter akkumuleres månedlig, krediteres 31. desember (eller vises opptjent for inneværende år)
 * - Andre kontoer: renter krediteres og legges til saldo månedlig
 *
 * Bruker rateHistory for riktig rente per periode.
 */
export function computeYearlyInterestIncome(account: SavingsAccount, year: number): number {
  // Startbalanse: siste kjente saldo FØR dette året
  const prevEntry = [...account.balanceHistory]
    .filter((b) => b.year < year || (b.year === year && b.month === 0))
    .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0]
  let balance = prevEntry?.balance ?? account.openingBalance

  const now = new Date()
  const toMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1

  let totalInterest = 0
  let yearlyAccrued = 0

  for (let m = 1; m <= toMonth; m++) {
    // For fond/krypto: bruk faktisk saldo fra historikk hvis tilgjengelig
    if (account.type === 'fond' || account.type === 'krypto') {
      const entry = account.balanceHistory.find((b) => b.year === year && b.month === m)
      if (entry) { balance = entry.balance; continue }
    }

    // Legg til innskudd denne måneden
    const contrib = computeMonthContributions(account, year, m)
    balance += contrib

    const date = new Date(year, m - 1, 1)
    const rate = getCurrentRateForDate(account.rateHistory, date)
    const monthlyInterest = balance * (rate / 100 / 12)

    if (account.interestCreditFrequency === 'yearly') {
      yearlyAccrued += monthlyInterest
      if (m === 12) {
        totalInterest += yearlyAccrued
        balance += yearlyAccrued
        yearlyAccrued = 0
      }
    } else {
      totalInterest += monthlyInterest
      balance += monthlyInterest
    }
  }

  // Inneværende år med BSU: returner opptjent (ikke kreditert ennå)
  if (account.interestCreditFrequency === 'yearly' && year === now.getFullYear()) {
    return Math.round(yearlyAccrued)
  }

  return Math.round(totalInterest)
}

// ------------------------------------------------------------
// BSU-KONTROLL
// ------------------------------------------------------------

export function checkBSULimits(account: SavingsAccount, year: number): BSUStatus {
  const currentBalance = account.balanceHistory
    .filter((b) => b.year <= year)
    .reduce((latest, b) => {
      if (!latest || b.year > latest.year || (b.year === latest.year && b.month > latest.month)) {
        return b
      }
      return latest
    }, null as BalanceHistoryEntry | null)?.balance ?? account.openingBalance

  // Bruk faktiske innskudd hvis tilgjengelig, ellers estimat
  const actualYTD = computeYTDContributions(account, year)
  const yearlyContributionSoFar = actualYTD > 0 ? actualYTD : account.monthlyContribution * new Date().getMonth()

  const remainingYearlyQuota = Math.max(0, BSU_MAX_YEARLY - yearlyContributionSoFar)
  const totalRemainingRoom = Math.max(0, BSU_MAX_TOTAL - currentBalance)
  const isMaxed = currentBalance >= BSU_MAX_TOTAL

  let warning: string | undefined
  if (isMaxed) {
    warning = 'BSU er fullspart (300 000 kr). Vurder å flytte sparingen til annen konto.'
  } else if (remainingYearlyQuota < 1000) {
    warning = `Nærmer seg årsgrensen (${BSU_MAX_YEARLY.toLocaleString('no')} kr/år).`
  } else if (totalRemainingRoom < 10_000) {
    warning = `Snart maks BSU-saldo (${BSU_MAX_TOTAL.toLocaleString('no')} kr).`
  }

  return {
    currentBalance,
    yearlyContributionSoFar,
    remainingYearlyQuota,
    totalRemainingRoom,
    isMaxed,
    warning,
  }
}

// ------------------------------------------------------------
// FAKTISK AVKASTNING (fond/krypto)
// ------------------------------------------------------------

export function calculateRealizedReturn(account: SavingsAccount): {
  totalContributed: number
  currentValue: number
  returnPercent: number
} {
  const currentValue = account.balanceHistory.at(-1)?.balance ?? account.openingBalance

  // Estimert total innskudd
  const openingDate = new Date(account.openingDate)
  const now = new Date()
  const months =
    (now.getFullYear() - openingDate.getFullYear()) * 12 +
    (now.getMonth() - openingDate.getMonth())

  const totalContributed =
    account.openingBalance + Math.max(0, months) * account.monthlyContribution

  // Legg til manuelle uttrekk
  const totalWithdrawals = account.withdrawals.reduce((s, w) => s + w.amount, 0)
  const adjustedContributed = totalContributed + totalWithdrawals

  const returnPercent =
    adjustedContributed > 0
      ? ((currentValue - adjustedContributed) / adjustedContributed) * 100
      : 0

  return { totalContributed: adjustedContributed, currentValue, returnPercent }
}
