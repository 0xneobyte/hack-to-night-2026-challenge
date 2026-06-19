import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import {
  parseAmount,
  parseNonEmptyString,
  ValidationError
} from '@/lib/validation'

interface RouteContext {
  params: Promise<{ code: string }>
}

interface PayBody {
  fromAccount?: unknown
  amount?: unknown
}

interface PayRpcResult {
  ok: boolean
  message?: string
  transaction_id?: number
  amount?: number
  balance?: number
}

/** POST /api/payment-requests/[code]/pay — settle a request in full (single). */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const { code } = await params
    const body = (await request.json().catch(() => ({}))) as PayBody

    let fromAccount: string
    let amount: number | null
    try {
      fromAccount = parseNonEmptyString(body.fromAccount, 'From account')
      // Amount only required for open-amount QRs; the RPC falls back to the
      // request's fixed amount when this is null.
      amount =
        body.amount === undefined || body.amount === null || body.amount === ''
          ? null
          : parseAmount(body.amount)
    } catch (err) {
      if (err instanceof ValidationError) {
        return apiError(err.message, 400)
      }
      throw err
    }

    const { data, error } = await supabase.rpc('pay_payment_request', {
      p_code: code,
      p_from_account: fromAccount,
      p_amount: amount
    })

    if (error) {
      return serverError(error)
    }

    const result = data as PayRpcResult | null
    if (!result || !result.ok) {
      const message = result?.message || 'Payment failed'
      const status = message.toLowerCase().includes('not your account')
        ? 403
        : message.toLowerCase().includes('not found')
          ? 404
          : 400
      return apiError(message, status)
    }

    return apiSuccess({
      transaction_id: result.transaction_id,
      amount: result.amount
    })
  } catch (reason) {
    return serverError(reason)
  }
}
