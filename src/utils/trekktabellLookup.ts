/**
 * Slår opp skattetrekk fra trekktabeller 2026.
 * Filene hentes fra https://github.com/tonjhaa/trekktabeller-2026
 *
 * Struktur: [{ tabell, periode, type, grunnlag, trekk }, ...]
 *   - tabell:   trekktabellnummer (f.eks. 8010)
 *   - periode:  1 = månedlig, 2 = 14-dagers, 3 = ukentlig
 *   - type:     0 = standard
 *   - grunnlag: øvre grense for inntektsbraketten i NOK
 *   - trekk:    skattetrekk i NOK for denne bracketten
 */

const BASE_URL = 'https://raw.githubusercontent.com/tonjhaa/trekktabeller-2026/main'
const FILER = [
  'trekktabeller_2026_del_1.json',
  'trekktabeller_2026_del_2.json',
  'trekktabeller_2026_del_3.json',
  'trekktabeller_2026_del_4.json',
  'trekktabeller_2026_del_5.json',
]

interface TrekkRad {
  tabell: number
  periode: number
  type: number
  grunnlag: number
  trekk: number
}

// Enkel in-memory cache per tabellnummer
const cache = new Map<number, TrekkRad[]>()
let alleRader: TrekkRad[] | null = null
let lasterAlle = false
let lasterAllePromise: Promise<TrekkRad[]> | null = null

async function hentAlle(): Promise<TrekkRad[]> {
  if (alleRader) return alleRader
  if (lasterAlle && lasterAllePromise) return lasterAllePromise

  lasterAlle = true
  lasterAllePromise = (async () => {
    const resultater = await Promise.all(
      FILER.map((fil) =>
        fetch(`${BASE_URL}/${fil}`).then((r) => {
          if (!r.ok) throw new Error(`Feil ved henting av ${fil}: ${r.status}`)
          return r.json() as Promise<TrekkRad[]>
        })
      )
    )
    alleRader = resultater.flat()
    return alleRader
  })()

  return lasterAllePromise
}

/**
 * Slår opp skattetrekk for gitt tabellnummer, grunnlag og periode.
 *
 * @param tabellnummer  Trekktabellnummer fra lønnsslippen (f.eks. 8010)
 * @param grunnlag      Lønnsgrunnlag i NOK (f.eks. 61278)
 * @param periode       1 = månedlig (standard), 2 = 14-dagers, 3 = ukentlig
 * @returns             Skattetrekk i NOK, eller null hvis ikke funnet
 */
export async function slaaOppTrekk(
  tabellnummer: number,
  grunnlag: number,
  periode: number = 1
): Promise<number | null> {
  // Sjekk cache
  if (!cache.has(tabellnummer)) {
    const alle = await hentAlle()
    const radForTabell = alle.filter((r) => r.tabell === tabellnummer)
    cache.set(tabellnummer, radForTabell)
  }

  const rader = cache.get(tabellnummer)!

  // Filtrer på periode og type=0
  const aktuelle = rader
    .filter((r) => r.periode === periode && r.type === 0)
    .sort((a, b) => a.grunnlag - b.grunnlag)

  if (aktuelle.length === 0) return null

  // Finn bracketten: siste rad hvor grunnlag <= faktisk grunnlag
  let treffer = aktuelle[0]
  for (const rad of aktuelle) {
    if (rad.grunnlag <= grunnlag) {
      treffer = rad
    } else {
      break
    }
  }

  return treffer.trekk
}

/**
 * Returnerer alle tilgjengelige tabellnumre (for UI-validering).
 */
export async function hentTabellnumre(): Promise<number[]> {
  const alle = await hentAlle()
  return [...new Set(alle.map((r) => r.tabell))].sort((a, b) => a - b)
}
