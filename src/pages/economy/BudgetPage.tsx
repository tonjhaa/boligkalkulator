import { useState, useMemo } from 'react'
import { Lock, LockOpen, Upload, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEconomyStore } from '@/application/useEconomyStore'
import { PayslipImporter } from '@/features/payslip/PayslipImporter'
import { computeBudgetTable } from '@/domain/economy/budgetTableComputer'
import type { BudgetRow, MonthMeta } from '@/domain/economy/budgetTableComputer'
import { forecastJune } from '@/domain/economy/holidayPayCalculator'
import type { BudgetCategory, BudgetLine, TemporaryPayEntry } from '@/types/economy'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

const CATEGORY_GROUPS: { label: string; categories: BudgetCategory[] }[] = [
  { label: 'Inntekter', categories: ['lonn', 'tillegg', 'atf', 'feriepenger', 'annen_inntekt'] },
  { label: 'Trekk', categories: ['skatt', 'pensjon', 'fagforening', 'husleietrekk'] },
  { label: 'Gjeld', categories: ['studielaan', 'billaan', 'kredittkort', 'annen_gjeld'] },
  { label: 'Faste utgifter', categories: ['bolig', 'transport', 'mat', 'helse', 'abonnement', 'forsikring', 'klær', 'fritid', 'annet_forbruk'] },
  { label: 'Sparing', categories: ['bsu', 'fond', 'krypto', 'buffer', 'annen_sparing'] },
]

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  lonn: 'Lønn', tillegg: 'Tillegg', atf: 'ATF', feriepenger: 'Feriepenger', annen_inntekt: 'Annen inntekt',
  skatt: 'Skatt', pensjon: 'Pensjon', fagforening: 'Fagforening', husleietrekk: 'Husleietrekk',
  studielaan: 'Studielån', billaan: 'Billån', kredittkort: 'Kredittkort', annen_gjeld: 'Annen gjeld',
  bolig: 'Bolig', transport: 'Transport', mat: 'Mat', helse: 'Helse', abonnement: 'Abonnement',
  forsikring: 'Forsikring', klær: 'Klær', fritid: 'Fritid', annet_forbruk: 'Annet forbruk',
  bsu: 'BSU', fond: 'Fond', krypto: 'Krypto', buffer: 'Buffer', annen_sparing: 'Annen sparing',
}

function fmtNOK(n: number): string {
  if (n === 0) return '—'
  return Math.round(n).toLocaleString('no-NO')
}

function amountClass(n: number, bold = false): string {
  return cn(
    'tabular-nums',
    bold && 'font-semibold',
    n < 0 ? 'text-red-400' : n > 0 ? 'text-foreground' : 'text-muted-foreground',
  )
}

// ----------------------------------------------------------------
// BudgetPage
// ----------------------------------------------------------------

export function BudgetPage() {
  const {
    profile,
    budgetTemplate,
    monthHistory,
    atfEntries,
    savingsAccounts,
    debts,
    subscriptions,
    insurances,
    temporaryPayEntries,
    lockMonth,
    unlockMonth,
    addBudgetLine,
    budgetOverrides,
    setBudgetOverride,
    clearBudgetOverride,
    addTemporaryPay,
    removeTemporaryPay,
  } = useEconomyStore()

  const now = new Date()
  const [activeYear, setActiveYear] = useState(now.getFullYear())
  const [showSlipFor, setShowSlipFor] = useState<number | null>(null)
  const [addingLine, setAddingLine] = useState(false)
  const [showFungering, setShowFungering] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [highlightedMonth, setHighlightedMonth] = useState<number | null>(null)

  const yearOverrides = useMemo(() => {
    const prefix = `${activeYear}:`
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(budgetOverrides)) {
      if (k.startsWith(prefix)) result[k.slice(prefix.length)] = v
    }
    return result
  }, [budgetOverrides, activeYear])

  const juneForecast = profile
    ? forecastJune(activeYear, monthHistory, profile, atfEntries)
    : undefined

  const tableData = computeBudgetTable(
    activeYear,
    profile,
    budgetTemplate,
    monthHistory,
    atfEntries,
    savingsAccounts,
    debts,
    subscriptions,
    insurances,
    yearOverrides,
    temporaryPayEntries,
    juneForecast ?? undefined,
  )

  const { metas, sections, estimatedAnnualGrowthRate } = tableData

  function handleOverride(rowId: string, month: number, value: number | null) {
    if (value === null) clearBudgetOverride(activeYear, month, rowId)
    else setBudgetOverride(activeYear, month, rowId, value)
  }

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const years = [activeYear - 1, activeYear, activeYear + 1]

  // Total cols = 1 (label) + 12 × 2 (months) + 1 (årssum) = 26
  const TOTAL_COLS = 26

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ---- Top bar ---- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {years.map((y) => (
              <Button
                key={y}
                variant={activeYear === y ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 px-3"
                onClick={() => setActiveYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
          {estimatedAnnualGrowthRate !== null && (
            <span className="text-xs text-muted-foreground">
              Estimert lønnsøkning:{' '}
              <span className="text-green-400 font-medium">
                ~{(estimatedAnnualGrowthRate * 100).toFixed(1)} % / år
              </span>
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant={showFungering ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setShowFungering((v) => !v)}
          >
            Fungering
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setAddingLine(true)}
          >
            <Plus className="h-3 w-3" /> Ny linje
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setShowSlipFor(now.getMonth() + 1)}
          >
            <Upload className="h-3 w-3" /> Last opp slipp
          </Button>
        </div>
      </div>

      {/* ---- Fungering panel ---- */}
      {showFungering && (
        <FungeringPanel
          entries={temporaryPayEntries}
          onAdd={addTemporaryPay}
          onRemove={removeTemporaryPay}
        />
      )}

      {/* ---- Table ---- */}
      <div className="overflow-auto flex-1">
        <table className="text-xs border-collapse min-w-max">
          {/* === HEADER === */}
          <thead className="sticky top-0 z-20">
            {/* Row 1: Month names (each spans 2 cols) */}
            <tr className="bg-muted/90 border-b border-border">
              <th className="sticky left-0 z-30 bg-muted/90 px-3 py-2 text-left font-medium min-w-[160px] border-r border-border">
                Post
              </th>
              {metas.map((meta) => (
                <th
                  key={meta.month}
                  colSpan={2}
                  className={cn(
                    'px-1 py-2 text-center font-medium min-w-[100px] border-r border-border/40',
                    highlightedMonth === meta.month && 'bg-sky-500/15',
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    <button
                      className={cn(
                        'hover:text-sky-400 transition-colors',
                        highlightedMonth === meta.month && 'text-sky-400',
                      )}
                      onClick={() => setHighlightedMonth(highlightedMonth === meta.month ? null : meta.month)}
                    >
                      {MONTH_SHORT[meta.month]}
                    </button>
                    {meta.isLocked ? (
                      <button
                        title="Lås opp måned"
                        onClick={() => unlockMonth(activeYear, meta.month)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Lock className="h-2.5 w-2.5" />
                      </button>
                    ) : (
                      <button
                        title="Last opp lønnsslipp"
                        onClick={() => setShowSlipFor(meta.month)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <LockOpen className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium min-w-[80px]">Årssum</th>
            </tr>

            {/* Row 2: Sub-headers (Bud | Fak or Prog) */}
            <tr className="bg-muted/70 border-b border-border">
              <th className="sticky left-0 z-30 bg-muted/70 px-3 py-1 border-r border-border" />
              {metas.map((meta) => (
                meta.hasSlip ? (
                  <th
                    key={`${meta.month}-fak`}
                    colSpan={2}
                    className={cn('px-2 py-1 text-center font-normal min-w-[100px] border-r border-border/40', highlightedMonth === meta.month && 'bg-sky-500/15')}
                  >
                    Faktisk
                  </th>
                ) : (
                  <th
                    key={`${meta.month}-prog`}
                    colSpan={2}
                    className={cn(
                      'px-2 py-1 text-center font-normal border-r border-border/40',
                      meta.isLocked ? 'text-foreground' : 'text-muted-foreground italic',
                      highlightedMonth === meta.month && 'bg-sky-500/15',
                    )}
                  >
                    {meta.isLocked ? 'Faktisk' : 'Prog'}
                  </th>
                )
              ))}
              <th className="px-3 py-1 text-right text-muted-foreground font-normal">År</th>
            </tr>
          </thead>

          {/* === BODY === */}
          <tbody>
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.key)
              const isSummary = section.key === 'NETTO' || section.key === 'DISPONIBELT' || section.key === 'OPPSUMMERING'

              return (
                <>
                  {/* Section header */}
                  <tr
                    key={`sh-${section.key}`}
                    className={cn(
                      'border-y border-border/50 cursor-pointer select-none',
                      isSummary ? 'bg-muted/50' : 'bg-muted/20',
                    )}
                    onClick={() => !isSummary && toggleSection(section.key)}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 px-3 py-1.5 font-semibold uppercase tracking-wide border-r border-border',
                        isSummary ? 'bg-muted/60' : 'bg-muted/30',
                        section.colorClass,
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {!isSummary && (
                          isCollapsed
                            ? <ChevronRight className="h-3 w-3 shrink-0" />
                            : <ChevronDown className="h-3 w-3 shrink-0" />
                        )}
                        {section.label}
                      </div>
                    </td>

                    {/* Summary values in section header for NETTO and DISPONIBELT (not OPPSUMMERING) */}
                    {isSummary && section.key !== 'OPPSUMMERING' ? (
                      metas.map((meta) => {
                        const row = section.rows[0]
                        const cell = row.cells[meta.month - 1]
                        const hl = highlightedMonth === meta.month
                        return meta.hasSlip ? (
                          <td
                            key={`${meta.month}-a`}
                            colSpan={2}
                            className={cn('px-2 py-1.5 text-right border-r border-border/40 font-semibold', amountClass(cell.actual ?? cell.budget, true), hl && 'bg-sky-500/15')}
                          >
                            {fmtNOK(cell.actual ?? cell.budget)}
                          </td>
                        ) : (
                          <td
                            key={`${meta.month}-s`}
                            colSpan={2}
                            className={cn(
                              'px-2 py-1.5 text-right border-r border-border/40 font-semibold',
                              meta.isLocked ? amountClass(cell.actual ?? cell.budget, true) : amountClass(cell.budget),
                              !meta.isLocked && 'italic text-muted-foreground',
                              hl && 'bg-sky-500/15',
                            )}
                          >
                            {fmtNOK(meta.isLocked ? (cell.actual ?? cell.budget) : cell.budget)}
                          </td>
                        )
                      })
                    ) : (
                      <td colSpan={TOTAL_COLS - 2} />
                    )}

                    {isSummary && section.key !== 'OPPSUMMERING' ? (
                      (() => {
                        const summaryRow = section.rows[0]
                        const annualSum = metas.reduce((s, meta) => {
                          const cell = summaryRow.cells[meta.month - 1]
                          if (meta.hasSlip) return s + (cell.actual ?? cell.budget)
                          if (meta.isLocked) return s + (cell.actual ?? cell.budget)
                          return s + cell.budget
                        }, 0)
                        return (
                          <td className={cn('px-3 py-1.5 text-right font-semibold border-l border-border/40', amountClass(annualSum, true))}>
                            {fmtNOK(annualSum)}
                          </td>
                        )
                      })()
                    ) : (
                      <td />
                    )}
                  </tr>

                  {/* Data rows — alltid synlig for OPPSUMMERING, ellers avhengig av collapsed */}
                  {(section.key === 'OPPSUMMERING' || (!isCollapsed && !isSummary)) && section.rows.map((row) => (
                    <DataRow
                      key={row.id}
                      row={row}
                      metas={metas}
                      dualColumn={section.dualColumn}
                      isEditable={section.key !== 'NETTO' && section.key !== 'DISPONIBELT' && section.key !== 'OPPSUMMERING'}
                      yearOverrides={yearOverrides}
                      onOverride={(month, value) => handleOverride(row.id, month, value)}
                      highlightedMonth={highlightedMonth}
                    />
                  ))}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ---- Payslip modal ---- */}
      {showSlipFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background rounded-lg p-5 w-full max-w-lg mx-4 space-y-4 border border-border">
            <p className="font-semibold text-sm">
              Last opp lønnsslipp — {MONTH_SHORT[showSlipFor]} {activeYear}
            </p>
            <PayslipImporter onImported={() => setShowSlipFor(null)} />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!monthHistory.find((m) => m.year === activeYear && m.month === showSlipFor)) {
                    lockMonth(activeYear, showSlipFor)
                  }
                  setShowSlipFor(null)
                }}
              >
                <Lock className="h-3 w-3 mr-1" /> Lås uten slipp
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSlipFor(null)}>Avbryt</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Add budget line modal ---- */}
      {addingLine && (
        <AddBudgetLineModal
          onSave={(line) => { addBudgetLine(line); setAddingLine(false) }}
          onCancel={() => setAddingLine(false)}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// DataRow component
// ----------------------------------------------------------------

function DataRow({
  row,
  metas,
  dualColumn,
  isEditable = false,
  yearOverrides,
  onOverride,
  highlightedMonth,
}: {
  row: BudgetRow
  metas: MonthMeta[]
  dualColumn: boolean
  isEditable?: boolean
  yearOverrides?: Record<string, number>
  onOverride?: (month: number, value: number | null) => void
  highlightedMonth?: number | null
}) {
  const [editingMonth, setEditingMonth] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(month: number, val: number) {
    setEditingMonth(month)
    setEditValue(String(Math.round(val)))
  }
  function commitEdit() {
    if (editingMonth === null) return
    const v = parseFloat(editValue)
    if (!isNaN(v)) onOverride?.(editingMonth, v)
    setEditingMonth(null)
  }
  function cancelEdit() { setEditingMonth(null) }

  const hasAnyNonZero = row.cells.some((c) => c.budget !== 0 || c.actual !== null)
  if (!hasAnyNonZero) return null

  // Årssum som reflekterer nøyaktig hva som vises per celle
  const displayAnnualSum = row.isCumulative
    // YTD-rader: årssum = desember-verdi (= full årstotal)
    ? (() => {
        const decMeta = metas[11]
        const decCell = row.cells[11]
        if (!decMeta || !decCell) return 0
        if (decMeta.hasSlip) return decCell.actual ?? decCell.budget
        if (decMeta.isLocked) return decCell.actual ?? decCell.budget
        return decCell.budget
      })()
    : metas.reduce((s, meta) => {
        const cell = row.cells[meta.month - 1]
        const overrideKey = `${meta.month}:${row.id}`
        const hasOverride = yearOverrides && overrideKey in yearOverrides
        if (hasOverride) return s + yearOverrides![overrideKey]
        if (meta.hasSlip) return s + (cell.actual ?? 0)
        if (meta.isLocked) return s + (cell.actual ?? cell.budget)
        return s + cell.budget
      }, 0)

  // Kumulative rader (YTD): alltid positiv farge, uten avviksmarkering
  if (row.isCumulative) {
    return (
      <tr className="border-b border-border/20 hover:bg-muted/10">
        <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r border-border max-w-[160px] truncate text-muted-foreground text-xs">
          {row.label}
        </td>
        {metas.map((meta) => {
          const cell = row.cells[meta.month - 1]
          const hl = highlightedMonth === meta.month
          if (meta.hasSlip) {
            return (
              <td key={`${meta.month}-a`} colSpan={2} className={cn('px-2 py-1.5 text-right border-r border-border/40 tabular-nums text-xs font-medium', hl && 'bg-sky-500/15')}>
                {fmtNOK(cell.actual ?? cell.budget)}
              </td>
            )
          }
          return (
            <td
              key={`${meta.month}-p`}
              colSpan={2}
              className={cn('px-2 py-1.5 text-right border-r border-border/40 tabular-nums text-xs italic text-muted-foreground', hl && 'bg-sky-500/15')}
            >
              {fmtNOK(cell.budget)}
            </td>
          )
        })}
        <td className="px-3 py-1.5 text-right font-medium border-l border-border/40 tabular-nums text-xs text-muted-foreground">
          {fmtNOK(displayAnnualSum)}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10">
      <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r border-border max-w-[160px] truncate">
        {row.label}
      </td>

      {metas.map((meta) => {
        const cell = row.cells[meta.month - 1]
        const hl = highlightedMonth === meta.month

        if (!dualColumn) {
          return (
            <td
              key={meta.month}
              colSpan={2}
              className={cn(
                'px-2 py-1.5 text-right border-r border-border/40 tabular-nums',
                cell.budget === 0 ? 'text-muted-foreground' : cell.budget < 0 ? 'text-red-400' : 'text-foreground',
                hl && 'bg-sky-500/15',
              )}
            >
              {fmtNOK(cell.budget)}
            </td>
          )
        }

        if (meta.hasSlip) {
          const actual = cell.actual ?? 0
          const deviation = actual !== 0 && cell.budget !== 0 ? actual - cell.budget : null
          return (
            <td
              key={`${meta.month}-fak`}
              colSpan={2}
              className={cn(
                'px-2 py-1.5 text-right border-r border-border/40 font-medium tabular-nums',
                actual < 0 ? 'text-red-400' : actual > 0 ? 'text-foreground' : 'text-muted-foreground',
                deviation !== null && Math.abs(deviation) > Math.abs(cell.budget) * 0.1 && 'underline decoration-dotted',
                hl && 'bg-sky-500/15',
              )}
              title={deviation !== null ? `Avvik: ${Math.round(deviation).toLocaleString('no-NO')}` : undefined}
            >
              {fmtNOK(actual)}
            </td>
          )
        }

        if (editingMonth === meta.month && isEditable) {
          return (
            <td key={`${meta.month}-edit`} colSpan={2} className={cn('px-1 py-0.5 border-r border-border/40', hl && 'bg-sky-500/15')}>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                autoFocus
                className="w-full bg-muted/30 text-right text-xs px-1 py-0.5 rounded outline-none tabular-nums"
              />
            </td>
          )
        }

        const overrideKey = `${meta.month}:${row.id}`
        const hasOverride = yearOverrides && overrideKey in yearOverrides
        const displayVal = hasOverride ? yearOverrides![overrideKey] : (meta.isLocked ? (cell.actual ?? cell.budget) : cell.budget)

        return (
          <td
            key={`${meta.month}-prog`}
            colSpan={2}
            className={cn(
              'px-2 py-1.5 text-right border-r border-border/40 tabular-nums group/cell',
              !meta.isLocked && !hasOverride && 'italic text-muted-foreground',
              meta.isLocked && displayVal < 0 && 'text-red-400',
              meta.isLocked && displayVal > 0 && 'text-foreground',
              hasOverride && 'text-amber-400 not-italic',
              isEditable && !meta.isLocked && 'cursor-text hover:bg-muted/20',
              hl && 'bg-sky-500/15',
            )}
            onClick={() => isEditable && !meta.isLocked && startEdit(meta.month, displayVal)}
          >
            <span className="flex items-center justify-end gap-1">
              {fmtNOK(displayVal)}
              {isEditable && !meta.isLocked && (
                <button
                  className={cn(
                    'text-xs leading-none transition-colors',
                    hasOverride
                      ? 'text-amber-400 hover:text-red-400'
                      : 'opacity-0 group-hover/cell:opacity-100 text-muted-foreground hover:text-red-400',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (hasOverride && displayVal === 0) onOverride?.(meta.month, null)
                    else onOverride?.(meta.month, 0)
                  }}
                  title={hasOverride && displayVal === 0 ? 'Tilbakestill til beregnet' : 'Sett til 0'}
                >×</button>
              )}
            </span>
          </td>
        )
      })}

      <td className={cn('px-3 py-1.5 text-right font-medium border-l border-border/40 tabular-nums', amountClass(displayAnnualSum))}>
        {fmtNOK(displayAnnualSum)}
      </td>
    </tr>
  )
}

// ----------------------------------------------------------------
// Add Budget Line Modal
// ----------------------------------------------------------------

function AddBudgetLineModal({
  onSave,
  onCancel,
}: {
  onSave: (line: BudgetLine) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<BudgetCategory>('annet_forbruk')
  const [amount, setAmount] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [isVariable, setIsVariable] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background rounded-lg p-5 w-full max-w-sm mx-4 space-y-4 border border-border">
        <p className="font-semibold text-sm">Ny budsjettlinje</p>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="f.eks. Netflix, Treningssenter"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Kategori</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as BudgetCategory)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_GROUPS.map((g) =>
                  g.categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {g.label}: {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Beløp (negativt = utgift, f.eks. -450)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="-450"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="h-3 w-3" />
              Gjentakende (vises hver måned)
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={isVariable} onChange={(e) => setIsVariable(e.target.checked)} className="h-3 w-3" />
              Variabelt beløp
            </label>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Avbryt</Button>
          <Button
            size="sm"
            disabled={!label.trim() || !amount}
            onClick={() =>
              onSave({
                id: crypto.randomUUID(),
                label: label.trim(),
                category,
                amount: parseFloat(amount) || 0,
                isRecurring,
                source: 'manual',
                isLocked: false,
                isVariable,
              })
            }
          >
            Lagre
          </Button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// FungeringPanel
// ----------------------------------------------------------------

function FungeringPanel({
  entries,
  onAdd,
  onRemove,
}: {
  entries: TemporaryPayEntry[]
  onAdd: (e: TemporaryPayEntry) => void
  onRemove: (id: string) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ label: '', fromDate: today, toDate: today, aarslonn: 0 })
  const [adding, setAdding] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleSave() {
    if (!form.label.trim()) { setSaveError('Beskrivelse mangler'); return }
    if (!form.fromDate || !form.toDate) { setSaveError('Datoer mangler'); return }
    if (form.toDate < form.fromDate) { setSaveError('Til-dato må være etter fra-dato'); return }
    if (form.aarslonn <= 0) { setSaveError('Årslønn må være større enn 0'); return }
    setSaveError(null)
    onAdd({ id: crypto.randomUUID(), label: form.label.trim(), fromDate: form.fromDate, toDate: form.toDate, maanedslonn: Math.round(form.aarslonn / 12) })
    setForm({ label: '', fromDate: today, toDate: today, aarslonn: 0 })
    setAdding(false)
  }

  return (
    <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">Midlertidig lønn (fungering)</p>
        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3 w-3" /> Legg til
        </Button>
      </div>

      {adding && (
        <><div className="flex flex-wrap items-end gap-2 text-xs">
          <div className="space-y-0.5">
            <Label className="text-xs">Beskrivelse</Label>
            <Input
              className="h-7 text-xs w-48"
              placeholder="f.eks. Fungering som major"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs">Fra dato</Label>
            <Input type="date" className="h-7 text-xs w-36" value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs">Til dato</Label>
            <Input type="date" className="h-7 text-xs w-36" value={form.toDate} onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))} />
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs">Årslønn (kr)</Label>
            <Input
              type="number"
              className="h-7 text-xs w-36"
              placeholder="f.eks. 700000"
              value={form.aarslonn || ''}
              onChange={(e) => setForm((f) => ({ ...f, aarslonn: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          {form.aarslonn > 0 && (
            <div className="space-y-0.5 self-end pb-1.5">
              <p className="text-muted-foreground text-xs">= {Math.round(form.aarslonn / 12).toLocaleString('no-NO')} kr/mnd</p>
            </div>
          )}
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Lagre</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setSaveError(null) }}>Avbryt</Button>
        </div>
        {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        </>
      )}

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 text-xs rounded border border-border/50 px-2 py-1.5">
              <span className="font-medium">{e.label}</span>
              <span className="text-muted-foreground">{e.fromDate} → {e.toDate}</span>
              <span className="font-mono text-green-500">{Math.round(e.maanedslonn * 12).toLocaleString('no-NO')} kr/år <span className="text-muted-foreground font-normal">({Math.round(e.maanedslonn).toLocaleString('no-NO')} kr/mnd)</span></span>
              <button
                className="text-muted-foreground hover:text-red-400 transition-colors ml-2"
                onClick={() => onRemove(e.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Ingen fungeringsperioder registrert.</p>
      )}
    </div>
  )
}
