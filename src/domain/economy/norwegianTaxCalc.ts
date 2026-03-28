// ------------------------------------------------------------
// Norsk skattekalkulator — 2026-regler
// Kilde: Skatteetaten.no og Finansdepartementets statsbudsjett
// ------------------------------------------------------------

export interface TaxRates {
  year: number
  personfradrag: number
  minstefradragLonnSats: number
  minstefradragLonnMaks: number
  minstefradragPensjonSats: number
  minstefradragPensjonMaks: number
  skattAlminneligSats: number
  trinnskatt: { grense: number; sats: number }[]
  trygdeavgiftLonn: number
  trygdeavgiftPensjon: number
  trygdeavgiftNæring: number
  formueskattGrense: number
  formueskattKommunal: number   // over grensen
  formueskattStatlig1: number
  formueskattStatlig1Grense: number
  formueskattStatlig2: number   // over statlig1Grense
}

export const TAX_RATES_2026: TaxRates = {
  year: 2026,
  personfradrag: 108_550,
  minstefradragLonnSats: 0.46,
  minstefradragLonnMaks: 92_000,
  minstefradragPensjonSats: 0.40,
  minstefradragPensjonMaks: 73_150,
  skattAlminneligSats: 0.22,
  trinnskatt: [
    { grense: 226_100,   sats: 0 },
    { grense: 318_300,   sats: 0.017 },
    { grense: 725_050,   sats: 0.040 },
    { grense: 980_100,   sats: 0.137 },
    { grense: 1_467_200, sats: 0.168 },
    { grense: Infinity,  sats: 0.178 },
  ],
  trygdeavgiftLonn:    0.078,
  trygdeavgiftPensjon: 0.051,
  trygdeavgiftNæring:  0.110,
  formueskattGrense:         1_900_000,
  formueskattKommunal:       0.0035,
  formueskattStatlig1:       0.0065,
  formueskattStatlig1Grense: 21_500_000,
  formueskattStatlig2:       0.0075,
}

// Bruk alltid siste kjente satser
export const CURRENT_RATES = TAX_RATES_2026

// ------------------------------------------------------------
// Input / Output
// ------------------------------------------------------------

export interface TaxInput {
  lonnsInntekt: number
  pensjonsinntekt: number
  næringsInntekt: number
  kapitalInntekt: number     // netto (kapitalinntekt minus kapitalkostnader)
  andreFradrag: number       // f.eks. rentefradrag, fagforeningskontingent
  // Formue (markedsverdier — vi beregner skattemessig verdi)
  primaerboligVerdi: number  // 25% av markedsverdi brukes
  sekundaerboligVerdi: number
  bankinnskudd: number
  aksjerFondVerdi: number    // 80% av markedsverdi brukes
  annenFormue: number
  gjeld: number
}

export interface TrinnskattLinje {
  trinn: number
  grenseFra: number
  grenseTil: number
  sats: number
  beløp: number
}

export interface TaxResult {
  // Grunnlag
  minstefradragLonn: number
  minstefradragPensjon: number
  alminneligInntekt: number          // etter alle fradrag og personfradrag
  personinntekt: number              // lønn + næring (grunnlag trinnskatt/trygd)

  // Formue
  skattemessigFormue: number
  nettoFormue: number                // etter gjeld
  skattepliktigFormue: number        // over bunnfradraget

  // Skattekomponenter
  skattAlminneligInntekt: number
  trinnskatt: number
  trinnskattLinjer: TrinnskattLinje[]
  trygdeavgiftLonn: number
  trygdeavgiftPensjon: number
  trygdeavgiftNæring: number
  formueskattKommunal: number
  formueskattStatlig: number

  // Summer
  totalSkatt: number
  totalInntekt: number               // sum av alle inntektstyper
  effektivSats: number               // totalSkatt / totalInntekt
  marginalSats: number               // høyeste marginale sats på lønn

  // Månedlig
  estimertMånedligTrekk: number
}

// ------------------------------------------------------------
// Beregning
// ------------------------------------------------------------

function beregnTrinnskatt(personinntekt: number, rates: TaxRates): { total: number; linjer: TrinnskattLinje[] } {
  const grenser = [0, ...rates.trinnskatt.map((t) => t.grense)]
  const satser  = rates.trinnskatt.map((t) => t.sats)

  let total = 0
  const linjer: TrinnskattLinje[] = []

  for (let i = 0; i < satser.length; i++) {
    const fra = grenser[i]
    const til = grenser[i + 1] ?? Infinity
    const sats = satser[i]
    if (sats === 0) continue
    if (personinntekt <= fra) break

    const grunnlag = Math.min(personinntekt, til) - fra
    const beløp = Math.round(grunnlag * sats)
    total += beløp
    linjer.push({ trinn: i + 1, grenseFra: fra, grenseTil: til === Infinity ? 0 : til, sats, beløp })
  }

  return { total, linjer }
}

function beregnFormueskatt(nettoFormue: number, rates: TaxRates): { kommunal: number; statlig: number } {
  const over = Math.max(0, nettoFormue - rates.formueskattGrense)
  if (over === 0) return { kommunal: 0, statlig: 0 }

  const kommunal = Math.round(over * rates.formueskattKommunal)

  const statligGrunnlag1 = Math.min(over, rates.formueskattStatlig1Grense - rates.formueskattGrense)
  const statligGrunnlag2 = Math.max(0, over - (rates.formueskattStatlig1Grense - rates.formueskattGrense))
  const statlig = Math.round(statligGrunnlag1 * rates.formueskattStatlig1 + statligGrunnlag2 * rates.formueskattStatlig2)

  return { kommunal, statlig }
}

export function beregnSkatt(input: TaxInput, rates: TaxRates = CURRENT_RATES): TaxResult {
  const { lonnsInntekt, pensjonsinntekt, næringsInntekt, kapitalInntekt, andreFradrag } = input

  // Minstefradrag
  const minstefradragLonn = Math.min(
    Math.round(lonnsInntekt * rates.minstefradragLonnSats),
    rates.minstefradragLonnMaks
  )
  const minstefradragPensjon = Math.min(
    Math.round(pensjonsinntekt * rates.minstefradragPensjonSats),
    rates.minstefradragPensjonMaks
  )

  // Personinntekt (grunnlag for trinnskatt og trygdeavgift)
  const personinntekt = lonnsInntekt + næringsInntekt

  // Alminnelig inntekt
  const totalInntekt = lonnsInntekt + pensjonsinntekt + næringsInntekt + kapitalInntekt
  const alminneligInntektFørPersF = totalInntekt
    - minstefradragLonn
    - minstefradragPensjon
    - andreFradrag
  const alminneligInntekt = Math.max(0, alminneligInntektFørPersF - rates.personfradrag)

  // Skatt på alminnelig inntekt (22%)
  const skattAlminneligInntekt = Math.round(alminneligInntekt * rates.skattAlminneligSats)

  // Trinnskatt
  const { total: trinnskatt, linjer: trinnskattLinjer } = beregnTrinnskatt(personinntekt, rates)

  // Trygdeavgift
  const trygdeavgiftLonn    = Math.round(lonnsInntekt    * rates.trygdeavgiftLonn)
  const trygdeavgiftPensjon = Math.round(pensjonsinntekt * rates.trygdeavgiftPensjon)
  const trygdeavgiftNæring  = Math.round(næringsInntekt  * rates.trygdeavgiftNæring)

  // Formue
  const skattemessigFormue =
    Math.round(input.primaerboligVerdi    * 0.25) +
    Math.round(input.sekundaerboligVerdi  * 1.00) +
    Math.round(input.bankinnskudd         * 1.00) +
    Math.round(input.aksjerFondVerdi      * 0.80) +
    Math.round(input.annenFormue          * 1.00)
  const nettoFormue = Math.max(0, skattemessigFormue - input.gjeld)
  const skattepliktigFormue = Math.max(0, nettoFormue - rates.formueskattGrense)
  const { kommunal: formueskattKommunal, statlig: formueskattStatlig } = beregnFormueskatt(nettoFormue, rates)

  // Total
  const totalSkatt = skattAlminneligInntekt + trinnskatt
    + trygdeavgiftLonn + trygdeavgiftPensjon + trygdeavgiftNæring
    + formueskattKommunal + formueskattStatlig

  const effektivSats = totalInntekt > 0 ? totalSkatt / totalInntekt : 0

  // Marginal sats på lønn (trinnskatt + 22% + trygdeavgift)
  const topTrinnskattSats = (() => {
    for (let i = rates.trinnskatt.length - 1; i >= 0; i--) {
      if (personinntekt > rates.trinnskatt[i].grense) return rates.trinnskatt[i].sats
    }
    return 0
  })()
  const marginalSats = rates.skattAlminneligSats + rates.trygdeavgiftLonn + topTrinnskattSats

  return {
    minstefradragLonn,
    minstefradragPensjon,
    alminneligInntekt,
    personinntekt,
    skattemessigFormue,
    nettoFormue,
    skattepliktigFormue,
    skattAlminneligInntekt,
    trinnskatt,
    trinnskattLinjer,
    trygdeavgiftLonn,
    trygdeavgiftPensjon,
    trygdeavgiftNæring,
    formueskattKommunal,
    formueskattStatlig,
    totalSkatt,
    totalInntekt,
    effektivSats,
    marginalSats,
    estimertMånedligTrekk: Math.round(totalSkatt / 10.5), // 10,5 mnd (halvskatt des.)
  }
}
