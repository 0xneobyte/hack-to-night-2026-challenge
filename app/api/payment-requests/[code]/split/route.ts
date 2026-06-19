import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { SplitParticipantInput } from '@/lib/types'

interface RouteContext {
  params: Promise<{ code: string }>
}

interface SplitBody {
  participants?: unknown
}

interface SplitRpcResult {
  ok: boolean
  message?: string
  request_id?: number
}

/**
 * POST /api/payment-requests/[code]/split — turn a request into a group
 * (split-bill) payment. Body: { participants: [{ username, percentage }] }.
 * Percentages must add up to 100; each participant settles their own share.
 */
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
    const body = (await request.json().catch(() => ({}))) as SplitBody

    if (!Array.isArray(body.participants) || body.participants.length === 0) {
      return apiError('At least one participant is required', 400)
    }

    const participants: SplitParticipantInput[] = []
    let total = 0
    for (const raw of body.participants) {
      const p = raw as { username?: unknown; percentage?: unknown }
      const username = String(p.username ?? '')
        .trim()
        .toLowerCase()
      const percentage = Number(p.percentage)
      if (!username) {
        return apiError('Every participant needs a username', 400)
      }
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        return apiError('Each percentage must be between 0 and 100', 400)
      }
      participants.push({ username, percentage })
      total += percentage
    }

    if (Math.round(total * 100) / 100 !== 100) {
      return apiError('Percentages must add up to 100', 400)
    }

    const { data, error } = await supabase.rpc('create_split', {
      p_code: code,
      p_participants: participants
    })

    if (error) {
      return serverError(error)
    }

    const result = data as SplitRpcResult | null
    if (!result || !result.ok) {
      const message = result?.message || 'Could not create split'
      const status = message.toLowerCase().includes('not found') ? 404 : 400
      return apiError(message, status)
    }

    return apiSuccess({ request_id: result.request_id })
  } catch (reason) {
    return serverError(reason)
  }
}
