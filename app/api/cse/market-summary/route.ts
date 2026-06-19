import { apiSuccess, serverError } from '@/lib/api-error'
import { fetchAspi, fetchMarketSummary } from '@/lib/cse'

interface MarketSummaryData {
  summary: {
    tradeVolume: number
    shareVolume: number
    trades: number
    tradeDate: number | null
  } | null
  aspi: {
    value: number
    lowValue: number
    highValue: number
    change: number
    percentage: number
    timestamp: number | null
  } | null
  marketOpen: boolean
}

/**
 * Combined market summary endpoint — returns the trade summary + ASPI in
 * a single round-trip so the UI can render the market header card without
 * two parallel fetches.
 *
 * `marketOpen` is derived from whether the CSE returned any trade data for
 * today; the CSE API does not expose a dedicated "is market open" flag.
 */
export async function GET() {
  const [summary, aspi] = await Promise.all([fetchMarketSummary(), fetchAspi()])

  const data: MarketSummaryData = {
    summary: summary
      ? {
          tradeVolume: summary.tradeVolume,
          shareVolume: summary.shareVolume,
          trades: summary.trades,
          tradeDate: summary.tradeDate
        }
      : null,
    aspi: aspi
      ? {
          value: aspi.value,
          lowValue: aspi.lowValue,
          highValue: aspi.highValue,
          change: aspi.change,
          percentage: aspi.percentage,
          timestamp: aspi.timestamp
        }
      : null,
    marketOpen: Boolean(summary && aspi)
  }

  return apiSuccess<MarketSummaryData>(data)
}
