import { createClient } from '@/lib/supabase/server'
import { apiError, serverError } from '@/lib/api-error'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const body = await request.json().catch(() => ({}))
    const { fromAccount, toAccount, amount, description } = body

    if (!fromAccount || !toAccount) {
      return apiError('From and to account numbers are required')
    }

    const numAmount = Number(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return apiError('Amount must be a positive number')
    }

    const { data, error } = await supabase.rpc('perform_transfer', {
      p_from_account: String(fromAccount),
      p_to_account: String(toAccount),
      p_amount: numAmount,
      p_description: String(description || '')
    })

    if (error) {
      return serverError(error)
    }

    if (!data.ok) {
      return apiError(data.message)
    }

    return Response.json({
      ok: true,
      message: 'Transfer successful',
      transaction_id: data.transaction_id
    })
  } catch (reason) {
    return serverError(reason)
  }
}
