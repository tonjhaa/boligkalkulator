import type { FondEntry } from '@/types/economy'

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

export interface LivePrice {
  nav: number
  navDate: string
  dayChangePercent: number | null
  source: 'morningstar' | 'yahoo'
}

// ------------------------------------------------------------
// CORS PROXY
// ------------------------------------------------------------

const PROXY = 'https://api.allorigins.win/raw?url='

function proxied(url: string): string {
  return PROXY + encodeURIComponent(url)
}

// ------------------------------------------------------------
// MORNINGSTAR NORWAY (norske fond via ISIN)
// ------------------------------------------------------------

async function fetchMorningstarPrice(isin: string): Promise<LivePrice | null> {
  try {
    // Screener endpoint — returnerer NAV + 1-dags endring direkte
    const url =
      'https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener' +
      '?page=1&pageSize=1&sortOrder=LegalName+asc&outputType=json&version=1' +
      '&languageId=nb-NO&currencyId=NOK&universeIds=FONOR$$ALL' +
      `&securityDataPoints=SecId,LegalName,NAVPS,NavDate,GBRReturnD1` +
      `&filters=ISIN:EQ:${isin}`

    const res = await fetch(proxied(url), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const data = await res.json()
    const row = data?.rows?.[0]
    if (!row || row.NAVPS == null) return null

    const navDate = row.NavDate
      ? row.NavDate.split('T')[0]
      : new Date().toISOString().split('T')[0]

    return {
      nav: row.NAVPS,
      navDate,
      dayChangePercent: row.GBRReturnD1 ?? null,
      source: 'morningstar',
    }
  } catch {
    return null
  }
}

// ------------------------------------------------------------
// YAHOO FINANCE (ETFer med børsticker)
// ------------------------------------------------------------

async function fetchYahooPrice(ticker: string): Promise<LivePrice | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`
    const res = await fetch(proxied(url), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const meta = result.meta
    const nav = meta?.regularMarketPrice ?? null
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? null
    if (nav == null) return null

    const navDate = meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    const dayChangePercent = prev && prev > 0 ? ((nav - prev) / prev) * 100 : null

    return {
      nav,
      navDate,
      dayChangePercent,
      source: 'yahoo',
    }
  } catch {
    return null
  }
}

// ------------------------------------------------------------
// FETCH ALL FUNDS
// ------------------------------------------------------------

export async function fetchAllFondPrices(
  funds: FondEntry[],
): Promise<Record<string, LivePrice>> {
  const results: Record<string, LivePrice> = {}

  await Promise.all(
    funds.map(async (fund) => {
      let price: LivePrice | null = null

      if (fund.isin) {
        price = await fetchMorningstarPrice(fund.isin)
      }
      if (!price && fund.yahooTicker) {
        price = await fetchYahooPrice(fund.yahooTicker)
      }

      if (price) results[fund.id] = price
    }),
  )

  return results
}
