import { useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { ScenarioInput } from '@/types'
import { defaultConfig } from '@/config/default.config'

function createDefaultScenario(label = 'Scenario 1'): ScenarioInput {
  return {
    id: crypto.randomUUID(),
    label,
    createdAt: Date.now(),
    isBase: true,
    property: {
      price: 4_500_000,
      type: 'leilighet',
      ownershipType: 'selveier',
      sharedDebt: 0,
      monthlyFee: 4_000,
      propertyTax: 0,
    },
    household: {
      primaryApplicant: {
        grossIncome: 700_000,
        existingDebt: 0,
        label: 'Søker 1',
      },
      children: 0,
      adults: 1,
    },
    loanParameters: {
      equity: 750_000,
      interestRate: defaultConfig.loanDefaults.defaultInterestRate,
      loanTermYears: defaultConfig.loanDefaults.defaultLoanTermYears,
      loanType: defaultConfig.loanDefaults.defaultLoanType,
      extraMonthlyExpenses: 0,
    },
  }
}

export function useNewScenario() {
  const addScenario = useAppStore((s) => s.addScenario)
  const scenarios = useAppStore((s) => s.scenarios)

  const createScenario = useCallback(() => {
    const label = `Scenario ${scenarios.length + 1}`
    const scenario = createDefaultScenario(label)
    addScenario(scenario)
    return scenario
  }, [addScenario, scenarios.length])

  const createFromExisting = useCallback(
    (base: ScenarioInput) => {
      const scenario: ScenarioInput = {
        ...base,
        id: crypto.randomUUID(),
        label: `${base.label} (kopi)`,
        createdAt: Date.now(),
        isBase: false,
      }
      addScenario(scenario)
      return scenario
    },
    [addScenario]
  )

  return { createScenario, createFromExisting }
}

export { createDefaultScenario }
