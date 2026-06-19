import { AiConfigError, chatJson } from '@/lib/ai/nvidia'
import type { InsightsResult } from '@/lib/ai/types'
import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'

// AI calls can take a while — give the route room.
export const maxDuration = 60

const SYSTEM_PROMPT = `You are a personal banking spending analyst for a Sri Lankan bank (currency LKR, "Rs.").
You receive a user's account balances and recent transactions and produce concise, actionable monitoring.
Categorise outflows into sensible categories (e.g. Bills & Utilities, Food, Transport, Transfers, Shopping, Other).
Raise alerts for risks: low balance, unusually large outflows, spending trending up, frequent transfers out.
Respond ONLY with a JSON object matching exactly this TypeScript type:
{
  "headline": string,
  "summary": string,
  "totals": { "inflow": number, "outflow": number, "net": number },
  "categories": { "name": string, "amount": number, "percentage": number }[],
  "insights": string[],
  "alerts": { "severity": "info"|"warning"|"critical", "title": string, "message": string }[],
  "budget_tips": string[]
}
All amounts are numbers in LKR (no currency symbol, no thousands separators). Keep arrays to at most 6 items.`

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const [{ data: accounts }, { data: txns }] = await Promise.all([
      supabase
        .from('accounts')
        .select('account_number, account_name, balance')
        .eq('user_id', user.id),
      supabase
        .from('transactions')
        .select(
          'from_account, to_account, amount, description, status, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(80)
    ])

    const accountNumbers = new Set(
      (accounts ?? []).map((a) => a.account_number)
    )

    // Label each transaction as inflow/outflow relative to the user's accounts
    // so the model does not have to guess direction.
    const labelled = (txns ?? []).map((t) => {
      const isOut = accountNumbers.has(t.from_account)
      const isIn = accountNumbers.has(t.to_account)
      return {
        direction: isOut ? 'out' : isIn ? 'in' : 'other',
        amount: Number(t.amount),
        description: t.description ?? '',
        date: t.created_at,
        status: t.status
      }
    })

    const analyzed = {
      transactions: labelled.length,
      accounts: accountNumbers.size,
      endpoint: '/api/insights ← accounts + transactions tables'
    }

    if (labelled.length === 0) {
      return apiSuccess<InsightsResult>({
        headline: 'No activity yet',
        summary: 'Once you make some transactions, insights will appear here.',
        totals: { inflow: 0, outflow: 0, net: 0 },
        categories: [],
        insights: [],
        alerts: [],
        budget_tips: [],
        analyzed
      })
    }

    const totalBalance = (accounts ?? []).reduce(
      (s, a) => s + Number(a.balance),
      0
    )

    const userPrompt = JSON.stringify({
      total_balance: Math.round(totalBalance * 100) / 100,
      account_count: accountNumbers.size,
      transactions: labelled
    })

    let result: Omit<InsightsResult, 'analyzed'>
    try {
      result = await chatJson<Omit<InsightsResult, 'analyzed'>>(
        SYSTEM_PROMPT,
        userPrompt,
        { maxTokens: 1400 }
      )
    } catch (err) {
      if (err instanceof AiConfigError) {
        return apiError('AI is not configured on the server', 503)
      }
      return serverError(err)
    }

    return apiSuccess<InsightsResult>({ ...result, analyzed })
  } catch (reason) {
    return serverError(reason)
  }
}
