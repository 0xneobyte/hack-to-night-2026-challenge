import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface LookupUserData {
  full_name: string
  username: string
  account_number: string
}

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

    // Use the admin client to bypass RLS for cross-user profile reads
    const admin = createAdminClient()

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('full_name, username')
      .eq('username', username)
      .maybeSingle()

    if (profileError || !profile) {
      return apiError('No user found with this username', 404)
    }

    // Resolve account number via RPC (still runs as the authed user)
    const { data: accountNumber, error: rpcError } = await supabase.rpc(
      'resolve_account_by_username',
      { p_username: username }
    )

    if (rpcError || !accountNumber) {
      return apiError('No account found for this username', 404)
    }

    return apiSuccess<LookupUserData>({
      full_name: profile.full_name,
      username: profile.username ?? username,
      account_number: accountNumber
    })
  } catch (reason) {
    return serverError(reason)
  }
}
