import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS.
 * Safe to use only in API routes (server-side). Never import from client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
