import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { PaymentRequest, PaymentSplit } from '@/lib/types'

interface RouteContext {
  params: Promise<{ code: string }>
}

/**
 * GET /api/payment-requests/[code] — public-to-authenticated view of a request
 * so a payer can see what they are about to settle. Also returns any existing
 * split rows the caller is allowed to see (host or participant).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    const { code } = await params

    const { data: req, error } = await supabase
      .from('payment_requests')
      .select(
        'id, code, requester_id, to_account, amount, description, status, expires_at, created_at'
      )
      .eq('code', code)
      .maybeSingle()

    if (error) {
      return serverError(error)
    }
    if (!req) {
      return apiError('Payment request not found', 404)
    }

    // Requester display name — best effort, never blocks the payment view.
    const { data: requester } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', req.requester_id)
      .maybeSingle()

    // RLS scopes splits to host/participant automatically.
    const { data: splits } = await supabase
      .from('payment_splits')
      .select(
        'id, request_id, host_id, participant_id, percentage, amount, status, transaction_id, created_at'
      )
      .eq('request_id', req.id)

    const expired =
      req.status === 'OPEN' &&
      req.expires_at !== null &&
      new Date(req.expires_at).getTime() < Date.now()

    return apiSuccess<{
      request: PaymentRequest & { requester_name: string | null }
      splits: PaymentSplit[]
      isMine: boolean
    }>({
      request: {
        ...(req as PaymentRequest),
        status: expired ? 'EXPIRED' : req.status,
        requester_name: requester?.full_name ?? requester?.username ?? null
      },
      splits: (splits as PaymentSplit[]) ?? [],
      isMine: req.requester_id === user.id
    })
  } catch (reason) {
    return serverError(reason)
  }
}
