# Lommeboka — Design Handoff
> Generert fra Claude Design-sesjon · 23. april 2026
> Implementer med Claude Code i terminalen

---

## Prioritert rekkefølge

1. **Dashboard (Variant E)** — `EconomyDashboard.tsx` → størst visuell effekt, ingen ny logikk
2. **Lønnsfane (Variant D)** — `SalaryPage.tsx` → ny layout, all logikk beholdes
3. **Veikart (Variant C)** — ny side `VeikartPage.tsx` + ny nav-entry i `EconomyPage.tsx`

---

## Design tokens (matcher index.css eksakt)

```ts
// Bruk disse Tailwind/CSS-var klassene — IKKE hardkod farger
const tokens = {
  bg:           'hsl(240 10% 3.9%)',   // --background
  surface:      'hsl(240 6% 6%)',       // --card
  surfaceHigh:  'hsl(240 6% 8%)',       // card hover
  border:       'hsl(217.2 32.6% 14%)', // --border
  borderMid:    'hsl(217.2 32.6% 18%)',
  text:         'hsl(0 0% 98%)',        // --foreground
  textSoft:     'hsl(215 20% 75%)',
  muted:        'hsl(215 20.2% 55%)',   // --muted-foreground
  primary:      'hsl(217.2 91.2% 59.8%)', // --primary → blå
  primaryLight: 'hsl(213 93% 68%)',
  green:        'hsl(142 76% 50%)',     // --success variant
  greenDim:     'hsla(142 76% 50% / 0.10)',
  greenBorder:  'hsla(142 76% 50% / 0.25)',
  red:          'hsl(0 72% 63%)',       // --destructive variant
  amber:        'hsl(38 92% 50%)',      // --warning
  amberDim:     'hsla(38 92% 50% / 0.10)',
  fontMono:     '"DM Mono", ui-monospace, monospace', // legg til i index.css/@theme
}
```

Legg til i `index.css` under `@theme`:
```css
--font-mono: "DM Mono", ui-monospace, monospace;
```

---

## 1. Dashboard redesign

### Fil: `src/pages/economy/EconomyDashboard.tsx`

**Behold all eksisterende logikk** — hooks, beregninger, data-fetching. Kun presentasjonslaget endres.

### Ny struktur (erstatter return-verdien):

```tsx
return (
  <div className="flex flex-col h-full overflow-hidden bg-background">
    {/* 1. HERO BAND — 5 celler i én rad */}
    <HeroBand
      healthScore={healthScore}
      nettoFormue={nettoFormue}
      totalSparing={totalSparing}
      totalGjeld={totalGjeld}
      nettoInn={nettoFraBudsjett}
      brutto={profile?.baseMonthly ?? 0}
      sparerate={sparerate}
      daysToPayday={daysToPayday}
      nextPayday={nextPayday}
      juneForecast={juneForecast}
    />

    {/* 2. MIDT-RAD — 3 kolonner */}
    <div className="grid grid-cols-[280px_1fr_280px] gap-3 px-5 py-3 flex-shrink-0">
      <MonthlyFlowCard nettoInn={nettoFraBudsjett} overskudd={overskuddFraBudsjett} budgetTable={budgetTable} />
      <FormueChart history={formueHistory} nettoFormue={nettoFormue} />
      <PengePulsCard chips={chips} />
    </div>

    {/* 3. BUNN-GRID — 4 kolonner */}
    <div className="grid grid-cols-4 gap-3 px-5 pb-4 flex-1 overflow-hidden">
      <SpareMaalCard goals={savingsGoals} accounts={savingsAccounts} fondVerdi={fondVerdi} fondMonthlyDeposit={fondPortfolio?.monthlyDeposit ?? 0} onNavigate={onNavigate} />
      <ATFCard entries={yearATF} sum={atfSum} year={currentYear} onNavigate={onNavigate} />
      <GjeldCard debts={debts} onNavigate={onNavigate} />
      <AbsenceAndTaxCard absenceDays={absenceDays} absenceStatus={absenceStatus} taxAnalysis={taxAnalysis} onNavigate={onNavigate} />
    </div>
  </div>
)
```

### Ny komponent: `HeroBand`

```tsx
// src/components/economy/widgets/HeroBand.tsx
interface HeroBandProps {
  healthScore: number      // 0–100
  nettoFormue: number
  totalSparing: number
  totalGjeld: number
  nettoInn: number
  brutto: number
  sparerate: number        // 0–100 prosent
  daysToPayday: number
  nextPayday: Date
  juneForecast: JuneForecast | null
}

// Beregn healthScore slik:
function calcHealthScore(params: {
  sparerate: number        // % av netto
  absenceDays: number
  nettoFormue: number
  overskudd: number | null
  totalSparing: number
  totalGjeld: number
}): number {
  return Math.min(100, Math.round(
    (params.sparerate >= 15 ? 25 : params.sparerate >= 10 ? 18 : 8) +
    (params.absenceDays <= 8 ? 20 : params.absenceDays <= 16 ? 12 : 4) +
    (params.nettoFormue > 0 ? 25 : 10) +
    ((params.overskudd ?? 0) > 0 ? 20 : 5) +
    (params.totalGjeld < params.totalSparing ? 10 : 4)
  ))
}
```

### Ny komponent: `FormueChart` (erstatter Recharts AreaChart)

```tsx
// src/components/economy/charts/FormueChart.tsx
// SVG-basert, bruker eksisterende monthHistory for å bygge dataset:
const formueHistory = [...monthHistory]
  .filter(m => m.slipData != null || m.source === 'forecast')
  .sort((a,b) => a.year !== b.year ? a.year-b.year : a.month-b.month)
  .slice(-12)
  .map(m => ({
    m: MONTH_NAMES[m.month],
    v: /* total sparing snapshot for denne måneden */ nettoFormue // forenklet: bruk nåverdi
  }))
```

### `MonthlyFlowCard` — månedlig flyt

```tsx
// 4 rader: Netto inn / Faste ut / Sparing / Ledig
// Bruker budgetTable.sections for faktiske tall
// MiniBar: width = value/nettoInn * 100%
```

### `PengePulsCard` — smarte chips

```tsx
// Flytt eksisterende <PengePuls> til eget kort med bedre styling
// Legg til chip for: billån høy rente (>6%), BSU-rom igjen, skattetips
```

---

## 2. Lønnsfane redesign

### Fil: `src/pages/economy/SalaryPage.tsx`

**BEHOLD:** All eksisterende logikk — `ProfileForm`, `LonnsoppgjorSection`, `FungeringPanel`, `SlipDetailModal`, `TrekktabellKort`, `PayslipImporter`

**ENDRE:** Layout og topp-seksjon

### Ny topp-struktur:

```tsx
// Erstatt <div className="p-4 space-y-4 overflow-y-auto h-full"> med:
<div className="flex h-full overflow-hidden">

  {/* VENSTRE — Lønnssammensetning waterfall (380px) */}
  <div className="w-[380px] shrink-0 border-r border-border overflow-y-auto p-5">
    <SalaryWaterfallHero profile={profile} latestSlip={latestSlipRecord?.slipData} advanced={advanced} />
    <AdvancedToggle value={advanced} onChange={setAdvanced} />
    {/* Eksisterende: ProfileForm, TrekktabellKort, FungeringPanel */}
  </div>

  {/* HØYRE — Grafer + historikk */}
  <div className="flex-1 overflow-y-auto p-5 space-y-4">
    <SalaryGrowthChart records={lonnsoppgjor} cagr={cagr} />
    <MonthlyNettoChart history={importedSlips} />
    <TaxRateChart history={taxHistory} currentRate={currentTaxRate} />
    {/* Eksisterende: LonnsoppgjorSection, PayslipImporter, importedSlips liste */}
  </div>
</div>
```

### Ny komponent: `SalaryWaterfallHero`

```tsx
// src/components/economy/widgets/SalaryWaterfallHero.tsx
interface Props {
  profile: EmploymentProfile | null
  latestSlip: ParsetLonnsslipp | null
  advanced: boolean   // toggle for SPK/fagforening/husleie
}

// Waterfall: Grunnlønn → HTA → Kompetanse → ATF → = Brutto → Skattetrekk → Andre → = Netto
// Bruk slip-data hvis tilgjengelig, profil-data som fallback
// Netto vises i stor grønn tekst
```

### Nye charts (SVG, ingen Recharts-avhengighet):

```tsx
// src/components/economy/charts/SalaryGrowthChart.tsx
// Props: records: LonnsoppgjorRecord[], cagr: number
// Linje-chart med dot per oppgjør, forventede i amber, historiske i primærblå

// src/components/economy/charts/MonthlyNettoChart.tsx  
// Props: slips: MonthRecord[]
// Stolpediagram, grønn highlight på siste måned

// src/components/economy/charts/TaxRateChart.tsx
// Props: data: { year: number; pct: number }[]
// Beregn pct fra: slip.skattetrekk / slip.bruttoSum * 100
```

---

## 3. Veikart (ny side)

### Nye filer:

```
src/pages/economy/VeikartPage.tsx        # Hoved-komponent
src/hooks/useVeikart.ts                  # Beregningslogikk
src/components/economy/veikart/
  VeikartInputPanel.tsx                  # Venstre input-panel
  VeikartScenarioCards.tsx               # 5 scenario-kort (i dag → 5 år)
  VeikartTimelineChart.tsx               # SVG kjøpekraft-kurve
  VeikartDrivers.tsx                     # Hva øker/bremser kjøpekraften
```

### Legg til i `EconomyPage.tsx`:

```tsx
// I NAV_ITEMS:
{ page: 'veikart', label: 'Veikart', Icon: Map },

// I EconomySubPage type (useAppStore.ts):
| 'veikart'

// I render:
{currentPage === 'veikart' && <VeikartPage />}
```

### Beregningsregler (fra norsk boliglånsforskrift 2025):

```ts
// useVeikart.ts
const EK_KRAV = 0.10           // 10% egenkapital (ikke 15%!)
const MAX_GJELDSGRAD = 5       // maks gjeld / bruttoinntekt
const BSU_MAX_YEARLY = 27500   // kr/år
const BSU_MAX_TOTAL = 300000   // kr totalt
const BSU_MAX_AGE = 33         // siste år man kan spare (fyller 34)
const BSU_TAX_BENEFIT = 0.10   // 10% skattefradrag på innskudd

function calcMaxPurchase(equity: number, annualIncome: number, existingDebt: number): number {
  const maxByEK = equity / EK_KRAV
  const maxByIncome = (annualIncome * MAX_GJELDSGRAD - existingDebt) + equity
  return Math.min(maxByEK, maxByIncome)
}
```

### Synk med økonomidata:

```ts
// VeikartPage leser fra useEconomyStore:
const savings1 = savingsAccounts
  .filter(a => a.type === 'sparekonto')
  .reduce((s,a) => s + getCurrentBalance(a), 0)

const bsu1 = savingsAccounts
  .filter(a => a.type === 'BSU')
  .reduce((s,a) => s + getCurrentBalance(a), 0)

const fond1 = fondPortfolio?.snapshots.at(-1)?.totalValue ?? 0

const income1 = (profile?.baseMonthly ?? 0) * 12 +
  (profile?.fixedAdditions.reduce((s,a) => s + a.amount, 0) ?? 0) * 12

const existingDebt = debts.reduce((s,d) => s + d.currentBalance, 0)
```

---

## Viktige regler å huske

| Regel | Verdi | Kilde |
|---|---|---|
| EK-krav | **10 %** (IKKE 15%) | Boliglånsforskriften 2025 |
| Maks gjeldsgrad | 5× bruttoinntekt | Boliglånsforskriften 2025 |
| Stresstest | +3 pp, min 7% | Boliglånsforskriften 2025 |
| BSU max/år | 27 500 kr | Skatteloven |
| BSU max totalt | 300 000 kr | Skatteloven |
| BSU alder | Stopper år man fyller 34 | Skatteloven |
| BSU skattefradrag | 10% av innskudd | Skatteloven |

---

## Avhengigheter som IKKE skal endres

- `useEconomyStore.ts` — all state-logikk beholdes
- `useAppStore.ts` — legg kun til `'veikart'` i `EconomySubPage`
- `budgetTableComputer.ts` — beholdes helt
- `forecastJune()` — beholdes helt
- `slipParser.ts` — beholdes helt
- `trekktabellLookup.ts` — beholdes helt

---

## Fonter

Legg til i `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Bruk `font-mono` klassen (Tailwind) eller `font-family: var(--font-mono)` for alle tallvisninger.

---

## Commit-forslag

```bash
git add src/pages/economy/EconomyDashboard.tsx
git add src/components/economy/widgets/HeroBand.tsx
git add src/components/economy/charts/FormueChart.tsx
git commit -m "feat(dashboard): redesign with hero band, formue chart, pengepuls"

git add src/pages/economy/SalaryPage.tsx
git add src/components/economy/widgets/SalaryWaterfallHero.tsx
git add src/components/economy/charts/SalaryGrowthChart.tsx
git commit -m "feat(salary): waterfall hero, salary growth chart, partner section"

git add src/pages/economy/VeikartPage.tsx
git add src/hooks/useVeikart.ts
git commit -m "feat(veikart): new future planning page with BSU+savings projection"
```
