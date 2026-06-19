import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { TransferRpcResult } from '@/lib/types'
import {
  parseAmount,
  parseNonEmptyString,
  ValidationError
} from '@/lib/validation'

interface TransferRequestBody {
  fromAccount?: unknown
  toAccount?: unknown
  amount?: unknown
  description?: unknown
}

interface TransferSuccessData {
  message: string
  transaction_id: number
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

    const body = (await request.json().catch(() => ({}))) as TransferRequestBody

    let fromAccount: string
    let toAccount: string
    let amount: number
    let description: string
    try {
      fromAccount = parseNonEmptyString(body.fromAccount, 'From account')
      toAccount = parseNonEmptyString(body.toAccount, 'To account')
      amount = parseAmount(body.amount)
      // Description is optional — empty string is fine.
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

    if (fromAccount === toAccount) {
      return apiError('Source and destination accounts must differ', 400)
    }

    const { data, error } = await supabase.rpc('perform_transfer', {
      p_from_account: fromAccount,
      p_to_account: toAccount,
      p_amount: amount,
      p_description: description
    })

    if (error) {
      return serverError(error)
    }

    const result = data as TransferRpcResult | null
    if (!result || !result.ok) {
      // The RPC returns business-level failures (insufficient balance,
      // wrong owner, missing destination) with HTTP 200 + `{ ok: false }`.
      // Surface them to the client as 400 / 403 depending on intent.
      const message = result?.message || 'Transfer failed'
      const status = message.toLowerCase().includes('not your account')
        ? 403
        : 400
      return apiError(message, status)
    }

    const payload: TransferSuccessData = {
      message: 'Transfer successful',
      transaction_id: result.transaction_id as number
    }
    return apiSuccess(payload)
  } catch (reason) {
    return serverError(reason)
  }
}
