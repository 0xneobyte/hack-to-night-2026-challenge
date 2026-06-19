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
    const account = searchParams.get('account')

    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })

    if (account) {
      query = query.or(`from_account.eq.${account},to_account.eq.${account}`)
    }

    const { data, error } = await query

    if (error) {
      return serverError(error)
    }

    return Response.json({ ok: true, transactions: data })
  } catch (reason) {
    return serverError(reason)
  }
}
