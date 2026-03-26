// ============================================================
// MIN ØKONOMI — Sentrale TypeScript-interfaces
// ============================================================

// ------------------------------------------------------------
// BUDSJETTLINJER
// ------------------------------------------------------------

export type BudgetCategory =
  // Inntekter
  | 'lonn' | 'tillegg' | 'atf' | 'feriepenger' | 'annen_inntekt'
  // Trekk (negative beløp)
  | 'skatt' | 'pensjon' | 'fagforening' | 'husleietrekk'
  // Gjeld
  | 'studielaan' | 'billaan' | 'kredittkort' | 'annen_gjeld'
  // Faste utgifter
  | 'bolig' | 'transport' | 'mat' | 'helse'
  | 'abonnement' | 'forsikring' | 'klær' | 'fritid' | 'annet_forbruk'
  // Sparing
  | 'bsu' | 'fond' | 'krypto' | 'buffer' | 'annen_sparing'

export interface BudgetLine {
  id: string
  label: string           // fritekst, f.eks. "Netflix", "Studielån"
  category: BudgetCategory
  amount: number          // negativt = utgift/trekk
  isRecurring: boolean    // false = engangshendelse
  source: 'manual' | 'imported' | 'auto'
  isLocked: boolean       // true = auto-generert fra slipp, kan ikke slettes
  isVariable: boolean     // true = beløpet varierer (f.eks. Norsk Tipping)
  notes?: string
}

export interface BudgetTemplate {
  lines: BudgetLine[]
  lastUpdated: string     // ISO-dato
}

// ------------------------------------------------------------
// LØNNSSLIPPER OG PROFIL
// ------------------------------------------------------------

export interface ArtskopePost {
  artskode: string        // f.eks. "1501", "/440", "7000"
  navn: string
  belop: number
}

export interface ParsetLonnsslipp {
  periode: { year: number; month: number }
  ansattnummer: string
  loennstrinn: number
  maanedslonn: number            // artskode 1S01
  fasteTillegg: ArtskopePost[]   // 1501, 1162, 106G osv.
  trekk: ArtskopePost[]          // /440, 7000, 3020, 3209, 1620, 6100
  bruttoSum: number
  nettoUtbetalt: number
  feriepengegrunnlag: number     // YTD feriepengegrunnlag
  opptjentFerie: number          // Opptjent ferie i kr (YTD)
  skattetrekk: number            // artskode /440
  ekstraTrekk: number            // artskode 1620
  husleietrekk: number           // artskode 3209
  pensjonstrekk: number          // artskode 7000
  fagforeningskontingent: number // artskode 3020
  ouFond: number                 // artskode 6100
  gruppelivspremie: number       // artskode 7005 (arbeidsgiverbetalt, informasjonslinje)
  avregningsdato?: string        // f.eks. "12.03.2026"
  hittilBrutto: number           // Hitt. Sum Norge (YTD brutto)
  hittilPensjon: number          // YTD pensjonstrekk
  hittilForskuddstrekk: number   // YTD forskuddstrekk
  /** ATF-satser funnet på slippen: artskode → sats per dag/time */
  atfRater?: Record<string, number>
  /** /440-grunnlaget (lønnsgrunnlag for tabelltrekk, f.eks. 61 278 kr) */
  tabelltrekkGrunnlag: number
  /** /440-trekk beløp (positivt tall, f.eks. 18 478 kr) */
  tabelltrekkBelop: number
  /** Trekktabellnummer fra /440-linjen (f.eks. 8010) */
  tabellnummer?: number
}

/** Siste kjente ATF-sats fra importert slipp, for én artskode */
export interface KnownATFRate {
  sats: number          // sats per dag eller time (fra sats-kolonnen på slippen)
  fraAarslonn: number   // maanedslonn × 12 da satsen ble registrert
  dato: string          // "YYYY-MM" (slippens periode)
}

export interface EmploymentProfile {
  employer: 'forsvaret' | 'custom'
  baseMonthly: number            // grunnlønn per måned
  fixedAdditions: {
    kode: string
    label: string
    amount: number
  }[]
  lastKnownTaxWithholding: number     // siste kjente skattetrekk
  extraTaxWithholding: number          // ekstra forskuddstrekk (1620)
  housingDeduction: number             // husleietrekk forsvarsbolig (3209)
  pensionPercent: number               // SPK-prosent
  unionFee: number                     // fagforeningskontingent
  atfEnabled: boolean
  /** Siste kjente ATF-satser fra importerte slipper, nøkkel = artskode (2230, 2232 osv.) */
  knownATFRates?: Record<string, KnownATFRate>
  /**
   * Effektiv /440-trekkprosent fra siste importerte slipp (f.eks. 30.15).
   * Brukes til ATF-skatteestimering: ATF-brutto × denne prosenten.
   */
  lastKnownTableTaxPercent?: number
  /** Trekktabellnummer fra siste importerte slipp (f.eks. 8010) */
  tabellnummer?: number
  /** Skatteprognose for inneværende år — meldt til skatteetaten */
  taxForecast?: {
    year: number
    expectedIncome: number  // forventet pensjonsgivende inntekt
    expectedTax: number     // forventet skatt å betale totalt
  }
  /** Ferieperioder for året */
  vacationPeriods?: VacationPeriod[]
  /** Antall feriedager per kalenderår (standard 25) */
  vacationDaysPerYear?: number
}

export interface VacationPeriod {
  id: string
  label: string             // f.eks. "Sommerferie", "Juleferie"
  lastWorkDayBefore: string // ISO — siste arbeidsdag, nedtelling hit
  firstWorkDayAfter: string // ISO — første arbeidsdag tilbake
}

// ------------------------------------------------------------
// MÅNEDS-RECORDS
// ------------------------------------------------------------

export interface MonthRecord {
  year: number
  month: number
  isLocked: boolean                    // låst = faktiske tall, ikke prognose
  source: 'manual' | 'imported_slip' | 'forecast'
  lines: BudgetLine[]
  nettoUtbetalt: number
  disposable: number                   // beregnet disponibelt etter alle trekk
  slipData?: ParsetLonnsslipp          // raw slip-data for låste måneder
  slipPdfBase64?: string               // PDF-fil lagret som base64 (maks 12 slipper)
}

// ------------------------------------------------------------
// ATF
// ------------------------------------------------------------

export type ATFLønnskode =
  | 'ØV_MAN_FRE'           // dagssats hverdag
  | 'ØV_LØR_SØN'           // dagssats helg
  | 'ØV_OT_50_MAN_FRE'     // overtid inntil 7t, 50% påslag
  | 'ØV_TIME_MAN_FRE'      // ordinær timesats
  | 'VAKT'
  | 'FA1' | 'FA2' | 'PK' | 'FØPP'

export interface ATFPeriode {
  kode: ATFLønnskode
  antallDager?: number     // for dagssatser
  antallTimer?: number     // for timesatser
}

export interface ATFDatoRad {
  dato: string            // "2026-03-09"
  dagType: 'hverdag' | 'helg' | 'helligdag'
  artskode: string        // "2230", "2232", "2236", "2242" etc.
  beskrivelse: string
  antall: number          // hours or days
  enhet: 'timer' | 'døgn'
  sats: number
  belop: number
}

export interface ATFEntry {
  id: string
  year: number
  øvelsesnavn: string
  perioder: ATFPeriode[]
  beregnetBeløp: number    // sum av alle perioder
  tidskompensasjonTimer: number
  notat?: string
  fraDateISO?: string      // "2026-03-09T07:30"
  tilDateISO?: string      // "2026-03-19T15:30"
  øvelsestype?: 'døgn' | 'time'
  datoRader?: ATFDatoRad[]
  /** Måned ATF utbetales (1–12). Beregnes automatisk som måneden etter øvelsens slutt. */
  payoutMonth?: number
  /** År ATF utbetales. Kan avvike fra year hvis øvelsen slutter i desember. */
  payoutYear?: number
  /** Input-årslønn lagret for forhåndsutfylling ved redigering. */
  årslønnInput?: number
  /** Input faste tillegg lagret for forhåndsutfylling ved redigering. */
  fasteTilleggInput?: number
}

// ------------------------------------------------------------
// SPARING
// ------------------------------------------------------------

export type SavingsAccountType = 'BSU' | 'fond' | 'krypto' | 'sparekonto' | 'annet'

export interface RateHistoryEntry {
  fromDate: string         // ISO-dato
  rate: number             // prosent, f.eks. 6.3
}

export interface BalanceHistoryEntry {
  year: number
  month: number
  balance: number          // faktisk saldo ved månedsslutt
  isManual: boolean        // true = tastet inn (fond/krypto), false = beregnet
}

export interface WithdrawalEntry {
  id: string
  date: string             // "YYYY-MM-DD"
  amount: number           // negativt beløp
  note?: string
}

export interface SavingsContribution {
  id: string
  date: string             // "YYYY-MM-DD"
  amount: number           // positivt beløp
  note?: string
}

export interface SavingsAccount {
  id: string
  type: SavingsAccountType
  label: string
  openingBalance: number         // startbalanse da kontoen ble registrert
  openingDate: string            // ISO-dato for startbalansen
  monthlyContribution: number    // planlagt månedssparing (estimat)
  interestCreditFrequency: 'monthly' | 'yearly'  // BSU = yearly
  rateHistory: RateHistoryEntry[]  // rentesatsen endrer seg over tid
  balanceHistory: BalanceHistoryEntry[]  // faktisk saldo ved månedsslutt
  withdrawals: WithdrawalEntry[]
  contributions: SavingsContribution[]  // faktiske innskudd
  maxYearlyContribution?: number   // BSU: 27 500
  maxTotalBalance?: number         // BSU: 300 000
  /** Kontonummer fra banken, brukes for matching ved re-import */
  accountNumber?: string
}

export interface SavingsGoal {
  id: string
  label: string
  icon: string             // emoji
  targetAmount: number
  targetDate?: string      // ISO-dato
  linkedAccountIds: string[]
  notes?: string
}

export interface BSUStatus {
  currentBalance: number
  yearlyContributionSoFar: number
  remainingYearlyQuota: number   // maks 27 500 - bidrag hittil i år
  totalRemainingRoom: number     // maks 300 000 - nåværende saldo
  isMaxed: boolean               // saldo >= 300 000
  warning?: string
}

export interface GoalProgress {
  currentTotal: number
  targetAmount: number
  percent: number
  monthsRemaining: number | null
  monthlyNeeded: number | null
}

// ------------------------------------------------------------
// GJELD
// ------------------------------------------------------------

export interface DebtRateHistory {
  fromDate: string
  nominalRate: number
}

export interface DebtAccount {
  id: string
  creditor: string
  type: 'studielaan' | 'billaan' | 'kredittkort' | 'boliglaan' | 'annet'
  originalAmount: number
  currentBalance: number
  rateHistory: DebtRateHistory[]
  monthlyPayment: number
  termFee: number
  startDate: string
  expectedPayoffDate?: string
}

export interface RepaymentRow {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
  rate: number
}

export interface RepaymentPlan {
  rows: RepaymentRow[]
  payoffDate: Date
  totalInterestCost: number
}

// ------------------------------------------------------------
// MIDLERTIDIG LØNN (FUNGERING)
// ------------------------------------------------------------

export interface TemporaryPayEntry {
  id: string
  label: string        // f.eks. "Fungering som major"
  fromDate: string     // "YYYY-MM-DD"
  toDate: string       // "YYYY-MM-DD"
  maanedslonn: number  // midlertidig lønn per måned i perioden
}

// ------------------------------------------------------------
// FRAVÆR
// ------------------------------------------------------------

export interface AbsenceRecord {
  period: string           // ISO-dato, første dag i måneden
  selfCertDays: number     // egenmeldingsdager denne måneden
  sickLeaveDays: number    // sykemeldingsdager (teller ikke mot kvote)
  notat?: string
}

export type AbsenceStatus = 'ok' | 'warning' | 'critical' | 'over'

/** Individuell fraværshendelse med faktiske datoer (for eligibilitetssjekk) */
export interface AbsenceEvent {
  id: string
  startDate: string             // "YYYY-MM-DD"
  endDate: string               // "YYYY-MM-DD"
  type: 'egenmelding' | 'sykmelding'
  grade: number                 // 1–100, 100 = helt fravær
  source: 'manual' | 'imported'
  notat?: string
}

/** Resultat fra eligibilitetssjekken */
export interface AbsenceEligibility {
  canUse: boolean
  earliest: string | null       // ISO-dato eller null
  explain: string
  kpiEgen12m: number            // egenmeldingsdager siste 12 mnd
  kpiEgen16d: number            // egenmeldingsdager siste 16 kalenderdager
  lastPeriodSickDays: number    // sykedager i siste sammenhengende periode
  employerLeft: number          // dager igjen i arbeidsgiverperioden (av 16)
}

// ------------------------------------------------------------
// SKATTEOPPGJØR
// ------------------------------------------------------------

export interface TaxSettlementRecord {
  year: number
  pensjonsgivendeInntekt?: number
  alminneligInntekt?: number
  skattInnbetalt?: number
  skattTilGodeEllerRest: number   // negativt = til gode, positivt = restskatt
  skattBetalt?: number
  nettoInntekt?: number
}

export interface TaxSettlementAnalysis {
  records: TaxSettlementRecord[]
  avgYearlyRefund: number
  recommendation: 'reduce_extra' | 'keep' | 'increase_extra'
  recommendedExtraAdjustment: number  // kr/mnd å endre ekstra trekk med
  reasoning: string
}

// ------------------------------------------------------------
// ABONNEMENT OG FORSIKRINGER
// ------------------------------------------------------------

export interface SubscriptionEntry {
  id: string
  name: string
  category: 'streaming' | 'software' | 'spill' | 'tjeneste' | 'annet'
  isActive: boolean
  monthlyAmounts: {
    [monthKey: string]: number   // format: "2026-01", "2026-02" osv.
  }
  defaultMonthly: number
  billingCycle: 'monthly' | 'yearly' | 'variable'
}

export interface InsuranceEntry {
  id: string
  provider: string
  type: string
  yearlyAmounts: {
    [year: string]: number
  }
  isActive: boolean
  renewalMonth?: number   // 1–12
}

// ------------------------------------------------------------
// STYRINGSRENTE
// ------------------------------------------------------------

export interface PolicyRateEntry {
  year: number
  rate: number            // Norges Banks styringsrente (%)
}

// ------------------------------------------------------------
// IVF-PROSJEKT
// ------------------------------------------------------------

export type IVFTransactionType = 'SPARING' | 'FAKTURA' | 'KJØP' | 'ANNET'

export interface IVFTransaction {
  id: string
  date: string                  // "YYYY-MM-DD"
  label: string
  type: IVFTransactionType
  amount: number                // positivt = inn, negativt = ut
  merknad?: string
}

export interface IVFSettings {
  lonTonje: number
  lonAne: number
  studielaanTonje: number
  studielaanAne: number
  annenEgenkapital: number      // BSU, fond, sparekonto osv. utenom IVF-konto
}

// ------------------------------------------------------------
// HJELPETYPER
// ------------------------------------------------------------

export interface HolidayPayResult {
  holidayPay: number
  holidayLeaveDeduction: number
  netJune: number
}

export interface ATFBreakdown {
  kode: ATFLønnskode
  antallDager?: number
  antallTimer?: number
  sats: number
  belop: number
  beskrivelse: string
}

export interface ATFResult {
  totalEconomy: number
  breakdown: ATFBreakdown[]
  tidskompensasjonTimer: number
  timesatsATab: number
}

// ------------------------------------------------------------
// FERIEPENGER
// ------------------------------------------------------------

export interface AccruedHolidayBase {
  actual: number            // Sum bruttoSum fra importerte slipper
  projected: number         // Estimert for måneder uten slipp
  total: number
  monthsWithSlip: number    // 0–12
}

export interface JuneForecast {
  year: number
  feriepengegrunnlag: number
  feriepenger: number
  ferietrekkDagsats: number
  ferietrekk: number
  skattepliktigJuni: number
  juneATF: number
  skattegrunnlag: number
  skattetrekk: number
  andreJuneTrekk: number
  nettoJuni: number
  nettoEkstra: number       // feriepenger - ferietrekk (positivt = ekstra penger)
  confidence: 'høy' | 'middels' | 'lav'
  kilder: {
    feriepengegrunnlag: string
    juneLonn: string
  }
}
