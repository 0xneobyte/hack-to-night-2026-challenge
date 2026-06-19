import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { SearchResult } from '@/lib/types'
import { sanitizeSearchQuery } from '@/lib/validation'

interface SearchSuccessData {
  results: SearchResult[]
}

interface AccountMatch {
  id: number
  account_number: string
  account_name: string
}

interface TransactionMatch {
  id: number
  from_account: string
  to_account: string
  description: string | null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const rawQ = searchParams.get('q')
    const q = sanitizeSearchQuery(rawQ)

    if (!q) {
      return apiSuccess<SearchSuccessData>({ results: [] })
    }

    // Use the typed `.ilike()` builder for the description filter, and
    // a sanitized `.or()` for accounts. Both are bounded by `.limit(10)`
    // to keep responses small.
    //
    // We rely on RLS to scope results to the calling user's own data
    // for accounts; transactions are scoped to accounts the user owns.
    const [{ data: accounts, error: accErr }, { data: txns, error: txErr }] =
      await Promise.all([
        supabase
          .from('accounts')
          .select('id, account_number, account_name')
          .or(`account_number.ilike.%${q}%,account_name.ilike.%${q}%`)
          .limit(10),
        supabase
          .from('transactions')
          .select('id, from_account, to_account, description')
          .ilike('description', `%${q}%`)
          .limit(10)
      ])

    if (accErr) return serverError(accErr)
    if (txErr) return serverError(txErr)

    const accountMatches = (accounts ?? []) as AccountMatch[]
    const txnMatches = (txns ?? []) as TransactionMatch[]

    const results: SearchResult[] = [
      ...accountMatches.map((a) => ({
        type: 'account' as const,
        id: String(a.id),
        label: a.account_number,
        detail: a.account_name
      })),
      ...txnMatches.map((t) => ({
        type: 'transaction' as const,
        id: String(t.id),
        label: `${t.from_account} -> ${t.to_account}`,
        detail: t.description
      }))
    ]

    return apiSuccess<SearchSuccessData>({ results })
  } catch (reason) {
    return serverError(reason)
  }
}
