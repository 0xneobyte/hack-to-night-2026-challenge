import { createClient } from '@/lib/supabase/server'
import { apiError, serverError } from '@/lib/api-error'

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
    const username = searchParams.get('username')?.trim().toLowerCase()

    if (!username) {
      return apiError('Username is required')
    }

    const { data, error } = await supabase.rpc('resolve_account_by_username', {
      p_username: username
    })

    if (error) {
      return serverError(error)
    }

    if (!data) {
      return apiError('No account found for this username', 404)
    }

    return Response.json({
      ok: true,
      username,
      account_number: data
    })
  } catch (reason) {
    return serverError(reason)
  }
}
