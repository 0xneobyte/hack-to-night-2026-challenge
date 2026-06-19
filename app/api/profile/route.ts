import { createClient } from '@/lib/supabase/server'
import { apiError, serverError } from '@/lib/api-error'

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
      .from('profiles')
      .select('id, full_name, nic, role, created_at')
      .eq('id', user.id)
      .single()

    if (error) {
      return serverError(error)
    }

    return Response.json({
      ok: true,
      profile: { ...data, email: user.email }
    })
  } catch (reason) {
    return serverError(reason)
  }
}
