import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { Transaction } from '@/lib/types'
import { sanitizeSearchQuery, ValidationError } from '@/lib/validation'

type TransactionRow = Pick<
  Transaction,
  | 'id'
  | 'from_account'
  | 'to_account'
  | 'amount'
  | 'description'
  | 'status'
  | 'created_at'
>

interface TransactionsSuccessData {
  transactions: TransactionRow[]
}

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 50

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
    const account = searchParams.get('account')
    const limitRaw = searchParams.get('limit')

    // Validate `limit` if provided.
    let limit = DEFAULT_PAGE_SIZE
    if (limitRaw !== null) {
      const parsed = Number(limitRaw)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return apiError('`limit` must be a positive number', 400)
      }
      limit = Math.min(Math.floor(parsed), MAX_PAGE_SIZE)
    }

    // Explicit column list — no `select('*')`. `created_by` is not
    // required by any current frontend view, so we omit it to minimise
    // data exposure. RLS further restricts rows to the caller's accounts.
    let query = supabase
      .from('transactions')
      .select(
        'id, from_account, to_account, amount, description, status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (account) {
      try {
        const sanitized = sanitizeSearchQuery(account)
        if (!sanitized) {
          return apiError('`account` must not be empty', 400)
        }
        // Use the typed builder APIs rather than a raw `.or()` string —
        // this prevents PostgREST filter injection via the `account`
        // query parameter.
        query = query.or(
          `from_account.eq.${sanitized},to_account.eq.${sanitized}`
        )
      } catch (err) {
        if (err instanceof ValidationError) {
          return apiError(err.message, 400)
        }
        throw err
      }
    }

    const { data, error } = await query

    if (error) {
      return serverError(error)
    }

    return apiSuccess<TransactionsSuccessData>({
      transactions: (data ?? []) as TransactionRow[]
    })
  } catch (reason) {
    return serverError(reason)
  }
}
