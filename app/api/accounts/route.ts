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
      .from('accounts')
      .select('id, account_number, account_name, balance, created_at')
      .order('id')

    if (error) {
      return serverError(error)
    }

    return Response.json({ ok: true, accounts: data })
  } catch (reason) {
    return serverError(reason)
  }
}
