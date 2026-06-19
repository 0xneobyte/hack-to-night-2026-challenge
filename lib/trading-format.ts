/**
 * Currency / number formatting helpers for the trading UI.
 *
 * Kept local to the trading feature so it doesn't collide with any
 * future `lib/format.ts` that may be added to the rest of the app.
 * All functions are pure and safe to render in Server Components.
 */

export function formatLKR(n: number | null | undefined): string {
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return `Rs. ${safe.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/** Compact form for large numbers — 1,250,000 -> "Rs. 1.25M". */
export function formatLKRCompact(n: number | null | undefined): string {
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (Math.abs(safe) >= 1_000_000) {
    return `Rs. ${(safe / 1_000_000).toFixed(2)}M`
  }
  if (Math.abs(safe) >= 1_000) {
    return `Rs. ${(safe / 1_000).toFixed(2)}K`
  }
  return formatLKR(safe)
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return safe.toLocaleString('en-LK', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

/** Format a percentage with explicit + / - sign and 2 decimal places. */
export function formatPercent(n: number | null | undefined): string {
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0
  const sign = safe > 0 ? '+' : ''
  return `${sign}${safe.toFixed(2)}%`
}

export function formatCompactVolume(n: number | null | undefined): string {
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(2)}M`
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(2)}K`
  return safe.toLocaleString('en-LK')
}

/** Convert an epoch-millis timestamp from the CSE API to a readable time. */
export function formatTradeTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
