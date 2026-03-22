import type { DistributionPlan, DistributionRow } from '@/types'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Users, Info } from 'lucide-react'

interface Props {
  plan: DistributionPlan
}

function SplitBar({ row }: { row: DistributionRow }) {
  const pPct = row.primaryPercent
  const cPct = row.coApplicantPercent ?? 100 - pPct
  return (
    <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="bg-primary h-full transition-all"
        style={{ width: `${pPct}%` }}
        title={`Søker 1: ${pPct.toFixed(1)}%`}
      />
      <div
        className="bg-blue-400/60 h-full"
        style={{ width: `${cPct}%` }}
        title={`Søker 2: ${cPct.toFixed(1)}%`}
      />
    </div>
  )
}

function SplitRow({
  label,
  row,
  primaryName,
  coName,
  format,
}: {
  label: string
  row: DistributionRow
  primaryName: string
  coName: string
  format: (v: number) => string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <SplitBar row={row} />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground truncate">{primaryName}</p>
          <p className="font-medium text-foreground">
            {format(row.primaryAmount)}{' '}
            <span className="text-muted-foreground">({row.primaryPercent.toFixed(0)}%)</span>
          </p>
        </div>
        {row.coApplicantAmount !== undefined && (
          <div>
            <p className="text-muted-foreground truncate">{coName}</p>
            <p className="font-medium text-foreground">
              {format(row.coApplicantAmount)}{' '}
              <span className="text-muted-foreground">({(row.coApplicantPercent ?? 0).toFixed(0)}%)</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function DistributionPlanCard({ plan }: Props) {
  const primaryName = plan.primaryLabel
  const coName = plan.coApplicantLabel ?? 'Søker 2'

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Fordelingsplan</span>
        <span className="ml-auto text-xs text-muted-foreground">
          Anbefalt eierbrøk: {plan.recommendedOwnershipPercent}/{100 - plan.recommendedOwnershipPercent}
        </span>
      </div>

      {/* Fargeforklaring */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">{primaryName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-400/60" />
          <span className="text-muted-foreground">{coName}</span>
        </div>
      </div>

      <div className="space-y-4">
        <SplitRow
          label="Egenkapitalbidrag"
          row={plan.equitySplit}
          primaryName={primaryName}
          coName={coName}
          format={formatCurrency}
        />
        <SplitRow
          label="Eierbrøk (boligverdi)"
          row={plan.ownershipSplit}
          primaryName={primaryName}
          coName={coName}
          format={formatCurrency}
        />
        <SplitRow
          label="Gjeldsandel"
          row={plan.debtSplit}
          primaryName={primaryName}
          coName={coName}
          format={formatCurrency}
        />
        <SplitRow
          label="Månedlig betaling"
          row={plan.paymentSplit}
          primaryName={primaryName}
          coName={coName}
          format={formatCurrency}
        />
      </div>

      {plan.notes.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          {plan.notes.map((note, i) => (
            <div key={i} className="flex gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Vises kun når det finnes en fordelingsplan (to søkere) */
export function DistributionPlanSection({ plan }: { plan: DistributionPlan | undefined }) {
  if (!plan) return null
  return <DistributionPlanCard plan={plan} />
}

// Trenger formatPercent i prop — eksporter for å unngå tree-shaking
export { formatPercent as _fp }
