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
  username: string | null
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

// ---------------------------------------------------------------------------
// Demo CSE Stock Trading
//
// Mirrors the schema in supabase/migrations/0004_demo_trading_schema.sql.
// The demo trading sandbox is a paper-trading feature — virtual LKR only,
// no real money movement. Real CSE market data is fetched via the proxy
// routes under /api/cse/*.
// ---------------------------------------------------------------------------

export type DemoTradeSide = 'BUY' | 'SELL'

/** Per-user virtual cash balance (defaults to 1,000,000 LKR on first trade). */
export interface DemoBalance {
  user_id: string
  balance: number
  updated_at: string
}

/** One row per owned symbol. Weighted-average buy price. */
export interface DemoHolding {
  id: number
  user_id: string
  symbol: string
  quantity: number
  avg_price: number
  updated_at: string
}

/** Audit log of every BUY / SELL order. */
export interface DemoTrade {
  id: number
  user_id: string
  symbol: string
  side: DemoTradeSide
  price: number
  quantity: number
  total: number
  created_at: string
}

/** Shape returned by `perform_demo_buy` / `perform_demo_sell` RPCs. */
export interface DemoTradeRpcResult {
  ok: boolean
  message?: string
  trade_id?: number
  new_balance?: number
  quantity?: number
  remaining_quantity?: number
  owned?: number
  balance?: number
  cost?: number
}

// ---------------------------------------------------------------------------
// CSE market data — shapes mirrored from the CSE public API responses.
// All fields are optional because the CSE endpoints occasionally omit them
// during off-hours; consumers should default to 0 / null when absent.
// ---------------------------------------------------------------------------

export interface CseSharePrice {
  id: number
  symbol: string
  open: number
  high: number
  low: number
  lastTradedPrice: number
  change: number
  changePercentage: number
  crossingVolume: number
  tradesTime: number
  quantity: number
}

export interface CseMoverStock {
  id: number
  securityId: number
  symbol: string
  price: number
  change: number
  changePercentage: number
  tradeDate: number
}

export interface CseAspi {
  id: number
  value: number
  lowValue: number
  highValue: number
  change: number
  percentage: number
  timestamp: number
}

export interface CseMarketSummary {
  id: number
  tradeVolume: number
  shareVolume: number
  tradeDate: number
  trades: number
}

export interface CseCompanyInfo {
  reqSymbolInfo?: {
    id: number
    symbol: string
    name: string
    lastTradedPrice: number
    previousClose: number
    closingPrice: number
    change: number
    changePercentage: number
    marketCap: number
    high: number
    low: number
    quantityIssued: number
    parValue: number
  } | null
  reqLogo?: {
    id: number
    path: string
    secId: number
  } | null
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
