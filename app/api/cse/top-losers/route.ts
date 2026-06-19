import { apiSuccess } from '@/lib/api-error'
import { fetchTopLosers } from '@/lib/cse'

interface MoverRow {
  id: number
  symbol: string
  price: number
  change: number
  changePercentage: number
  tradeDate: number
}

interface MoversData {
  losers: MoverRow[]
}

export async function GET() {
  const raw = await fetchTopLosers()
  const losers: MoverRow[] = (raw ?? []).map((m) => ({
    id: m.id,
    symbol: m.symbol,
    price: m.price,
    change: m.change,
    changePercentage: m.changePercentage,
    tradeDate: m.tradeDate
  }))

  return apiSuccess<MoversData>({ losers })
}
