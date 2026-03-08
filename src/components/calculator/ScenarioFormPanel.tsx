import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { PropertyForm } from './PropertyForm'
import { HouseholdForm } from './HouseholdForm'
import { LoanForm } from './LoanForm'
import { Home, Users, CreditCard, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ScenarioInput } from '@/types'

interface Props {
  scenario: ScenarioInput
}

export function ScenarioFormPanel({ scenario }: Props) {
  const updateScenario = useAppStore((s) => s.updateScenario)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(scenario.label)

  function saveLabel() {
    if (labelValue.trim()) {
      updateScenario(scenario.id, { label: labelValue.trim() })
    }
    setEditingLabel(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scenarionavn */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {editingLabel ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              autoFocus
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveLabel() }}
              className="h-8 text-sm font-medium"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveLabel}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-semibold text-foreground flex-1">{scenario.label}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-50 hover:opacity-100"
              onClick={() => { setLabelValue(scenario.label); setEditingLabel(true) }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Inndata-faner */}
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="property">
          <TabsList className="w-full mb-2">
            <TabsTrigger value="property" className="flex-1 gap-1.5 text-xs">
              <Home className="h-3.5 w-3.5" />
              Bolig
            </TabsTrigger>
            <TabsTrigger value="household" className="flex-1 gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Husholdning
            </TabsTrigger>
            <TabsTrigger value="loan" className="flex-1 gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Lån
            </TabsTrigger>
          </TabsList>

          <TabsContent value="property">
            <PropertyForm scenario={scenario} />
          </TabsContent>
          <TabsContent value="household">
            <HouseholdForm scenario={scenario} />
          </TabsContent>
          <TabsContent value="loan">
            <LoanForm scenario={scenario} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
