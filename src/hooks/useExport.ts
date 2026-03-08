import type { AmortizationPlan, LoanAnalysis } from '@/types'

/** Last ned CSV med BOM for korrekt norsk tegnsetting i Excel */
function downloadBlob(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function nok(v: number) {
  return v.toLocaleString('nb-NO')
}

/** Eksporter amortiseringsplan som CSV (semikolon-separert for Excel) */
export function exportAmortizationCSV(plan: AmortizationPlan, label: string) {
  const headers = [
    'Måned', 'År', 'Terminbeløp (kr)', 'Renter (kr)', 'Avdrag (kr)',
    'Restgjeld (kr)', 'Kum. renter (kr)', 'Kum. avdrag (kr)',
  ]

  const rows = plan.rows.map((r) => [
    r.month, r.year,
    nok(r.payment), nok(r.interest), nok(r.principal),
    nok(r.balance), nok(r.cumulativeInterest), nok(r.cumulativePrincipal),
  ])

  const csv = [headers, ...rows].map((row) => row.join(';')).join('\r\n')
  const filename = `nedbetalingsplan_${label.replace(/\s+/g, '_')}.csv`
  downloadBlob(csv, filename)
}

/** Eksporter analyse-sammendrag som CSV */
export function exportAnalysisCSV(analyses: LoanAnalysis[]) {
  const headers = [
    'Scenario', 'Boligpris (kr)', 'EK %', 'Lånebeløp (kr)',
    'Gjeldsgrad', 'Terminbeløp (kr)', 'Stress-terminbeløp (kr)',
    'Disponibelt (kr)', 'Maks kjøp (kr)', 'Godkjent',
  ]

  const rows = analyses.map((a) => [
    a.scenarioLabel,
    nok(a.property.purchasePrice),
    a.equity.equityPercent.toFixed(1).replace('.', ',') + ' %',
    nok(a.property.loanAmount),
    a.debtRatio.debtRatio.toFixed(2).replace('.', ',') + 'x',
    nok(a.affordability.monthlyPaymentNormal),
    nok(a.affordability.monthlyPaymentStress),
    nok(a.affordability.disposableAmount),
    nok(a.maxPurchase.maxPurchasePrice),
    a.status.approved ? 'Ja' : 'Nei',
  ])

  const csv = [headers, ...rows].map((row) => row.join(';')).join('\r\n')
  downloadBlob(csv, 'scenariosammenligning.csv')
}
