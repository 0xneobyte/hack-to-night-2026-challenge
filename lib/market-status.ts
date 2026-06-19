/**
 * Colombo Stock Exchange (CSE) market status helper.
 *
 * Trading sessions (Asia/Colombo, GMT+5:30):
 *   • Pre-open:   Monday–Friday  10:00 – 10:30
 *   • Regular:    Monday–Friday  10:30 – 14:30
 *   • Closed:     Saturday, Sunday, public/Poya holidays, and any time
 *                 outside the windows above.
 *
 * The implementation is timezone-safe — it formats the current instant
 * into the Asia/Colombo zone via `Intl.DateTimeFormat` and parses the
 * hour/minute back out, so it works correctly regardless of the server's
 * local timezone (Vercel runs in UTC, the dev container is UTC, etc.).
 *
 * Public/Poya holidays are NOT encoded here because they change yearly.
 * Operators can override by setting `CSE_FORCE_CLOSED=1` in the env if
 * they need to mark the market closed on a holiday without a deploy.
 */

export type MarketSession = 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'AFTER_HOURS'

export interface MarketStatusInfo {
  session: MarketSession
  /** Convenience boolean — true for PRE_OPEN and OPEN, false otherwise. */
  isOpen: boolean
  /** Human label suitable for badges. */
  label: 'Open' | 'Pre-Open' | 'Closed' | 'After Hours'
  /** Asia/Colombo time at the moment of the check, ISO format. */
  colomboTime: string
  /** Asia/Colombo weekday, 1 = Monday … 7 = Sunday. */
  colomboDayOfWeek: number
  /** Asia/Colombo hour:minute as decimal (e.g. 13.5 = 13:30). */
  colomboHourDecimal: number
  /** Reason the market is closed, when applicable. */
  reason?: 'WEEKEND' | 'BEFORE_OPEN' | 'AFTER_CLOSE' | 'FORCED_CLOSED'
}

const COLOMBO_TZ = 'Asia/Colombo'

/**
 * Returns the current Asia/Colombo clock parts as numbers.
 * Uses Intl directly so we don't need a `luxon` / `date-fns-tz` dependency.
 */
function getColomboParts(now: Date = new Date()): {
  dayOfWeek: number // 1 = Monday … 7 = Sunday
  hour: number // 0–23
  minute: number // 0–59
  iso: string
} {
  // Format with explicit options + timeZone; parts come back in the
  // target zone's local representation.
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: COLOMBO_TZ,
    weekday: 'short', // Mon, Tue, …
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = fmt.formatToParts(now)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  }

  // Reassemble an ISO-style timestamp in Colombo wall-clock time so the
  // caller can display "as seen in Sri Lanka" without timezone confusion.
  const iso = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:00+05:30`

  return {
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
    hour: Number.parseInt(map.hour, 10),
    minute: Number.parseInt(map.minute, 10),
    iso
  }
}

/**
 * Returns the current CSE market status. Pure function — safe to call
 * from server components, API routes, or client components.
 */
export function getMarketStatus(now: Date = new Date()): MarketStatusInfo {
  // Manual override for holidays / maintenance windows.
  if (process.env.CSE_FORCE_CLOSED === '1') {
    const parts = getColomboParts(now)
    return {
      session: 'CLOSED',
      isOpen: false,
      label: 'Closed',
      colomboTime: parts.iso,
      colomboDayOfWeek: parts.dayOfWeek,
      colomboHourDecimal: parts.hour + parts.minute / 60,
      reason: 'FORCED_CLOSED'
    }
  }

  const { dayOfWeek, hour, minute, iso } = getColomboParts(now)
  const decimal = hour + minute / 60

  // Saturday (6) or Sunday (7) — always closed.
  if (dayOfWeek === 6 || dayOfWeek === 7) {
    return {
      session: 'CLOSED',
      isOpen: false,
      label: 'Closed',
      colomboTime: iso,
      colomboDayOfWeek: dayOfWeek,
      colomboHourDecimal: decimal,
      reason: 'WEEKEND'
    }
  }

  // Weekday — check time windows.
  // 10:00 (10.0) – 10:30 (10.5)  → PRE_OPEN
  // 10:30 (10.5) – 14:30 (14.5)  → OPEN
  if (decimal >= 10.0 && decimal < 10.5) {
    return {
      session: 'PRE_OPEN',
      isOpen: true,
      label: 'Pre-Open',
      colomboTime: iso,
      colomboDayOfWeek: dayOfWeek,
      colomboHourDecimal: decimal
    }
  }
  if (decimal >= 10.5 && decimal < 14.5) {
    return {
      session: 'OPEN',
      isOpen: true,
      label: 'Open',
      colomboTime: iso,
      colomboDayOfWeek: dayOfWeek,
      colomboHourDecimal: decimal
    }
  }

  // Before 10:00 or after 14:30 on a weekday.
  return {
    session: decimal < 10.0 ? 'CLOSED' : 'AFTER_HOURS',
    isOpen: false,
    label: decimal < 10.0 ? 'Closed' : 'After Hours',
    colomboTime: iso,
    colomboDayOfWeek: dayOfWeek,
    colomboHourDecimal: decimal,
    reason: decimal < 10.0 ? 'BEFORE_OPEN' : 'AFTER_CLOSE'
  }
}

/**
 * Returns the next market-open instant as an ISO string, or null if it
 * can't be computed (e.g. we'd need a full holiday calendar). Used by
 * the UI to show "Opens in 4h 12m" style hints.
 *
 * Implementation: walks forward in 5-minute increments from now, max
 * 48 hours ahead, and returns the first instant where getMarketStatus
 * returns `session === 'OPEN'`. Cheap enough to call from an API route
 * on every market-summary request.
 */
export function getNextOpenTime(now: Date = new Date()): string | null {
  const cursor = new Date(now.getTime())
  for (let i = 0; i < 48 * 12; i++) {
    // 48 hours * 12 five-minute steps
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 5)
    const status = getMarketStatus(cursor)
    if (status.session === 'OPEN') {
      return status.colomboTime
    }
  }
  return null
}
