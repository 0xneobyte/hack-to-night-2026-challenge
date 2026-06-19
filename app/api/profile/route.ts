import { apiError, apiSuccess, serverError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import type { Profile, ProfileWithEmail, UserRole } from '@/lib/types'

interface ProfileSuccessData {
  profile: ProfileWithEmail
}

interface ProfileRow {
  id: string
  full_name: string
  nic: string | null
  role: UserRole
  created_at: string
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

    // Fetch the public profile row. RLS guarantees only the caller's
    // own profile is visible (`auth.uid() = id`).
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, nic, role, created_at')
      .eq('id', user.id)
      .single()

    if (error) {
      return serverError(error)
    }

    const profile = data as ProfileRow
    const payload: ProfileSuccessData = {
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        nic: profile.nic,
        role: profile.role,
        created_at: profile.created_at,
        email: user.email ?? null
      }
    }

    return apiSuccess<ProfileSuccessData>(payload)
  } catch (reason) {
    return serverError(reason)
  }
}

export type { Profile, ProfileWithEmail }
