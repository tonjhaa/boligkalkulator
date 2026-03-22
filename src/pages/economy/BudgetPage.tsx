import { useState } from 'react'
import { Lock, LockOpen, Upload, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEconomyStore } from '@/application/useEconomyStore'
import { PayslipImporter } from '@/features/payslip/PayslipImporter'
import { computeBudgetTable } from '@/domain/economy/budgetTableComputer'
import type { BudgetRow, MonthMeta } from '@/domain/economy/budgetTableComputer'
import type { BudgetCategory, BudgetLine } from '@/types/economy'
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
    lockMonth,
    unlockMonth,
    addBudgetLine,
  } = useEconomyStore()

  const now = new Date()
  const [activeYear, setActiveYear] = useState(now.getFullYear())
  const [showSlipFor, setShowSlipFor] = useState<number | null>(null)
  const [addingLine, setAddingLine] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

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
  )

  const { metas, sections } = tableData

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

        <div className="flex gap-2">
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
                  className="px-1 py-2 text-center font-medium min-w-[100px] border-r border-border/40"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{MONTH_SHORT[meta.month]}</span>
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
                  <>
                    <th key={`${meta.month}-bud`} className="px-2 py-1 text-center text-muted-foreground font-normal min-w-[48px]">Bud</th>
                    <th key={`${meta.month}-fak`} className="px-2 py-1 text-center font-normal min-w-[52px] border-r border-border/40">Fak</th>
                  </>
                ) : (
                  <th
                    key={`${meta.month}-prog`}
                    colSpan={2}
                    className={cn(
                      'px-2 py-1 text-center font-normal border-r border-border/40',
                      meta.isLocked ? 'text-foreground' : 'text-muted-foreground italic',
                    )}
                  >
                    {meta.isLocked ? 'Faktisk' : 'Prog'}
                  </th>
                )
              ))}
              <th className="px-3 py-1 text-right text-muted-foreground font-normal">Bud</th>
            </tr>
          </thead>

          {/* === BODY === */}
          <tbody>
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.key)
              const isSummary = section.key === 'NETTO' || section.key === 'DISPONIBELT'

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

                    {/* Summary values in section header for NETTO and DISPONIBELT */}
                    {isSummary ? (
                      metas.map((meta) => {
                        const row = section.rows[0]
                        const cell = row.cells[meta.month - 1]
                        return meta.hasSlip ? (
                          <>
                            <td key={`${meta.month}-b`} className={cn('px-2 py-1.5 text-right', amountClass(cell.budget))}>
                              {fmtNOK(cell.budget)}
                            </td>
                            <td key={`${meta.month}-a`} className={cn('px-2 py-1.5 text-right border-r border-border/40 font-semibold', amountClass(cell.actual ?? cell.budget, true))}>
                              {fmtNOK(cell.actual ?? cell.budget)}
                            </td>
                          </>
                        ) : (
                          <td
                            key={`${meta.month}-s`}
                            colSpan={2}
                            className={cn(
                              'px-2 py-1.5 text-right border-r border-border/40 font-semibold',
                              meta.isLocked ? amountClass(cell.actual ?? cell.budget, true) : amountClass(cell.budget),
                              !meta.isLocked && 'italic text-muted-foreground',
                            )}
                          >
                            {fmtNOK(meta.isLocked ? (cell.actual ?? cell.budget) : cell.budget)}
                          </td>
                        )
                      })
                    ) : (
                      <td colSpan={TOTAL_COLS - 2} />
                    )}

                    {isSummary ? (
                      <td className={cn('px-3 py-1.5 text-right font-semibold border-l border-border/40', amountClass(section.rows[0].annualBudget, true))}>
                        {fmtNOK(section.rows[0].annualBudget)}
                      </td>
                    ) : (
                      <td />
                    )}
                  </tr>

                  {/* Data rows */}
                  {!isCollapsed && !isSummary && section.rows.map((row) => (
                    <DataRow
                      key={row.id}
                      row={row}
                      metas={metas}
                      dualColumn={section.dualColumn}
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
}: {
  row: BudgetRow
  metas: MonthMeta[]
  dualColumn: boolean
}) {
  const hasAnyNonZero = row.cells.some((c) => c.budget !== 0 || c.actual !== null)
  if (!hasAnyNonZero) return null

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10">
      <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r border-border max-w-[160px] truncate">
        {row.label}
      </td>

      {metas.map((meta) => {
        const cell = row.cells[meta.month - 1]

        if (!dualColumn) {
          // Always single cell (colspan=2)
          return (
            <td
              key={meta.month}
              colSpan={2}
              className={cn(
                'px-2 py-1.5 text-right border-r border-border/40 tabular-nums',
                cell.budget === 0 ? 'text-muted-foreground' : cell.budget < 0 ? 'text-red-400' : 'text-foreground',
              )}
            >
              {fmtNOK(cell.budget)}
            </td>
          )
        }

        // dualColumn section
        if (meta.hasSlip) {
          const actual = cell.actual ?? 0
          const deviation = actual !== 0 && cell.budget !== 0 ? actual - cell.budget : null
          return (
            <>
              <td
                key={`${meta.month}-bud`}
                className="px-2 py-1.5 text-right text-muted-foreground tabular-nums"
              >
                {cell.budget !== 0 ? fmtNOK(cell.budget) : '—'}
              </td>
              <td
                key={`${meta.month}-fak`}
                className={cn(
                  'px-2 py-1.5 text-right border-r border-border/40 font-medium tabular-nums',
                  actual < 0 ? 'text-red-400' : actual > 0 ? 'text-foreground' : 'text-muted-foreground',
                  deviation !== null && Math.abs(deviation) > Math.abs(cell.budget) * 0.1 && 'underline decoration-dotted',
                )}
                title={deviation !== null ? `Avvik: ${Math.round(deviation).toLocaleString('no-NO')}` : undefined}
              >
                {fmtNOK(actual)}
              </td>
            </>
          )
        }

        // No slip: single cell, colspan=2
        const value = meta.isLocked ? (cell.actual ?? cell.budget) : cell.budget
        return (
          <td
            key={`${meta.month}-prog`}
            colSpan={2}
            className={cn(
              'px-2 py-1.5 text-right border-r border-border/40 tabular-nums',
              !meta.isLocked && 'italic text-muted-foreground',
              meta.isLocked && value < 0 && 'text-red-400',
              meta.isLocked && value > 0 && 'text-foreground',
            )}
          >
            {fmtNOK(value)}
          </td>
        )
      })}

      <td className={cn('px-3 py-1.5 text-right font-medium border-l border-border/40 tabular-nums', amountClass(row.annualBudget))}>
        {fmtNOK(row.annualBudget)}
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
