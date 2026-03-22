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
  TaxSettlementRecord,
  SubscriptionEntry,
  InsuranceEntry,
  PolicyRateEntry,
  ParsetLonnsslipp,
  BalanceHistoryEntry,
  WithdrawalEntry,
  RateHistoryEntry,
  DebtRateHistory,
  BudgetLine,
  KnownATFRate,
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

  // Skatteoppgjør
  taxSettlements: TaxSettlementRecord[]

  // Abonnement og forsikringer
  subscriptions: SubscriptionEntry[]
  insurances: InsuranceEntry[]

  // Styringsrente-historikk
  policyRateHistory: PolicyRateEntry[]

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
  updateSavingsAccount: (id: string, updates: Partial<SavingsAccount>) => void
  updateSavingsBalance: (accountId: string, entry: BalanceHistoryEntry) => void
  addWithdrawal: (accountId: string, withdrawal: WithdrawalEntry) => void
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

  addTaxSettlement: (record: TaxSettlementRecord) => void
  updateTaxSettlement: (year: number, updates: Partial<TaxSettlementRecord>) => void
  removeTaxSettlement: (year: number) => void

  addSubscription: (sub: SubscriptionEntry) => void
  updateSubscription: (id: string, updates: Partial<SubscriptionEntry>) => void
  removeSubscription: (id: string) => void

  addInsurance: (ins: InsuranceEntry) => void
  updateInsurance: (id: string, updates: Partial<InsuranceEntry>) => void
  removeInsurance: (id: string) => void

  updateBudgetTemplate: (template: Partial<BudgetTemplate>) => void
  addBudgetLine: (line: BudgetLine) => void
  removeBudgetLine: (id: string) => void

  exportData: () => string
  importData: (json: string) => void
  resetAll: () => void
}

// ------------------------------------------------------------
// DEFAULT STATE
// ------------------------------------------------------------

const DEFAULT_TEMPLATE: BudgetTemplate = {
  lines: [],
  lastUpdated: new Date().toISOString().split('T')[0],
}

// ------------------------------------------------------------
// STORE
// ------------------------------------------------------------

export const useEconomyStore = create<EconomyState>()(
  persist(
    (set, get) => ({
      storeVersion: 1,
      profile: null,
      budgetTemplate: DEFAULT_TEMPLATE,
      monthHistory: [],
      atfEntries: [],
      savingsAccounts: [],
      savingsGoals: [],
      debts: [],
      absenceRecords: [],
      taxSettlements: [],
      subscriptions: [],
      insurances: [],
      policyRateHistory: POLICY_RATE_HISTORY,

      // --- Profil ---
      setProfile: (profile) => set({ profile }),

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
        const { profile } = get()

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

          // Oppdater profil med siste kjente tall fra slippen
          let updatedProfile: EmploymentProfile | null = profile
            ? {
                ...profile,
                baseMonthly: slip.maanedslonn || profile.baseMonthly,
                lastKnownTaxWithholding: slip.skattetrekk || profile.lastKnownTaxWithholding,
                extraTaxWithholding: slip.ekstraTrekk > 0 ? slip.ekstraTrekk : profile.extraTaxWithholding,
                housingDeduction: slip.husleietrekk > 0 ? slip.husleietrekk : profile.housingDeduction,
                unionFee: slip.fagforeningskontingent > 0 ? slip.fagforeningskontingent : profile.unionFee,
              }
            : null

          // Beregn og lagre effektiv /440-trekkprosent
          if (updatedProfile && slip.tabelltrekkGrunnlag > 0 && slip.tabelltrekkBelop > 0) {
            const pct = (slip.tabelltrekkBelop / slip.tabelltrekkGrunnlag) * 100
            updatedProfile = { ...updatedProfile, lastKnownTableTaxPercent: Math.round(pct * 100) / 100 }
          }

          // Merge ATF-satser fra slippen inn i profilen (behold siste kjente per artskode)
          if (slip.atfRater && updatedProfile) {
            const slipDato = `${slip.periode.year}-${String(slip.periode.month).padStart(2, '0')}`
            const fraAarslonn = slip.maanedslonn * 12
            const mergedRates: Record<string, KnownATFRate> = { ...updatedProfile.knownATFRates }
            for (const [artskode, sats] of Object.entries(slip.atfRater)) {
              const existing = mergedRates[artskode]
              // Oppdater kun hvis slippen er nyere enn eller like gammel som eksisterende
              if (!existing || slipDato >= existing.dato) {
                mergedRates[artskode] = { sats, fraAarslonn, dato: slipDato }
              }
            }
            updatedProfile = { ...updatedProfile, knownATFRates: mergedRates }
          }

          return {
            monthHistory: updated,
            ...(updatedProfile ? { profile: updatedProfile } : {}),
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
              ? { ...a, withdrawals: [...a.withdrawals, withdrawal] }
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
      removeBudgetLine: (id) =>
        set((s) => ({
          budgetTemplate: {
            ...s.budgetTemplate,
            lines: s.budgetTemplate.lines.filter((l) => l.id !== id),
            lastUpdated: new Date().toISOString().split('T')[0],
          },
        })),

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
            taxSettlements: data.taxSettlements ?? [],
            subscriptions: data.subscriptions ?? [],
            insurances: data.insurances ?? [],
            policyRateHistory: data.policyRateHistory ?? POLICY_RATE_HISTORY,
          })
        } catch {
          console.error('[EconomyStore] importData: ugyldig JSON')
        }
      },

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
          taxSettlements: [],
          subscriptions: [],
          insurances: [],
          policyRateHistory: POLICY_RATE_HISTORY,
        }),
    }),
    {
      name: 'min-okonomi-v1',
      version: 1,
      partialize: (state) => ({
        storeVersion: state.storeVersion,
        profile: state.profile,
        budgetTemplate: state.budgetTemplate,
        monthHistory: state.monthHistory,
        atfEntries: state.atfEntries,
        savingsAccounts: state.savingsAccounts,
        savingsGoals: state.savingsGoals,
        debts: state.debts,
        absenceRecords: state.absenceRecords,
        taxSettlements: state.taxSettlements,
        subscriptions: state.subscriptions,
        insurances: state.insurances,
        policyRateHistory: state.policyRateHistory,
      }),
    }
  )
)
