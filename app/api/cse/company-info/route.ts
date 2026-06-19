import { apiError, apiSuccess } from '@/lib/api-error'
import { fetchCompanyInfo } from '@/lib/cse'
import { sanitizeSearchQuery } from '@/lib/validation'

interface CompanyInfoData {
  symbol: string
  name: string | null
  lastTradedPrice: number | null
  previousClose: number | null
  closingPrice: number | null
  change: number | null
  changePercentage: number | null
  marketCap: number | null
  high: number | null
  low: number | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawSymbol = searchParams.get('symbol')

  if (!rawSymbol) {
    return apiError('Symbol query parameter is required', 400)
  }

  // Sanitize to prevent PostgREST-style filter injection if we ever
  // forward this to a Supabase query. The CSE API tolerates the
  // stripped form for valid symbols (e.g. "DIAL.N0000" → "DIAL.N0000").
  const symbol = sanitizeSearchQuery(rawSymbol).toUpperCase()
  if (!symbol) {
    return apiError('Symbol must not be empty', 400)
  }

  const raw = await fetchCompanyInfo(symbol)
  if (!raw?.reqSymbolInfo) {
    return apiSuccess<CompanyInfoData>({
      symbol,
      name: null,
      lastTradedPrice: null,
      previousClose: null,
      closingPrice: null,
      change: null,
      changePercentage: null,
      marketCap: null,
      high: null,
      low: null
    })
  }

  const info = raw.reqSymbolInfo
  return apiSuccess<CompanyInfoData>({
    symbol: info.symbol,
    name: info.name,
    lastTradedPrice: info.lastTradedPrice,
    previousClose: info.previousClose,
    closingPrice: info.closingPrice,
    change: info.change,
    changePercentage: info.changePercentage,
    marketCap: info.marketCap,
    high: info.high,
    low: info.low
  })
}
