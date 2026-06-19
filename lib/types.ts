/**
 * Shared domain and API types for the Nova Bank backend.
 *
 * These types mirror the Supabase schema documented in `bug-report.md`:
 *   - profiles    (1:1 with auth.users)
 *   - accounts    (per-user bank accounts; pin_hash is NEVER selected)
 *   - transactions (money movements between accounts)
 *   - audit_logs  (security event log)
 *
 * Keeping these in one place lets every API route return a consistent,
 * type-safe shape so the Phase 2 frontend can rely on the contract.
 */

export type UserRole = 'customer' | 'admin'

export interface Profile {
  id: string
  full_name: string
  nic: string | null
  role: UserRole
  created_at: string
}

export interface ProfileWithEmail extends Profile {
  email: string | null
}

export interface Account {
  id: number
  user_id: string
  account_number: string
  account_name: string
  balance: number
  created_at: string
}

/**
 * Public-safe projection of an account.
 * `pin_hash` is intentionally absent — it must never leave the database.
 */
export type PublicAccount = Omit<Account, 'user_id'> & {
  user_id?: never
}

export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

export interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: number
  description: string | null
  status: TransactionStatus
  created_by: string | null
  created_at: string
}

/**
 * Shape returned by the `perform_transfer(...)` Postgres RPC function.
 * The function always returns a JSONB object with at least an `ok` flag.
 */
export interface TransferRpcResult {
  ok: boolean
  message?: string
  transaction_id?: number
  balance?: number
}

export interface SearchResult {
  type: 'account' | 'transaction'
  id: string
  label: string
  detail: string | null
}

/** Standard success envelope used by every API route. */
export interface ApiSuccess<T> {
  ok: true
  data: T
}

/** Standard error envelope. Internal details never reach the client. */
export interface ApiError {
  ok: false
  message: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
