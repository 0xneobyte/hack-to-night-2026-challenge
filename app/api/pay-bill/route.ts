import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import {
  parseAmount,
  parseNonEmptyString,
  ValidationError
} from '@/lib/validation'

interface PayBillRequestBody {
  fromAccount?: unknown
  billerId?: unknown
  billRef?: unknown
  amount?: unknown
  description?: unknown
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

    const body = (await request.json().catch(() => ({}))) as PayBillRequestBody

    let fromAccount: string
    let billerId: string
    let billRef: string
    let amount: number
    let description: string
    try {
      fromAccount = parseNonEmptyString(body.fromAccount, 'From account')
      billerId = parseNonEmptyString(body.billerId, 'Biller')
      billRef = parseNonEmptyString(body.billRef, 'Bill reference')
      amount = parseAmount(body.amount)
      description =
        body.description === undefined
          ? ''
          : String(body.description).slice(0, 280)
    } catch (err) {
      if (err instanceof ValidationError) {
        return apiError(err.message, 400)
      }
      throw err
    }

    const { data, error } = await supabase.rpc('perform_bill_payment', {
      p_from_account: fromAccount,
      p_biller_id: billerId,
      p_bill_ref: billRef,
      p_amount: amount,
      p_description: description
    })

    if (error) {
      return serverError(error)
    }

    const result = data as {
      ok: boolean
      message?: string
      transaction_id?: number
      balance?: number
    } | null
    if (!result || !result.ok) {
      const message = result?.message || 'Payment failed'
      const status = message.toLowerCase().includes('not your account')
        ? 403
        : 400
      return apiError(message, status)
    }

    return apiSuccess({
      message: 'Payment successful',
      transaction_id: result.transaction_id
    })
  } catch (reason) {
    return serverError(reason)
  }
}
