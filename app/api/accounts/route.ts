import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { Account } from '@/lib/types'

interface AccountsSuccessData {
  accounts: Pick<
    Account,
    'id' | 'account_number' | 'account_name' | 'balance' | 'created_at'
  >[]
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError('Unauthorized', 401)
    }

    // RLS guarantees only the calling user's rows are returned, but we
    // add an explicit `.eq('user_id', user.id)` filter as defence in
    // depth — if RLS is ever accidentally disabled this still keeps
    // accounts scoped to the caller.
    //
    // We never select `pin_hash`. The column list below is the only
    // projection allowed on this route. (Bug S4.)
    const { data, error } = await supabase
      .from('accounts')
      .select('id, account_number, account_name, balance, created_at')
      .eq('user_id', user.id)
      .order('id', { ascending: true })

    if (error) {
      return serverError(error)
    }

    return apiSuccess<AccountsSuccessData>({ accounts: data ?? [] })
  } catch (reason) {
    return serverError(reason)
  }
}
