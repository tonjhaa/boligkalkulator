import { useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { calculateAll } from '@/utils/calculator'
import type { ScenarioInput } from '@/types'

/**
 * Hook som kjører beregningsmotor for et scenario og lagrer
 * resultater i Zustand-store.
 *
 * Beregningen kjøres automatisk når scenarioet endres.
 * Returnerer aktiv analyse og hjelpefunksjoner.
 */
export function useCalculator(scenarioId?: string) {
  const config = useAppStore((s) => s.config)
  const scenarios = useAppStore((s) => s.scenarios)
  const activeId = useAppStore((s) => s.activeScenarioId)
  const setAnalysis = useAppStore((s) => s.setAnalysis)
  const setAmortizationPlan = useAppStore((s) => s.setAmortizationPlan)
  const setDistributionPlan = useAppStore((s) => s.setDistributionPlan)
  const analyses = useAppStore((s) => s.analyses)
  const amortizationPlans = useAppStore((s) => s.amortizationPlans)
  const distributionPlans = useAppStore((s) => s.distributionPlans)

  const targetId = scenarioId ?? activeId
  const scenario = scenarios.find((s) => s.id === targetId)

  const runCalculation = useCallback(
    (sc: ScenarioInput) => {
      const results = calculateAll(sc, config)
      setAnalysis(sc.id, results.analysis)
      setAmortizationPlan(sc.id, results.amortization)
      if (results.distribution) {
        setDistributionPlan(sc.id, results.distribution)
      }
    },
    [config, setAnalysis, setAmortizationPlan, setDistributionPlan]
  )

  // Auto-beregn når scenario eller config endres
  useEffect(() => {
    if (scenario) {
      runCalculation(scenario)
    }
  }, [scenario, runCalculation])

  return {
    scenario,
    analysis: targetId ? analyses[targetId] : undefined,
    amortization: targetId ? amortizationPlans[targetId] : undefined,
    distribution: targetId ? distributionPlans[targetId] : undefined,
    recalculate: scenario ? () => runCalculation(scenario) : undefined,
    isCalculated: Boolean(targetId && analyses[targetId]),
  }
}

/**
 * Hook for å beregne alle scenarioer på én gang (for sammenligning).
 */
export function useAllCalculations() {
  const config = useAppStore((s) => s.config)
  const scenarios = useAppStore((s) => s.scenarios)
  const setAnalysis = useAppStore((s) => s.setAnalysis)
  const setAmortizationPlan = useAppStore((s) => s.setAmortizationPlan)
  const setDistributionPlan = useAppStore((s) => s.setDistributionPlan)
  const analyses = useAppStore((s) => s.analyses)

  const recalculateAll = useCallback(() => {
    for (const scenario of scenarios) {
      const results = calculateAll(scenario, config)
      setAnalysis(scenario.id, results.analysis)
      setAmortizationPlan(scenario.id, results.amortization)
      if (results.distribution) {
        setDistributionPlan(scenario.id, results.distribution)
      }
    }
  }, [scenarios, config, setAnalysis, setAmortizationPlan, setDistributionPlan])

  useEffect(() => {
    recalculateAll()
  }, [recalculateAll])

  return {
    scenarios,
    analyses,
    recalculateAll,
  }
}
