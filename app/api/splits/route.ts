import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/splits — the caller's own split shares (group payments they were
 * invited to). `?status=PENDING` filters to unpaid shares. RLS already scopes
 * rows to the participant.
 */
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
    const status = searchParams.get('status')

    let query = supabase
      .from('payment_splits')
      .select(
        'id, percentage, amount, status, transaction_id, created_at, request:payment_requests(code, description, to_account, amount, status)'
      )
      .eq('participant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (status === 'PENDING' || status === 'PAID') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      return serverError(error)
    }

    return apiSuccess({ splits: data ?? [] })
  } catch (reason) {
    return serverError(reason)
  }
}
