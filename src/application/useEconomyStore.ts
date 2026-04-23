import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EmploymentProfile,
  BudgetTemplate,
  MonthRecord,
  ATFEntry,
  SavingsAccount,
  SavingsGoal,
  DebtAccount,
  AbsenceRecord,
  AbsenceEvent,
  TaxSettlementRecord,
  SubscriptionEntry,
  InsuranceEntry,
  PolicyRateEntry,
  ParsetLonnsslipp,
  BalanceHistoryEntry,
  WithdrawalEntry,
  SavingsContribution,
  RateHistoryEntry,
  DebtRateHistory,
  BudgetLine,
  KnownATFRate,
  TemporaryPayEntry,
  IVFTransaction,
  IVFSettings,
  FondPortfolio,
  FondPortfolioSnapshot,
  UserPreferences,
  LonnsoppgjorRecord,
} from '@/types/economy'
import { POLICY_RATE_HISTORY } from '@/config/economy.config'

// ------------------------------------------------------------
// STATE INTERFACE
// ------------------------------------------------------------

interface EconomyState {
  storeVersion: number

  // Kjerne
  profile: EmploymentProfile | null
  budgetTemplate: BudgetTemplate
  monthHistory: MonthRecord[]

  // ATF
  atfEntries: ATFEntry[]

  // Sparing
  savingsAccounts: SavingsAccount[]
  savingsGoals: SavingsGoal[]

  // Gjeld
  debts: DebtAccount[]

  // Fravær
  absenceRecords: AbsenceRecord[]
  absenceEvents: AbsenceEvent[]
  absenceHireDate: string | null    // "YYYY-MM-DD", for 2-månederskrav

  // Skatteoppgjør
  taxSettlements: TaxSettlementRecord[]

  // Abonnement og forsikringer
  subscriptions: SubscriptionEntry[]
  insurances: InsuranceEntry[]

  // Styringsrente-historikk
  policyRateHistory: PolicyRateEntry[]

  // Lønnsoppgjør-historikk
  lonnsoppgjor: LonnsoppgjorRecord[]

  // Midlertidig lønn (fungering)
  temporaryPayEntries: TemporaryPayEntry[]

  // IVF-prosjekt
  ivfTransactions: IVFTransaction[]
  ivfSettings: IVFSettings

  // Fond (KRON-portefølje)
  fondPortfolio: FondPortfolio

  // Actions
  setProfile: (profile: EmploymentProfile) => void

  addMonthRecord: (record: MonthRecord) => void
  updateMonthRecord: (year: number, month: number, updates: Partial<MonthRecord>) => void
  lockMonth: (year: number, month: number) => void
  unlockMonth: (year: number, month: number) => void
  importSlip: (slip: ParsetLonnsslipp, pdfBase64?: string) => void

  addATFEntry: (entry: ATFEntry) => void
  updateATFEntry: (id: string, entry: Partial<ATFEntry>) => void
  removeATFEntry: (id: string) => void

  addSavingsAccount: (account: SavingsAccount) => void
  importSavingsStatement: (parsed: import('@/domain/economy/bankTransactionParser').ParsedBankStatement) => void
  updateSavingsAccount: (id: string, updates: Partial<SavingsAccount>) => void
  updateSavingsBalance: (accountId: string, entry: BalanceHistoryEntry) => void
  addWithdrawal: (accountId: string, withdrawal: WithdrawalEntry) => void
  removeWithdrawal: (accountId: string, withdrawalId: string) => void
  addContribution: (accountId: string, contribution: SavingsContribution) => void
  removeContribution: (accountId: string, contributionId: string) => void
  updateSavingsRate: (accountId: string, entry: RateHistoryEntry) => void
  removeSavingsAccount: (id: string) => void

  addSavingsGoal: (goal: SavingsGoal) => void
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => void
  removeSavingsGoal: (id: string) => void

  addDebt: (debt: DebtAccount) => void
  updateDebt: (id: string, updates: Partial<DebtAccount>) => void
  updateDebtRate: (debtId: string, entry: DebtRateHistory) => void
  removeDebt: (id: string) => void

  addAbsenceRecord: (record: AbsenceRecord) => void
  updateAbsenceRecord: (period: string, updates: Partial<AbsenceRecord>) => void
  removeAbsenceRecord: (period: string) => void

  addAbsenceEvent: (event: AbsenceEvent) => void
  removeAbsenceEvent: (id: string) => void
  setAbsenceHireDate: (date: string | null) => void
  clearAbsenceData: () => void
  replaceImportedAbsenceEvents: (events: AbsenceEvent[]) => void

  addTaxSettlement: (record: TaxSettlementRecord) => void
  updateTaxSettlement: (year: number, updates: Partial<TaxSettlementRecord>) => void
  removeTaxSettlement: (year: number) => void

  addSubscription: (sub: SubscriptionEntry) => void
  updateSubscription: (id: string, updates: Partial<SubscriptionEntry>) => void
  removeSubscription: (id: string) => void

  addInsurance: (ins: InsuranceEntry) => void
  updateInsurance: (id: string, updates: Partial<InsuranceEntry>) => void
  removeInsurance: (id: string) => void

  addLonnsoppgjor: (record: LonnsoppgjorRecord) => void
  updateLonnsoppgjor: (id: string, updates: Partial<LonnsoppgjorRecord>) => void
  removeLonnsoppgjor: (id: string) => void
  deriveLonnsoppgjorFromSlips: () => void

  addTemporaryPay: (entry: TemporaryPayEntry) => void
  updateTemporaryPay: (id: string, updates: Partial<TemporaryPayEntry>) => void
  removeTemporaryPay: (id: string) => void

  addIvfTransaction: (tx: IVFTransaction) => void
  updateIvfTransaction: (id: string, updates: Partial<IVFTransaction>) => void
  removeIvfTransaction: (id: string) => void
  setIvfSettings: (settings: Partial<IVFSettings>) => void

  setFondPortfolio: (p: FondPortfolio) => void
  addFondSnapshot: (snapshot: FondPortfolioSnapshot) => void
  removeFondSnapshot: (date: string) => void

  updateBudgetTemplate: (template: Partial<BudgetTemplate>) => void
  addBudgetLine: (line: BudgetLine) => void
  updateBudgetLine: (id: string, updates: Partial<BudgetLine>) => void
  removeBudgetLine: (id: string) => void

  budgetOverrides: Record<string, number>  // key: "${year}:${month}:${rowId}"
  setBudgetOverride: (year: number, month: number, rowId: string, value: number) => void
  clearBudgetOverride: (year: number, month: number, rowId: string) => void

  userPreferences: UserPreferences | null
  setUserPreferences: (prefs: UserPreferences) => void

  exportData: () => string
  importData: (json: string) => void
  clearAllSlips: () => void
  resetAll: () => void
  restoreProfileFromSlips: () => void
}

// ------------------------------------------------------------
// DEFAULT STATE
// ------------------------------------------------------------

const DEFAULT_TEMPLATE: BudgetTemplate = {
  lines: [],
  lastUpdated: new Date().toISOString().split('T')[0],
}

const DEFAULT_FOND_PORTFOLIO: FondPortfolio = {
  monthlyDeposit: 0,
  startDate: '',
  funds: [],
  snapshots: [],
}

const DEFAULT_IVF_SETTINGS: IVFSettings = {
  lonPerson1: 0,
  lonPerson2: 0,
  studielaanPerson1: 0,
  studielaanPerson2: 0,
  annenEgenkapital: 0,
}

const INITIAL_IVF_TRANSACTIONS: IVFTransaction[] = []

// ------------------------------------------------------------
// STORE
// ------------------------------------------------------------

export const useEconomyStore = create<EconomyState>()(
  persist(
    (set, get) => ({
      storeVersion: 1,
      profile: null,
      userPreferences: null,
      budgetTemplate: DEFAULT_TEMPLATE,
      budgetOverrides: {},
      monthHistory: [],
      atfEntries: [],
      savingsAccounts: [],
      savingsGoals: [],
      debts: [],
      absenceRecords: [],
      absenceEvents: [],
      absenceHireDate: null,
      taxSettlements: [],
      subscriptions: [],
      insurances: [],
      policyRateHistory: POLICY_RATE_HISTORY,
      lonnsoppgjor: [],
      temporaryPayEntries: [],
      ivfTransactions: INITIAL_IVF_TRANSACTIONS,
      ivfSettings: DEFAULT_IVF_SETTINGS,
      fondPortfolio: DEFAULT_FOND_PORTFOLIO,

      // --- Profil ---
      setProfile: (profile) => set({ profile }),
      setUserPreferences: (prefs) => set({ userPreferences: prefs }),

      // --- Måneder ---
      addMonthRecord: (record) =>
        set((s) => {
          const filtered = s.monthHistory.filter(
            (m) => !(m.year === record.year && m.month === record.month)
          )
          return { monthHistory: [...filtered, record] }
        }),

      updateMonthRecord: (year, month, updates) =>
        set((s) => ({
          monthHistory: s.monthHistory.map((m) =>
            m.year === year && m.month === month ? { ...m, ...updates } : m
          ),
        })),

      lockMonth: (year, month) =>
        set((s) => ({
          monthHistory: s.monthHistory.map((m) =>
            m.year === year && m.month === month ? { ...m, isLocked: true } : m
          ),
        })),

      unlockMonth: (year, month) =>
        set((s) => ({
          monthHistory: s.monthHistory.filter(
            (m) => !(m.year === year && m.month === month)
          ),
        })),

      importSlip: (slip, pdfBase64) => {
        const { profile, monthHistory } = get()

        // Sjekk om denne slippen er nyere enn alle eksisterende slipper med lønn.
        // Bare den nyeste slippen skal sette grunnlønn/trekk i profilen.
        const latestExisting = monthHistory
          .filter((m) => (m.slipData?.maanedslonn ?? 0) > 0)
          .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)[0]
        const isLatestSlip = !latestExisting ||
          slip.periode.year > latestExisting.year ||
          (slip.periode.year === latestExisting.year && slip.periode.month >= latestExisting.month)

        // Slippen genererer IKKE BudgetLines for utgifter.
        // Faste utgifter styres av brukerens budsjettmal.
        const record: MonthRecord = {
          year: slip.periode.year,
          month: slip.periode.month,
          isLocked: true,
          source: 'imported_slip',
          lines: [],
          nettoUtbetalt: slip.nettoUtbetalt,
          disposable: slip.nettoUtbetalt,
          slipData: slip,
          slipPdfBase64: pdfBase64,
        }

        set((s) => {
          const filtered = s.monthHistory.filter(
            (m) => !(m.year === slip.periode.year && m.month === slip.periode.month)
          )

          // Behold maks 12 PDF-er (fjern fra eldste slipper)
          let updated = [...filtered, record]
          if (pdfBase64) {
            const withPdf = updated
              .filter((m) => m.source === 'imported_slip' && m.slipPdfBase64)
              .sort((a, b) => b.year - a.year || b.month - a.month)
            if (withPdf.length > 12) {
              const toRemove = new Set(
                withPdf.slice(12).map((m) => `${m.year}-${m.month}`)
              )
              updated = updated.map((m) =>
                toRemove.has(`${m.year}-${m.month}`)
                  ? { ...m, slipPdfBase64: undefined }
                  : m
              )
            }
          }

          // Oppdater profil med siste kjente tall fra slippen.
          // Hvis ingen profil eksisterer ennå, opprett én automatisk fra slippen.
          const baseProfile: EmploymentProfile = profile ?? {
            employer: 'forsvaret',
            baseMonthly: 0,
            fixedAdditions: [],
            lastKnownTaxWithholding: 0,
            extraTaxWithholding: 0,
            housingDeduction: 0,
            pensionPercent: 2,
            unionFee: 0,
            atfEnabled: false,
          }
          let updatedProfile: EmploymentProfile = {
            ...baseProfile,
            // Lønn og trekk settes kun fra den nyeste slippen
            ...(isLatestSlip ? {
              baseMonthly: slip.maanedslonn || baseProfile.baseMonthly,
              lastKnownTaxWithholding: slip.skattetrekk || baseProfile.lastKnownTaxWithholding,
              extraTaxWithholding: slip.ekstraTrekk > 0 ? slip.ekstraTrekk : baseProfile.extraTaxWithholding,
              housingDeduction: slip.husleietrekk > 0 ? slip.husleietrekk : baseProfile.housingDeduction,
              unionFee: slip.fagforeningskontingent > 0 ? slip.fagforeningskontingent : baseProfile.unionFee,
              // Faste tillegg: merge med eksisterende — slipper mangler noen ganger tillegg
              // som ikke var aktive den måneden (f.eks. 1501 kun på visse slipper).
              // Ny slipp oppdaterer beløp der den har koden, eksisterende beholdes ellers.
              fixedAdditions: (() => {
                const fromSlip = slip.fasteTillegg
                  .filter((t) => t.artskode !== '3209')
                  .map((t) => ({ kode: t.artskode, label: t.navn, amount: t.belop }))
                const fromSlipKoder = new Set(fromSlip.map((t) => t.kode))
                const kept = (baseProfile.fixedAdditions ?? []).filter((t) => !fromSlipKoder.has(t.kode))
                return [...kept, ...fromSlip]
              })(),
            } : {}),
            // SPK-pensjon er alltid 2% — bruker ikke ratio-estimat (base inkluderer 1162/10P2 i tillegg til 1S01)
          }

          // Beregn og lagre effektiv /440-trekkprosent
          if (slip.tabelltrekkGrunnlag > 0 && slip.tabelltrekkBelop > 0) {
            const pct = (slip.tabelltrekkBelop / slip.tabelltrekkGrunnlag) * 100
            updatedProfile = { ...updatedProfile, lastKnownTableTaxPercent: Math.round(pct * 100) / 100 }
          }

          // Lagre tabellnummer fra slippen
          if (slip.tabellnummer) {
            updatedProfile = { ...updatedProfile, tabellnummer: slip.tabellnummer }
          }

          // Merge ATF-satser fra slippen inn i profilen (behold siste kjente per artskode)
          if (slip.atfRater) {
            const slipDato = `${slip.periode.year}-${String(slip.periode.month).padStart(2, '0')}`
            const fraAarslonn = slip.maanedslonn * 12
            const mergedRates: Record<string, KnownATFRate> = { ...updatedProfile.knownATFRates }
            for (const [artskode, sats] of Object.entries(slip.atfRater)) {
              const existing = mergedRates[artskode]
              if (!existing || slipDato >= existing.dato) {
                mergedRates[artskode] = { sats, fraAarslonn, dato: slipDato }
              }
            }
            updatedProfile = { ...updatedProfile, knownATFRates: mergedRates }
          }

          return {
            monthHistory: updated,
            profile: updatedProfile,
          }
        })
      },

      // --- ATF ---
      addATFEntry: (entry) => set((s) => ({ atfEntries: [...s.atfEntries, entry] })),
      updateATFEntry: (id, entry) =>
        set((s) => ({
          atfEntries: s.atfEntries.map((e) => (e.id === id ? { ...e, ...entry } : e)),
        })),
      removeATFEntry: (id) => set((s) => ({ atfEntries: s.atfEntries.filter((e) => e.id !== id) })),

      // --- Sparekonto ---
      addSavingsAccount: (account) =>
        set((s) => ({ savingsAccounts: [...s.savingsAccounts, account] })),

      importSavingsStatement: (parsed) =>
        set((s) => {
          const printDate = new Date(parsed.printDate)
          const balEntry: BalanceHistoryEntry = {
            year: printDate.getFullYear(),
            month: printDate.getMonth() + 1,
            balance: parsed.closingBalance,
            isManual: false,
          }
          // Finn eksisterende konto med same kontonummer
          const existing = parsed.accountNumber
            ? s.savingsAccounts.find((a) => a.accountNumber === parsed.accountNumber)
            : undefined
          if (existing) {
            // Oppdater saldo og estimert månedssparing
            const history = existing.balanceHistory.filter(
              (b) => !(b.year === balEntry.year && b.month === balEntry.month)
            )
            const updated: SavingsAccount = {
              ...existing,
              balanceHistory: [...history, balEntry].sort(
                (a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month
              ),
              monthlyContribution: parsed.estimatedMonthlyContribution || existing.monthlyContribution,
            }
            return { savingsAccounts: s.savingsAccounts.map((a) => a.id === existing.id ? updated : a) }
          }
          // Ny konto
          const typeMap: Record<string, SavingsAccount['type']> = {
            BSU: 'BSU', sparekonto: 'sparekonto', annet: 'annet',
          }
          const newAccount: SavingsAccount = {
            id: crypto.randomUUID(),
            type: typeMap[parsed.accountType] ?? 'sparekonto',
            label: parsed.accountLabel,
            accountNumber: parsed.accountNumber,
            openingBalance: parsed.closingBalance,
            openingDate: parsed.printDate,
            monthlyContribution: parsed.estimatedMonthlyContribution,
            interestCreditFrequency: parsed.accountType === 'BSU' ? 'yearly' : 'monthly',
            rateHistory: parsed.estimatedAnnualInterestRate != null
              ? [{ fromDate: parsed.printDate, rate: parsed.estimatedAnnualInterestRate }]
              : [],
            balanceHistory: [balEntry],
            withdrawals: [],
            contributions: [],
            ...(parsed.accountType === 'BSU' ? { maxYearlyContribution: 27500, maxTotalBalance: 300000 } : {}),
          }
          return { savingsAccounts: [...s.savingsAccounts, newAccount] }
        }),
      updateSavingsAccount: (id, updates) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
      updateSavingsBalance: (accountId, entry) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) => {
            if (a.id !== accountId) return a
            const history = a.balanceHistory.filter(
              (b) => !(b.year === entry.year && b.month === entry.month)
            )
            return { ...a, balanceHistory: [...history, entry] }
          }),
        })),
      addWithdrawal: (accountId, withdrawal) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) =>
            a.id === accountId
              ? { ...a, withdrawals: [...(a.withdrawals ?? []), withdrawal] }
              : a
          ),
        })),
      removeWithdrawal: (accountId, withdrawalId) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) =>
            a.id === accountId
              ? { ...a, withdrawals: (a.withdrawals ?? []).filter((w) => w.id !== withdrawalId) }
              : a
          ),
        })),
      addContribution: (accountId, contribution) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) =>
            a.id === accountId
              ? { ...a, contributions: [...(a.contributions ?? []), contribution] }
              : a
          ),
        })),
      removeContribution: (accountId, contributionId) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) =>
            a.id === accountId
              ? { ...a, contributions: (a.contributions ?? []).filter((c) => c.id !== contributionId) }
              : a
          ),
        })),
      updateSavingsRate: (accountId, entry) =>
        set((s) => ({
          savingsAccounts: s.savingsAccounts.map((a) => {
            if (a.id !== accountId) return a
            const history = a.rateHistory.filter((r) => r.fromDate !== entry.fromDate)
            return { ...a, rateHistory: [...history, entry] }
          }),
        })),
      removeSavingsAccount: (id) =>
        set((s) => ({ savingsAccounts: s.savingsAccounts.filter((a) => a.id !== id) })),

      // --- Sparemål ---
      addSavingsGoal: (goal) => set((s) => ({ savingsGoals: [...s.savingsGoals, goal] })),
      updateSavingsGoal: (id, updates) =>
        set((s) => ({
          savingsGoals: s.savingsGoals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),
      removeSavingsGoal: (id) =>
        set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== id) })),

      // --- Gjeld ---
      addDebt: (debt) => set((s) => ({ debts: [...s.debts, debt] })),
      updateDebt: (id, updates) =>
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        })),
      updateDebtRate: (debtId, entry) =>
        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.id !== debtId) return d
            const history = d.rateHistory.filter((r) => r.fromDate !== entry.fromDate)
            return { ...d, rateHistory: [...history, entry] }
          }),
        })),
      removeDebt: (id) => set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

      // --- Fravær ---
      addAbsenceRecord: (record) =>
        set((s) => {
          const filtered = s.absenceRecords.filter((r) => r.period !== record.period)
          return { absenceRecords: [...filtered, record] }
        }),
      updateAbsenceRecord: (period, updates) =>
        set((s) => ({
          absenceRecords: s.absenceRecords.map((r) =>
            r.period === period ? { ...r, ...updates } : r
          ),
        })),
      removeAbsenceRecord: (period) =>
        set((s) => ({ absenceRecords: s.absenceRecords.filter((r) => r.period !== period) })),

      addAbsenceEvent: (event) =>
        set((s) => ({
          absenceEvents: [...s.absenceEvents.filter((e) => e.id !== event.id), event],
        })),
      removeAbsenceEvent: (id) =>
        set((s) => ({ absenceEvents: s.absenceEvents.filter((e) => e.id !== id) })),
      setAbsenceHireDate: (date) => set({ absenceHireDate: date }),
      clearAbsenceData: () => set({ absenceRecords: [], absenceEvents: [], absenceHireDate: null }),
      replaceImportedAbsenceEvents: (events) =>
        set((s) => ({
          absenceEvents: [
            ...s.absenceEvents.filter((e) => e.source !== 'imported'),
            ...events,
          ],
        })),

      // --- Skatteoppgjør ---
      addTaxSettlement: (record) =>
        set((s) => {
          const filtered = s.taxSettlements.filter((r) => r.year !== record.year)
          return { taxSettlements: [...filtered, record] }
        }),
      updateTaxSettlement: (year, updates) =>
        set((s) => ({
          taxSettlements: s.taxSettlements.map((r) =>
            r.year === year ? { ...r, ...updates } : r
          ),
        })),
      removeTaxSettlement: (year) =>
        set((s) => ({ taxSettlements: s.taxSettlements.filter((r) => r.year !== year) })),

      // --- Abonnement ---
      addSubscription: (sub) => set((s) => ({ subscriptions: [...s.subscriptions, sub] })),
      updateSubscription: (id, updates) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((sub) =>
            sub.id === id ? { ...sub, ...updates } : sub
          ),
        })),
      removeSubscription: (id) =>
        set((s) => ({ subscriptions: s.subscriptions.filter((s) => s.id !== id) })),

      // --- Lønnsoppgjør ---
      addLonnsoppgjor: (record) =>
        set((s) => ({ lonnsoppgjor: [...s.lonnsoppgjor, record].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)) })),
      updateLonnsoppgjor: (id, updates) =>
        set((s) => ({ lonnsoppgjor: s.lonnsoppgjor.map((r) => (r.id === id ? { ...r, ...updates } : r)) })),
      removeLonnsoppgjor: (id) =>
        set((s) => ({ lonnsoppgjor: s.lonnsoppgjor.filter((r) => r.id !== id) })),
      deriveLonnsoppgjorFromSlips: () => {
        const { monthHistory } = get()
        const slips = monthHistory
          .filter((m) => m.source === 'imported_slip' && (m.slipData?.maanedslonn ?? 0) > 0)
          .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)

        const derived: LonnsoppgjorRecord[] = []
        let prevLonn = 0

        for (const m of slips) {
          const lonn = m.slipData!.maanedslonn
          const effectiveDate = `${m.year}-${String(m.month).padStart(2, '0')}-01`
          if (prevLonn === 0) {
            derived.push({
              id: crypto.randomUUID(),
              year: m.year,
              effectiveDate,
              maanedslonn: lonn,
              forrigeMaanedslonn: 0,
              htaTillegg: 0,
              notes: 'Første registrerte lønn',
              source: 'slip',
            })
          } else if (Math.abs(lonn - prevLonn) > 500) {
            derived.push({
              id: crypto.randomUUID(),
              year: m.year,
              effectiveDate,
              maanedslonn: lonn,
              forrigeMaanedslonn: prevLonn,
              htaTillegg: 0,
              notes: '',
              source: 'slip',
            })
          }
          prevLonn = lonn
        }

        set((s) => ({
          lonnsoppgjor: [
            ...s.lonnsoppgjor.filter((r) => r.source !== 'slip'),
            ...derived,
          ].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
        }))
      },

      // --- Midlertidig lønn ---
      addTemporaryPay: (entry) => set((s) => ({ temporaryPayEntries: [...s.temporaryPayEntries, entry] })),
      updateTemporaryPay: (id, updates) =>
        set((s) => ({
          temporaryPayEntries: s.temporaryPayEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      removeTemporaryPay: (id) =>
        set((s) => ({ temporaryPayEntries: s.temporaryPayEntries.filter((e) => e.id !== id) })),

      // --- IVF ---
      addIvfTransaction: (tx) =>
        set((s) => ({ ivfTransactions: [...s.ivfTransactions, tx] })),
      updateIvfTransaction: (id, updates) =>
        set((s) => ({
          ivfTransactions: s.ivfTransactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeIvfTransaction: (id) =>
        set((s) => ({ ivfTransactions: s.ivfTransactions.filter((t) => t.id !== id) })),
      setIvfSettings: (settings) =>
        set((s) => ({ ivfSettings: { ...s.ivfSettings, ...settings } })),

      // --- Fond ---
      setFondPortfolio: (p) => set({ fondPortfolio: p }),
      addFondSnapshot: (snapshot) =>
        set((s) => {
          const filtered = s.fondPortfolio.snapshots.filter((snap) => snap.date !== snapshot.date)
          return {
            fondPortfolio: {
              ...s.fondPortfolio,
              snapshots: [...filtered, snapshot].sort((a, b) => a.date.localeCompare(b.date)),
            },
          }
        }),
      removeFondSnapshot: (date) =>
        set((s) => ({
          fondPortfolio: {
            ...s.fondPortfolio,
            snapshots: s.fondPortfolio.snapshots.filter((snap) => snap.date !== date),
          },
        })),

      // --- Forsikring ---
      addInsurance: (ins) => set((s) => ({ insurances: [...s.insurances, ins] })),
      updateInsurance: (id, updates) =>
        set((s) => ({
          insurances: s.insurances.map((ins) =>
            ins.id === id ? { ...ins, ...updates } : ins
          ),
        })),
      removeInsurance: (id) =>
        set((s) => ({ insurances: s.insurances.filter((ins) => ins.id !== id) })),

      // --- Budsjettmal ---
      updateBudgetTemplate: (template) =>
        set((s) => ({
          budgetTemplate: {
            ...s.budgetTemplate,
            ...template,
            lastUpdated: new Date().toISOString().split('T')[0],
          },
        })),
      addBudgetLine: (line) =>
        set((s) => ({
          budgetTemplate: {
            ...s.budgetTemplate,
            lines: [...s.budgetTemplate.lines, line],
            lastUpdated: new Date().toISOString().split('T')[0],
          },
        })),
      updateBudgetLine: (id, updates) =>
        set((s) => ({
          budgetTemplate: {
            ...s.budgetTemplate,
            lines: s.budgetTemplate.lines.map((l) => l.id === id ? { ...l, ...updates } : l),
            lastUpdated: new Date().toISOString().split('T')[0],
          },
        })),
      removeBudgetLine: (id) =>
        set((s) => ({
          budgetTemplate: {
            ...s.budgetTemplate,
            lines: s.budgetTemplate.lines.filter((l) => l.id !== id),
            lastUpdated: new Date().toISOString().split('T')[0],
          },
        })),

      // --- Migrering: gjenoppbygg profil fra eksisterende slipper hvis profil mangler ---
      restoreProfileFromSlips: () => {
        const { profile, monthHistory } = get()
        if (profile !== null) return

        const slips = monthHistory
          .filter((m) => (m.slipData?.maanedslonn ?? 0) > 0)
          .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

        if (slips.length === 0) return

        const rec = slips[0]
        const slip = rec.slipData!
        const slipDato = `${rec.year}-${String(rec.month).padStart(2, '0')}`

        const newProfile: EmploymentProfile = {
          employer: 'forsvaret',
          baseMonthly: slip.maanedslonn,
          fixedAdditions: slip.fasteTillegg
            .filter((t) => t.artskode !== '3209')
            .map((t) => ({ kode: t.artskode, label: t.navn, amount: t.belop })),
          lastKnownTaxWithholding: slip.skattetrekk,
          extraTaxWithholding: slip.ekstraTrekk > 0 ? slip.ekstraTrekk : 0,
          housingDeduction: slip.husleietrekk > 0 ? slip.husleietrekk : 0,
          pensionPercent: 2,
          unionFee: slip.fagforeningskontingent > 0 ? slip.fagforeningskontingent : 0,
          atfEnabled: false,
          ...(slip.tabelltrekkGrunnlag > 0 && slip.tabelltrekkBelop > 0 ? {
            lastKnownTableTaxPercent: Math.round((slip.tabelltrekkBelop / slip.tabelltrekkGrunnlag) * 10000) / 100,
          } : {}),
          ...(slip.tabellnummer ? { tabellnummer: slip.tabellnummer } : {}),
          ...(slip.atfRater ? {
            knownATFRates: Object.fromEntries(
              Object.entries(slip.atfRater).map(([kode, sats]) => [
                kode,
                { sats, fraAarslonn: slip.maanedslonn * 12, dato: slipDato } satisfies KnownATFRate,
              ])
            ),
          } : {}),
        }

        set({ profile: newProfile })
      },

      // --- Budsjett-overrides ---
      setBudgetOverride: (year, month, rowId, value) =>
        set((s) => ({ budgetOverrides: { ...s.budgetOverrides, [`${year}:${month}:${rowId}`]: value } })),
      clearBudgetOverride: (year, month, rowId) =>
        set((s) => {
          const next = { ...s.budgetOverrides }
          delete next[`${year}:${month}:${rowId}`]
          return { budgetOverrides: next }
        }),

      // --- Eksport / Import ---
      exportData: () => JSON.stringify(get(), null, 2),

      importData: (json) => {
        try {
          const data = JSON.parse(json)
          set({
            profile: data.profile ?? null,
            budgetTemplate: data.budgetTemplate ?? DEFAULT_TEMPLATE,
            monthHistory: data.monthHistory ?? [],
            atfEntries: data.atfEntries ?? [],
            savingsAccounts: data.savingsAccounts ?? [],
            savingsGoals: data.savingsGoals ?? [],
            debts: data.debts ?? [],
            absenceRecords: data.absenceRecords ?? [],
            absenceEvents: data.absenceEvents ?? [],
            absenceHireDate: data.absenceHireDate ?? null,
            taxSettlements: data.taxSettlements ?? [],
            subscriptions: data.subscriptions ?? [],
            insurances: data.insurances ?? [],
            policyRateHistory: data.policyRateHistory ?? POLICY_RATE_HISTORY,
            temporaryPayEntries: data.temporaryPayEntries ?? [],
            lonnsoppgjor: data.lonnsoppgjor ?? [],
            ivfTransactions: data.ivfTransactions ?? INITIAL_IVF_TRANSACTIONS,
            ivfSettings: data.ivfSettings ?? DEFAULT_IVF_SETTINGS,
            fondPortfolio: data.fondPortfolio ?? DEFAULT_FOND_PORTFOLIO,
            budgetOverrides: data.budgetOverrides ?? {},
            userPreferences: data.userPreferences ?? null,
          })
        } catch {
          console.error('[EconomyStore] importData: ugyldig JSON')
        }
      },

      clearAllSlips: () =>
        set((s) => ({
          monthHistory: s.monthHistory.filter((m) => m.source !== 'imported_slip'),
        })),

      resetAll: () =>
        set({
          profile: null,
          budgetTemplate: DEFAULT_TEMPLATE,
          monthHistory: [],
          atfEntries: [],
          savingsAccounts: [],
          savingsGoals: [],
          debts: [],
          absenceRecords: [],
          absenceEvents: [],
          absenceHireDate: null,
          taxSettlements: [],
          subscriptions: [],
          insurances: [],
          policyRateHistory: POLICY_RATE_HISTORY,
          temporaryPayEntries: [],
          lonnsoppgjor: [],
          ivfTransactions: INITIAL_IVF_TRANSACTIONS,
          ivfSettings: DEFAULT_IVF_SETTINGS,
          fondPortfolio: DEFAULT_FOND_PORTFOLIO,
          budgetOverrides: {},
          userPreferences: null,
        }),
    }),
    {
      name: 'min-okonomi-v1',
      version: 5,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = persistedState as Record<string, unknown>
        // v1 → v2: inkluder artskode 1501 (husleiekompensasjon) i fixedAdditions
        if (fromVersion < 2 && state.profile && state.monthHistory) {
          const history = state.monthHistory as Array<{ year: number; month: number; slipData?: { fasteTillegg?: Array<{ artskode: string; navn: string; belop: number }> } }>
          const profile = state.profile as Record<string, unknown>
          // Finn nyeste slipp med fasteTillegg
          const latestSlip = [...history]
            .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
            .find((r) => (r.slipData?.fasteTillegg?.length ?? 0) > 0)
          if (latestSlip?.slipData?.fasteTillegg) {
            profile.fixedAdditions = latestSlip.slipData.fasteTillegg
              .filter((t) => t.artskode !== '3209')
              .map((t) => ({ kode: t.artskode, label: t.navn, amount: t.belop }))
          }
        }
        // v2 → v3: legg til IVF-prosjekt + sikre at alle felt finnes
        if (fromVersion < 3) {
          if (!state.ivfTransactions) state.ivfTransactions = INITIAL_IVF_TRANSACTIONS
          if (!state.ivfSettings) state.ivfSettings = DEFAULT_IVF_SETTINGS
          // Defensive: sørg for at alle felt som kan ha manglet har fallback-verdi
          if (!Array.isArray(state.temporaryPayEntries)) state.temporaryPayEntries = []
          if (!Array.isArray(state.atfEntries)) state.atfEntries = []
          if (!Array.isArray(state.savingsAccounts)) state.savingsAccounts = []
          if (!Array.isArray(state.savingsGoals)) state.savingsGoals = []
          if (!Array.isArray(state.debts)) state.debts = []
          if (!Array.isArray(state.absenceRecords)) state.absenceRecords = []
          if (!Array.isArray(state.absenceEvents)) state.absenceEvents = []
          if (!Array.isArray(state.taxSettlements)) state.taxSettlements = []
          if (!Array.isArray(state.subscriptions)) state.subscriptions = []
          if (!Array.isArray(state.insurances)) state.insurances = []
          if (!state.budgetOverrides || typeof state.budgetOverrides !== 'object') state.budgetOverrides = {}
          if (!state.fondPortfolio) state.fondPortfolio = DEFAULT_FOND_PORTFOLIO
        }
        // v3 → v4: migrer skatteoppgjør-linjer fra annen_inntekt/annet_forbruk til skatteoppgjor
        if (fromVersion < 4 && state.budgetTemplate) {
          const tmpl = state.budgetTemplate as { lines?: Array<{ category: string; label: string }> }
          if (Array.isArray(tmpl.lines)) {
            const SKATT_PATTERN = /skattetilgode|restskatt|skatte(opp|inn|ut)/i
            tmpl.lines = tmpl.lines.map((l) =>
              SKATT_PATTERN.test(l.label) ? { ...l, category: 'skatteoppgjor' } : l
            )
          }
        }
        // v4 → v5: generaliser IVFSettings-feltnavn (lonTonje→lonPerson1 osv.)
        if (fromVersion < 5 && state.ivfSettings) {
          const s = state.ivfSettings as Record<string, unknown>
          if ('lonTonje' in s) { s.lonPerson1 = s.lonTonje; delete s.lonTonje }
          if ('lonAne' in s) { s.lonPerson2 = s.lonAne; delete s.lonAne }
          if ('studielaanTonje' in s) { s.studielaanPerson1 = s.studielaanTonje; delete s.studielaanTonje }
          if ('studielaanAne' in s) { s.studielaanPerson2 = s.studielaanAne; delete s.studielaanAne }
        }
        // Alltid: sørg for fond
        if (!state.fondPortfolio) state.fondPortfolio = DEFAULT_FOND_PORTFOLIO
        return state
      },
      partialize: (state) => ({
        storeVersion: state.storeVersion,
        profile: state.profile,
        userPreferences: state.userPreferences,
        budgetTemplate: state.budgetTemplate,
        monthHistory: state.monthHistory.map(({ slipPdfBase64: _pdf, ...m }) => m),
        atfEntries: state.atfEntries,
        savingsAccounts: state.savingsAccounts,
        savingsGoals: state.savingsGoals,
        debts: state.debts,
        absenceRecords: state.absenceRecords,
        absenceEvents: state.absenceEvents,
        absenceHireDate: state.absenceHireDate,
        taxSettlements: state.taxSettlements,
        subscriptions: state.subscriptions,
        insurances: state.insurances,
        policyRateHistory: state.policyRateHistory,
        temporaryPayEntries: state.temporaryPayEntries,
        lonnsoppgjor: state.lonnsoppgjor,
        ivfTransactions: state.ivfTransactions,
        ivfSettings: state.ivfSettings,
        fondPortfolio: state.fondPortfolio,
        budgetOverrides: state.budgetOverrides,
      }),
    }
  )
)
