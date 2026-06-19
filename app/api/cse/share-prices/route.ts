import { apiSuccess } from '@/lib/api-error'
import { fetchTodaySharePrices } from '@/lib/cse'

interface SharePriceRow {
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

interface SharePricesData {
  prices: SharePriceRow[]
}

/**
 * Live share prices for every listed CSE company. The CSE endpoint can
 * occasionally return null during off-hours — the response will be an
 * empty array in that case.
 */
export async function GET() {
  const raw = await fetchTodaySharePrices()
  const prices: SharePriceRow[] = (raw ?? []).map((p) => ({
    id: p.id,
    symbol: p.symbol,
    open: p.open,
    high: p.high,
    low: p.low,
    lastTradedPrice: p.lastTradedPrice,
    change: p.change,
    changePercentage: p.changePercentage,
    crossingVolume: p.crossingVolume,
    tradesTime: p.tradesTime,
    quantity: p.quantity
  }))

  return apiSuccess<SharePricesData>({ prices })
}
