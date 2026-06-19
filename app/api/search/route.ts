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
    const q = searchParams.get('q') || ''

    if (!q.trim()) {
      return Response.json({ ok: true, results: [] })
    }

    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, account_number, account_name')
      .or(`account_number.ilike.%${q}%,account_name.ilike.%${q}%`)
      .limit(10)

    if (accErr) {
      return serverError(accErr)
    }

    const { data: txns, error: txErr } = await supabase
      .from('transactions')
      .select('id, from_account, to_account, description')
      .ilike('description', `%${q}%`)
      .limit(10)

    if (txErr) {
      return serverError(txErr)
    }

    const results = [
      ...(accounts || []).map((a) => ({
        type: 'account',
        id: String(a.id),
        label: a.account_number,
        detail: a.account_name
      })),
      ...(txns || []).map((t) => ({
        type: 'transaction',
        id: String(t.id),
        label: `${t.from_account} -> ${t.to_account}`,
        detail: t.description
      }))
    ]

    return Response.json({ ok: true, results })
  } catch (reason) {
    return serverError(reason)
  }
}
