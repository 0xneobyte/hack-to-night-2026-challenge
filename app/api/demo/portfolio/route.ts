import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { DemoBalance, DemoHolding, DemoTrade } from '@/lib/types'

interface PortfolioData {
  balance: DemoBalance | { balance: number }
  holdings: DemoHolding[]
  trades: DemoTrade[]
  /** Initial seed amount — informational, used by the UI to show P/L. */
  seedAmount: number
}

/**
 * Returns the user's complete demo-trading portfolio in one request:
 *   - balance (defaults to 1,000,000 LKR if they haven't traded yet)
 *   - holdings (one row per owned symbol)
 *   - trades (most recent 50 first)
 *
 * The balance row is lazily created by the RPCs on first trade — if the
 * user hasn't traded yet, we return the seed amount as the balance.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const [balanceRes, holdingsRes, tradesRes] = await Promise.all([
      supabase
        .from('demo_balances')
        .select('user_id, balance, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('demo_holdings')
        .select('id, user_id, symbol, quantity, avg_price, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('demo_trades')
        .select('id, user_id, symbol, side, price, quantity, total, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
    ])

    if (balanceRes.error) return serverError(balanceRes.error)
    if (holdingsRes.error) return serverError(holdingsRes.error)
    if (tradesRes.error) return serverError(tradesRes.error)

    const balance = (balanceRes.data as DemoBalance | null) ?? {
      balance: 1000000
    }

    return apiSuccess<PortfolioData>({
      balance,
      holdings: (holdingsRes.data as DemoHolding[]) ?? [],
      trades: (tradesRes.data as DemoTrade[]) ?? [],
      seedAmount: 1000000
    })
  } catch (reason) {
    return serverError(reason)
  }
}
