import { supabase } from './supabase'
import { useEconomyStore } from '@/application/useEconomyStore'

/**
 * Henter økonomidata fra Supabase og laster inn i storen.
 * Hvis ingen data finnes i Supabase, lastes lokale data opp.
 */
export async function loadFromSupabase(): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_data')
    .select('economy_data')
    .single()

  if (error || !data?.economy_data) {
    // Ingen data i Supabase — last opp lokale data hvis de finnes
    const state = useEconomyStore.getState()
    if (state.profile || state.monthHistory.length > 0) {
      await saveToSupabase()
    }
    return false
  }

  useEconomyStore.getState().importData(JSON.stringify(data.economy_data))
  return true
}

/**
 * Lagrer økonomidata til Supabase.
 * Stripper PDF-blobs for å holde payloaden liten.
 */
export async function saveToSupabase(): Promise<void> {
  const state = useEconomyStore.getState()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Strip PDF-blobs — for store til å lagre i database
  const monthHistoryUtenPDF = state.monthHistory.map(({ slipPdfBase64: _, ...rest }) => rest)

  const payload = {
    profile: state.profile,
    budgetTemplate: state.budgetTemplate,
    monthHistory: monthHistoryUtenPDF,
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
    ivfTransactions: state.ivfTransactions,
    ivfSettings: state.ivfSettings,
    budgetOverrides: state.budgetOverrides,
    fondPortfolio: state.fondPortfolio,
  }

  await supabase.from('user_data').upsert({
    user_id: user.id,
    economy_data: payload,
    updated_at: new Date().toISOString(),
  })
}

// Debounce-timer
let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Starter automatisk synkronisering til Supabase ved endringer i storen.
 * Lagrer maks én gang per 3 sekunder.
 * Returnerer en cleanup-funksjon.
 */
export function startAutoSync(): () => void {
  const unsubscribe = useEconomyStore.subscribe(() => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveToSupabase()
    }, 3000)
  })

  return () => {
    unsubscribe()
    if (saveTimer) clearTimeout(saveTimer)
  }
}
