/**
 * Server-side CSE (Colombo Stock Exchange) API client.
 *
 * Used by the proxy routes under /api/cse/*. Must NEVER be imported from
 * the browser — these requests require server-side headers and would
 * hit CORS issues if called from a client component.
 *
 * The CSE public API uses POST for every endpoint (no GET), returns JSON,
 * and is occasionally slow or returns an empty body during off-hours.
 * Every helper below applies a defensive 15-second timeout and falls
 * back to a sensible empty value on failure.
 */

const CSE_BASE = 'https://www.cse.lk/api'

const CSE_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.cse.lk/',
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/x-www-form-urlencoded'
}

async function postCse<T>(
  path: string,
  body: URLSearchParams | string = ''
): Promise<T | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(`${CSE_BASE}/${path}`, {
      method: 'POST',
      headers: CSE_HEADERS,
      body,
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[cse] ${path} returned HTTP ${res.status}`)
      return null
    }

    // The CSE API sometimes returns 200 with an empty body during
    // off-hours; guard with a content-length check.
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text) as T
    } catch (parseErr) {
      console.error(`[cse] ${path} returned non-JSON response`, parseErr)
      return null
    }
  } catch (err) {
    console.error(`[cse] ${path} fetch failed`, err)
    return null
  }
}

/** Market summary — total trade volume, share volume, trade count for the day. */
export function fetchMarketSummary() {
  return postCse<CseMarketSummaryShape>('marketSummery')
}

/** ASPI (All Share Price Index) — value, change, intraday high/low. */
export function fetchAspi() {
  return postCse<CseAspiShape>('aspiData')
}

/** Live share prices for every listed company. Returns an array. */
export function fetchTodaySharePrices() {
  return postCse<CseSharePriceShape[]>('todaySharePrice')
}

/** Top 10 gainers for the current trading session. */
export function fetchTopGainers() {
  return postCse<CseMoverShape[]>('topGainers')
}

/** Top 10 losers for the current trading session. */
export function fetchTopLosers() {
  return postCse<CseMoverShape[]>('topLooses')
}

/** Detailed info for a single stock symbol. Symbol format: "DIAL.N0000". */
export function fetchCompanyInfo(symbol: string) {
  const params = new URLSearchParams()
  params.append('symbol', symbol)
  return postCse<CseCompanyInfoShape>('companyInfoSummery', params.toString())
}

// ---------------------------------------------------------------------------
// Internal shapes (kept private so consumers use the exported types from
// @/lib/types which are stricter and consistently named).
// ---------------------------------------------------------------------------

interface CseMarketSummaryShape {
  id: number
  tradeVolume: number
  shareVolume: number
  tradeDate: number
  trades: number
}

interface CseAspiShape {
  id: number
  value: number
  lowValue: number
  highValue: number
  change: number
  percentage: number
  timestamp: number
}

interface CseSharePriceShape {
  id: number
  symbol: string
  open: number
  high: number
  low: number
  lastTradedPrice: number
  change: number
  changePercentage: number
  crossingVolume: number
  tradesTime: number
  quantity: number
}

interface CseMoverShape {
  id: number
  securityId: number
  symbol: string
  price: number
  change: number
  changePercentage: number
  tradeDate: number
}

interface CseCompanyInfoShape {
  reqSymbolInfo?: {
    id: number
    symbol: string
    name: string
    lastTradedPrice: number
    previousClose: number
    closingPrice: number
    change: number
    changePercentage: number
    marketCap: number
    high: number
    low: number
    quantityIssued: number
    parValue: number
  } | null
  reqLogo?: { id: number; path: string; secId: number } | null
}
