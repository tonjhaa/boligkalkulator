import type {
  WeightRules, GiftSettings, Occasion, RelationshipType, ClosenessLevel, LifePhase,
} from '@/types/gifts'

export const OCCASION_LABELS: Record<Occasion, string> = {
  bursdag: 'Bursdag',
  jul: 'Jul',
  bryllup: 'Bryllup',
  konfirmasjon: 'Konfirmasjon',
  dåp: 'Dåp/navnefest',
  jubileum: 'Jubileum',
  rund_dag: 'Rund dag',
  atten_år: '18-årsdag',
  student: 'Student/eksamen',
  innflytting: 'Innflytting',
  nyfødt: 'Nyfødt barn',
  vertskap: 'Vertskapsgave',
  kondolanse: 'Kondolanse/blomst',
  annet: 'Annet',
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  partner: 'Partner/samboer',
  foreldre: 'Foreldre',
  svigerforeldre: 'Svigerforeldre',
  søsken: 'Søsken',
  svigersøsken: 'Svigersøsken',
  besteforeldre: 'Besteforeldre',
  barn: 'Barn',
  stebarn: 'Stebarn',
  tante_onkel: 'Tante/onkel',
  niese_nevø: 'Niese/nevø',
  fadderbarn: 'Fadderbarn',
  nær_venn: 'Nær venn',
  venn: 'Venn',
  kollega: 'Kollega',
  nabo: 'Nabo',
  vertskap: 'Vertskap',
  annet: 'Annet',
}

export const CLOSENESS_LABELS: Record<ClosenessLevel, string> = {
  svært_nær: 'Svært nær',
  nær: 'Nær',
  normal: 'Normal',
  perifer: 'Perifer',
  symbolsk: 'Symbolsk',
}

export const LIFE_PHASE_LABELS: Record<LifePhase, string> = {
  barn_0_12: 'Barn (0–12)',
  tenåring: 'Tenåring (13–17)',
  ung_voksen: 'Ung voksen (18–25)',
  voksen: 'Voksen (26–66)',
  senior: 'Senior (67+)',
  student: 'Student',
  nyetablert: 'Nyetablert',
  småbarnsforelder: 'Småbarnsforelder',
  pensjonist: 'Pensjonist',
  ikke_relevant: 'Ikke relevant',
}

export const OWNERSHIP_LABELS: Record<import('@/types/gifts').Ownership, string> = {
  A: 'Person A',
  B: 'Person B',
  felles: 'Felles',
}

export const STATUS_LABELS: Record<import('@/types/gifts').EventStatus, string> = {
  planlagt: 'Planlagt',
  kjøpt: 'Kjøpt',
  droppet: 'Droppet',
}

export const DISTRIBUTION_LABELS: Record<import('@/types/gifts').DistributionModel, string> = {
  '50_50': '50/50',
  inntekt: 'Nettoinntektsbasert',
  eierskap: 'Eierskapsbasert',
  hybrid: 'Hybridmodell (anbefalt)',
  familie_venn: 'Familie/venn-modell',
}

export const DEFAULT_WEIGHT_RULES: WeightRules = {
  occasionBaseAmounts: {
    bursdag: 400,
    jul: 500,
    bryllup: 1000,
    konfirmasjon: 800,
    dåp: 500,
    jubileum: 600,
    rund_dag: 600,
    atten_år: 700,
    student: 500,
    innflytting: 400,
    nyfødt: 500,
    vertskap: 250,
    kondolanse: 350,
    annet: 400,
  },
  relationshipWeights: {
    partner: 1.80,
    foreldre: 1.40,
    svigerforeldre: 1.20,
    søsken: 1.30,
    svigersøsken: 1.00,
    besteforeldre: 1.10,
    barn: 1.60,
    stebarn: 1.60,
    tante_onkel: 0.90,
    niese_nevø: 1.20,
    fadderbarn: 1.20,
    nær_venn: 1.10,
    venn: 0.80,
    kollega: 0.50,
    nabo: 0.40,
    vertskap: 0.60,
    annet: 1.00,
  },
  closenessWeights: {
    svært_nær: 1.50,
    nær: 1.25,
    normal: 1.00,
    perifer: 0.75,
    symbolsk: 0.50,
  },
  lifePhaseWeights: {
    barn_0_12: 1.10,
    tenåring: 1.20,
    ung_voksen: 1.15,
    voksen: 1.00,
    senior: 0.90,
    student: 1.15,
    nyetablert: 1.20,
    småbarnsforelder: 1.00,
    pensjonist: 0.90,
    ikke_relevant: 1.00,
  },
}

export const DEFAULT_GIFT_SETTINGS: GiftSettings = {
  memberA: { name: 'Person A', monthlyNetIncome: 0 },
  memberB: { name: 'Person B', monthlyNetIncome: 0 },
  bufferPercent: 12,
  annualCap: undefined,
  roundingNearest: 50,
  distributionModel: 'hybrid',
  primaryResponsibilityShare: 0.80,
  supportShare: 0.20,
}

// Milepælsfaktor basert på anledning og alder
export function getMilestoneWeight(occasion: Occasion, age?: number): number {
  if (occasion === 'bryllup') return 2.50
  if (occasion === 'konfirmasjon') return 2.00
  if (occasion === 'dåp') return 1.50
  if (occasion === 'atten_år') return 1.60
  if (occasion === 'student') return 1.50
  if (occasion === 'innflytting') return 1.20
  if (occasion === 'nyfødt') return 1.40
  if (occasion === 'vertskap') return 0.70
  if (occasion === 'kondolanse') return 0.80
  if (occasion === 'jubileum') return 1.80
  if (occasion === 'rund_dag') {
    if (age !== undefined && age >= 70) return 1.40
    return 1.50
  }
  return 1.00
}
