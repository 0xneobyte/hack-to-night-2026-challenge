import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { PaymentRequest } from '@/lib/types'
import {
  parseAmount,
  parseNonEmptyString,
  ValidationError
} from '@/lib/validation'

interface CreateRequestBody {
  toAccount?: unknown
  amount?: unknown
  description?: unknown
  expiresInMinutes?: unknown
}

interface CreateRequestRpcResult {
  ok: boolean
  message?: string
  code?: string
}

/** GET /api/payment-requests — the caller's own requests, newest first. */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const { data, error } = await supabase
      .from('payment_requests')
      .select(
        'id, code, to_account, amount, description, status, expires_at, created_at'
      )
      .eq('requester_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return serverError(error)
    }

    return apiSuccess<{ requests: Partial<PaymentRequest>[] }>({
      requests: data ?? []
    })
  } catch (reason) {
    return serverError(reason)
  }
}

/**
 * POST /api/payment-requests — create a QR payment request.
 * `amount` omitted => open-amount personal QR.
 * `expiresInMinutes` set => temp QR that auto-expires.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const body = (await request.json().catch(() => ({}))) as CreateRequestBody

    let toAccount: string
    let amount: number | null
    let description: string | null
    let expiresAt: string | null
    try {
      toAccount = parseNonEmptyString(body.toAccount, 'Destination account')
      // Amount is optional — null means an open-amount QR.
      amount =
        body.amount === undefined || body.amount === null || body.amount === ''
          ? null
          : parseAmount(body.amount)
      description =
        body.description === undefined
          ? null
          : String(body.description).slice(0, 280)

      if (
        body.expiresInMinutes === undefined ||
        body.expiresInMinutes === null ||
        body.expiresInMinutes === ''
      ) {
        expiresAt = null
      } else {
        const mins = Number(body.expiresInMinutes)
        if (!Number.isFinite(mins) || mins <= 0) {
          throw new ValidationError(
            'Expiry must be a positive number of minutes'
          )
        }
        expiresAt = new Date(Date.now() + mins * 60_000).toISOString()
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return apiError(err.message, 400)
      }
      throw err
    }

    const { data, error } = await supabase.rpc('create_payment_request', {
      p_to_account: toAccount,
      p_amount: amount,
      p_description: description,
      p_expires_at: expiresAt
    })

    if (error) {
      return serverError(error)
    }

    const result = data as CreateRequestRpcResult | null
    if (!result || !result.ok) {
      const message = result?.message || 'Could not create request'
      const status = message === 'Not your account' ? 403 : 400
      return apiError(message, status)
    }

    return apiSuccess({ code: result.code })
  } catch (reason) {
    return serverError(reason)
  }
}
