/**
 * Pure formatting helpers for currency, dates, and account numbers.
 *
 * These are framework-agnostic — safe to use from Server Components,
 * API routes, and Client Components alike. No imports from Next or
 * Supabase.
 */

const LKR_FORMATTER = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
})

const DATETIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

/**
 * Formats a number as a Sri Lankan Rupee string.
 * Returns 'Rs.0.00' for null/undefined so the UI never shows "NaN".
 *
 * @example
 *   formatLKR(4500)     // "Rs.4,500.00"
 *   formatLKR(null)     // "Rs.0.00"
 *   formatLKR(95500.5)  // "Rs.95,500.50"
 */
export function formatLKR(amount: number | null | undefined): string {
  const safe =
    typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return LKR_FORMATTER.format(safe)
}

/**
 * Formats an ISO date string as "12 Jun 2026".
 * Returns empty string for null/undefined so the UI can show a placeholder.
 *
 * @example
 *   formatDate('2026-06-12T18:30:00.000Z')  // "12 Jun 2026"
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return DATE_FORMATTER.format(date)
}

/**
 * Formats an ISO date string as "12 Jun 2026, 18:30".
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return DATETIME_FORMATTER.format(date)
}

/**
 * Masks an account number, showing only the first 4 and last 4 digits.
 * Used anywhere we display an account number in a list or summary
 * where the full number isn't needed.
 *
 * @example
 *   maskAccountNumber('1000003423')  // "1000...3423"
 *   maskAccountNumber('1000')         // "1000"
 *   maskAccountNumber(null)           // ""
 */
export function maskAccountNumber(account: string | null | undefined): string {
  if (!account) return ''
  const str = String(account)
  if (str.length <= 8) return str
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

/**
 * Returns the initials of a full name, e.g. "Dilara Perera" -> "DP".
 * Used for avatar placeholders.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Converts a transaction into a signed amount from the perspective of
 * the given account number: negative for outgoing, positive for incoming.
 *
 * @example
 *   signedAmount({ from_account: 'A', to_account: 'B', amount: 100 }, 'A')  // -100
 *   signedAmount({ from_account: 'A', to_account: 'B', amount: 100 }, 'B')  //  100
 */
export function signedAmount(
  txn: { from_account: string; to_account: string; amount: number },
  viewerAccount: string
): number {
  if (txn.from_account === viewerAccount) return -Math.abs(txn.amount)
  if (txn.to_account === viewerAccount) return Math.abs(txn.amount)
  return 0
}
