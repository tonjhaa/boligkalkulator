import { useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import type { AmortizationPlan } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { exportAmortizationCSV } from '@/hooks/useExport'
import { Button } from '@/components/ui/button'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from '@/components/ui/table'

interface Props {
  plan: AmortizationPlan
  label: string
  /** Eierbrøk-andeler fra fordelingsplan (valgfritt) */
  ownershipShare?: { primary: number; co: number }
}

export function AmortizationTable({ plan, label, ownershipShare }: Props) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())

  function toggleYear(year: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }

  if (plan.yearlyTotals.length === 0) return null

  const showSplit = ownershipShare && ownershipShare.primary > 0 && ownershipShare.co > 0
  const p1Pct = (ownershipShare?.primary ?? 50) / 100
  const p2Pct = (ownershipShare?.co ?? 50) / 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Klikk på et år for å se månedlig detalj
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => exportAmortizationCSV(plan, label)}
        >
          <Download className="h-3.5 w-3.5" />
          Last ned CSV
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>År</TableHead>
              <TableHead className="text-right">Terminbeløp</TableHead>
              <TableHead className="text-right">Renter</TableHead>
              <TableHead className="text-right">Avdrag</TableHead>
              <TableHead className="text-right">Restgjeld</TableHead>
              {showSplit && (
                <>
                  <TableHead className="text-right text-primary text-xs">S1 / mnd</TableHead>
                  <TableHead className="text-right text-blue-400 text-xs">S2 / mnd</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {plan.yearlyTotals.map((yr) => {
              const monthRows = plan.rows.filter((r) => r.year === yr.year)
              const isExpanded = expandedYears.has(yr.year)
              const avgMonthlyPayment = monthRows.length > 0
                ? yr.totalPayment / monthRows.length
                : 0

              return (
                <>
                  <TableRow
                    key={`year-${yr.year}`}
                    className={`cursor-pointer font-medium hover:bg-muted/50 ${yr.isRateChangeYear ? 'border-l-2 border-l-yellow-400' : ''}`}
                    onClick={() => toggleYear(yr.year)}
                  >
                    <TableCell className="w-8 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </TableCell>
                    <TableCell>
                      År {yr.year}
                      {yr.isRateChangeYear && (
                        <span className="ml-1.5 text-yellow-400 text-xs">↑ ny rente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(yr.totalPayment)}</TableCell>
                    <TableCell className="text-right text-red-400">{formatCurrency(yr.totalInterest)}</TableCell>
                    <TableCell className="text-right text-blue-400">{formatCurrency(yr.totalPrincipal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(yr.endBalance)}</TableCell>
                    {showSplit && (
                      <>
                        <TableCell className="text-right text-primary text-xs">
                          {formatCurrency(Math.round(avgMonthlyPayment * p1Pct))}
                        </TableCell>
                        <TableCell className="text-right text-blue-400 text-xs">
                          {formatCurrency(Math.round(avgMonthlyPayment * p2Pct))}
                        </TableCell>
                      </>
                    )}
                  </TableRow>

                  {isExpanded &&
                    monthRows.map((row) => (
                      <TableRow
                        key={`month-${row.month}`}
                        className="bg-muted/20 hover:bg-muted/30"
                      >
                        <TableCell />
                        <TableCell className="text-muted-foreground text-xs pl-6">
                          Mnd {row.month}
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.payment)}</TableCell>
                        <TableCell className="text-right text-xs text-red-400/80">{formatCurrency(row.interest)}</TableCell>
                        <TableCell className="text-right text-xs text-blue-400/80">{formatCurrency(row.principal)}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(row.balance)}</TableCell>
                        {showSplit && (
                          <>
                            <TableCell className="text-right text-xs text-primary/80">
                              {formatCurrency(Math.round(row.payment * p1Pct))}
                            </TableCell>
                            <TableCell className="text-right text-xs text-blue-400/80">
                              {formatCurrency(Math.round(row.payment * p2Pct))}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                </>
              )
            })}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell />
              <TableCell className="font-semibold">Totalt</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(plan.totalPaid)}</TableCell>
              <TableCell className="text-right font-semibold text-red-400">{formatCurrency(plan.totalInterestPaid)}</TableCell>
              <TableCell className="text-right font-semibold text-blue-400">{formatCurrency(plan.loanAmount)}</TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              {showSplit && (
                <>
                  <TableCell className="text-right text-xs text-primary font-semibold">
                    {formatCurrency(Math.round(plan.totalPaid * p1Pct))}
                  </TableCell>
                  <TableCell className="text-right text-xs text-blue-400 font-semibold">
                    {formatCurrency(Math.round(plan.totalPaid * p2Pct))}
                  </TableCell>
                </>
              )}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
