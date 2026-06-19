import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import { parseNonEmptyString, ValidationError } from '@/lib/validation'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface PayBody {
  fromAccount?: unknown
}

interface PaySplitRpcResult {
  ok: boolean
  message?: string
  transaction_id?: number
  amount?: number
  request_settled?: boolean
}

/** POST /api/splits/[id]/pay — a participant settles their own share. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params
    const splitId = Number(id)
    if (!Number.isInteger(splitId) || splitId <= 0) {
      return apiError('Invalid split id', 400)
    }

    const body = (await request.json().catch(() => ({}))) as PayBody
    let fromAccount: string
    try {
      fromAccount = parseNonEmptyString(body.fromAccount, 'From account')
    } catch (err) {
      if (err instanceof ValidationError) {
        return apiError(err.message, 400)
      }
      throw err
    }

    const { data, error } = await supabase.rpc('pay_split', {
      p_split_id: splitId,
      p_from_account: fromAccount
    })

    if (error) {
      return serverError(error)
    }

    const result = data as PaySplitRpcResult | null
    if (!result || !result.ok) {
      const message = result?.message || 'Payment failed'
      const status = message.toLowerCase().includes('not your split')
        ? 403
        : message.toLowerCase().includes('not found')
          ? 404
          : 400
      return apiError(message, status)
    }

    return apiSuccess({
      transaction_id: result.transaction_id,
      amount: result.amount,
      request_settled: result.request_settled
    })
  } catch (reason) {
    return serverError(reason)
  }
}
