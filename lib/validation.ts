/**
 * Shared input validation helpers for API routes.
 *
 * Centralizing these keeps route handlers thin and ensures every route
 * applies the same rules. Throws `ValidationError` on bad input; routes
 * should catch it and convert to a 400 response via `apiError()`.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Parses and validates a monetary amount.
 * Rejects: undefined, null, empty string, NaN, zero, negative numbers,
 * and non-finite values. Returns a number rounded to 2 decimal places.
 */
export function parseAmount(input: unknown): number {
  if (input === undefined || input === null || input === '') {
    throw new ValidationError('Amount is required')
  }
  const num = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(num)) {
    throw new ValidationError('Amount must be a valid number')
  }
  if (num <= 0) {
    throw new ValidationError('Amount must be greater than zero')
  }
  // Round to 2dp to avoid floating point drift in the RPC call.
  return Math.round(num * 100) / 100
}

/** Requires a non-empty trimmed string; returns the trimmed value. */
export function parseNonEmptyString(input: unknown, field: string): string {
  if (input === undefined || input === null) {
    throw new ValidationError(`${field} is required`)
  }
  const str = String(input).trim()
  if (!str) {
    throw new ValidationError(`${field} must not be empty`)
  }
  return str
}

/**
 * Sanitizes a free-text query string for use in Supabase `.ilike()`
 * filters. PostgREST `.or()` strings and ILIKE patterns interpret the
 * characters `,`, `.`, `(`, `)`, `\\`, `%`, and `_` as syntax, so we
 * strip them to prevent filter injection via the `q` URL parameter.
 *
 * Returns the cleaned string. Empty/whitespace input returns an empty
 * string and the caller should short-circuit with an empty result set.
 */
export function sanitizeSearchQuery(input: unknown): string {
  if (input === undefined || input === null) return ''
  const raw = String(input).trim()
  if (!raw) return ''
  // Remove characters that have meaning in PostgREST filters / ILIKE
  // patterns. We do NOT escape — we strip, because legitimate account
  // names and descriptions should never contain these.
  return raw.replace(/[,.()\\%_*]/g, '')
}
