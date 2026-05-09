// ============================================================
// GAVEPLANLEGGER — TypeScript-interfaces
// ============================================================

export type RelationshipType =
  | 'partner' | 'foreldre' | 'svigerforeldre' | 'søsken' | 'svigersøsken'
  | 'besteforeldre' | 'barn' | 'stebarn' | 'tante_onkel' | 'niese_nevø'
  | 'fadderbarn' | 'nær_venn' | 'venn' | 'kollega' | 'nabo'
  | 'vertskap' | 'annet'

export type LifePhase =
  | 'barn_0_12' | 'tenåring' | 'ung_voksen' | 'voksen' | 'senior'
  | 'student' | 'nyetablert' | 'småbarnsforelder' | 'pensjonist' | 'ikke_relevant'

export type Ownership = 'A' | 'B' | 'felles'

export type Occasion =
  | 'bursdag' | 'jul' | 'bryllup' | 'konfirmasjon' | 'dåp'
  | 'jubileum' | 'rund_dag' | 'atten_år' | 'student' | 'innflytting'
  | 'nyfødt' | 'vertskap' | 'kondolanse' | 'annet'

export type EventStatus = 'planlagt' | 'kjøpt' | 'droppet'

export type DistributionModel = '50_50' | 'inntekt' | 'eierskap' | 'hybrid' | 'familie_venn'

export interface GiftRecipient {
  id: string
  name: string
  relationshipType: RelationshipType
  birthDate?: string        // "YYYY-MM-DD"
  birthMonth?: number       // 1–12 (brukes hvis fullstendig dato ikke er kjent)
  birthYear?: number
  lifePhase: LifePhase
  ownership: Ownership
  receivesBirthdayGift: boolean
  receivesChristmasGift: boolean
  occasionOverrides?: Partial<Record<Occasion, number>>  // per-person beløpsoverride
  notes?: string
}

export interface GiftEvent {
  id: string
  recipientId: string
  occasion: Occasion
  date?: string             // "YYYY-MM-DD"
  month?: number            // 1–12, brukt hvis ingen dato
  year?: number
  ownership: Ownership      // kan overstyre mottakerens eierskap
  calculatedAmount: number
  manualAmount?: number     // manuell overstyring
  isLocked: boolean         // låste beløp ekskluderes fra normalisering
  status: EventStatus
  actualAmount?: number
  notes?: string
}

export interface HouseholdMember {
  name: string
  monthlyNetIncome: number
}

export interface GiftSettings {
  memberA: HouseholdMember
  memberB: HouseholdMember
  bufferPercent: number             // f.eks. 12
  annualCap?: number                // valgfri øvre ramme
  roundingNearest: 1 | 50 | 100
  distributionModel: DistributionModel
  primaryResponsibilityShare: number  // standard 0.80
  supportShare: number                // standard 0.20
}

export interface WeightRules {
  // Fast grunnbeløp per relasjonstype (brukes for alle anledninger med mindre override)
  relationshipBaseAmounts: Record<RelationshipType, number>
  // Spesifikke beløp for relasjon × anledning (overstyrer grunnbeløpet)
  occasionOverrides: Partial<Record<RelationshipType, Partial<Record<Occasion, number>>>>
}

export interface EventShare {
  personA: number
  personB: number
}

export interface MonthlyBreakdown {
  month: number
  totalCost: number
  personAShare: number
  personBShare: number
  events: GiftEvent[]
  isHeavy: boolean
}

export interface GiftCalculationResult {
  annualTotal: number
  annualTotalWithBuffer: number
  personATotal: number
  personBTotal: number
  personAMonthlySaving: number
  personBMonthlySaving: number
  monthlyBreakdown: MonthlyBreakdown[]
  warnings: string[]
  insights: string[]
}

export interface GiftPurchase {
  id: string
  giftEventId: string
  plannedAmount: number
  actualAmount: number
  purchasedDate: string
  notes?: string
}
