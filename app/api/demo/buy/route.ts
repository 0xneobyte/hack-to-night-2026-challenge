import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { DemoTradeRpcResult } from '@/lib/types'
import { parseNonEmptyString, ValidationError } from '@/lib/validation'

interface BuyRequestBody {
  symbol?: unknown
  price?: unknown
  quantity?: unknown
}

interface BuySuccessData {
  message: string
  trade_id: number
  new_balance: number
  quantity: number
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const body = (await request.json().catch(() => ({}))) as BuyRequestBody

    let symbol: string
    let price: number
    let quantity: number
    try {
      symbol = parseNonEmptyString(body.symbol, 'Symbol').toUpperCase()
      const rawPrice = Number(body.price)
      const rawQty = Number(body.quantity)
      if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
        throw new ValidationError('Price must be a positive number')
      }
      if (!Number.isInteger(rawQty) || rawQty <= 0) {
        throw new ValidationError('Quantity must be a positive integer')
      }
      price = Math.round(rawPrice * 100) / 100
      quantity = rawQty
    } catch (err) {
      if (err instanceof ValidationError) {
        return apiError(err.message, 400)
      }
      throw err
    }

    const { data, error } = await supabase.rpc('perform_demo_buy', {
      p_symbol: symbol,
      p_price: price,
      p_quantity: quantity
    })

    if (error) {
      return serverError(error)
    }

    const result = data as DemoTradeRpcResult | null
    if (!result || !result.ok) {
      const message = result?.message || 'Buy order failed'
      const status = message.toLowerCase().includes('insufficient') ? 400 : 500
      return apiError(message, status)
    }

    return apiSuccess<BuySuccessData>({
      message: `Successfully bought ${quantity} shares of ${symbol}`,
      trade_id: result.trade_id as number,
      new_balance: result.new_balance as number,
      quantity: result.quantity as number
    })
  } catch (reason) {
    return serverError(reason)
  }
}
