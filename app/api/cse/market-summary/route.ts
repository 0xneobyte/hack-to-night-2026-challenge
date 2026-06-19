import { apiSuccess } from '@/lib/api-error'
import { fetchAspi, fetchMarketSummary } from '@/lib/cse'
import { getMarketStatus, getNextOpenTime } from '@/lib/market-status'

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
  /** @deprecated use `status` instead — kept for backwards compatibility. */
  marketOpen: boolean
  status: {
    session: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'AFTER_HOURS'
    isOpen: boolean
    label: 'Open' | 'Pre-Open' | 'Closed' | 'After Hours'
    colomboTime: string
    colomboDayOfWeek: number
    colomboHourDecimal: number
    reason?: 'WEEKEND' | 'BEFORE_OPEN' | 'AFTER_CLOSE' | 'FORCED_CLOSED'
    nextOpenAt: string | null
  }
}

/**
 * Combined market summary endpoint — returns the trade summary + ASPI +
 * computed market status in a single round-trip.
 *
 * The market `status` is computed server-side from the Asia/Colombo
 * clock (see lib/market-status.ts), NOT inferred from whether the CSE
 * returned any trade data — that heuristic was unreliable because the
 * CSE API keeps returning stale data after close.
 */
export async function GET() {
  const [summary, aspi] = await Promise.all([fetchMarketSummary(), fetchAspi()])
  const statusInfo = getMarketStatus()
  const nextOpenAt = statusInfo.isOpen ? null : getNextOpenTime()

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
    marketOpen: statusInfo.isOpen,
    status: {
      session: statusInfo.session,
      isOpen: statusInfo.isOpen,
      label: statusInfo.label,
      colomboTime: statusInfo.colomboTime,
      colomboDayOfWeek: statusInfo.colomboDayOfWeek,
      colomboHourDecimal: statusInfo.colomboHourDecimal,
      reason: statusInfo.reason,
      nextOpenAt
    }
  }

  return apiSuccess<MarketSummaryData>(data)
}
