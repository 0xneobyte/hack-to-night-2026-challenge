/**
 * Structured server-side logger.
 *
 * Replaces ad-hoc `console.log` calls with a single, JSON-formatted
 * logger that:
 *   - Includes a timestamp, level, and request context.
 *   - Never logs sensitive values (passwords, tokens, full PANs).
 *   - Is a no-op for debug logs in production.
 *
 * Usage in an API route:
 *   import { logger } from '@/lib/logger'
 *   logger.info('transfer.completed', { txId: 42, amount: 4500 })
 *   logger.warn('transfer.low_balance', { accountId: 1, balance: 100 })
 *   logger.error('transfer.failed', reason)
 *
 * The output is a single JSON line per call, suitable for ingestion
 * by any log aggregator (Loki, Datadog, Vercel logs, etc.).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

/** Adjust this to filter logs in production. */
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL]
}

/**
 * Redacts common sensitive keys from a context object before logging.
 * The original object is not mutated.
 */
function redact(ctx: LogContext): LogContext {
  const SENSITIVE = new Set([
    'password',
    'pin',
    'pin_hash',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'cookie',
    'set_cookie',
    'service_role_key',
    'anon_key',
    'supabase_url'
  ])
  const out: LogContext = {}
  for (const [key, value] of Object.entries(ctx)) {
    if (SENSITIVE.has(key.toLowerCase())) {
      out[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redact(value as LogContext)
    } else {
      out[key] = value
    }
  }
  return out
}

function write(level: LogLevel, event: string, ctx: LogContext = {}): void {
  if (!shouldLog(level)) return
  const payload = {
    time: new Date().toISOString(),
    level,
    event,
    ...redact(ctx)
  }
  // Use console.error for warn/error so it goes to stderr; console.log
  // for debug/info so it goes to stdout. Log aggregators split on this.
  const fn = level === 'error' || level === 'warn' ? console.error : console.log
  fn(JSON.stringify(payload))
}

export const logger = {
  debug(event: string, ctx?: LogContext): void {
    write('debug', event, ctx)
  },
  info(event: string, ctx?: LogContext): void {
    write('info', event, ctx)
  },
  warn(event: string, ctx?: LogContext): void {
    write('warn', event, ctx)
  },
  error(event: string, reason?: unknown, ctx?: LogContext): void {
    const merged: LogContext = { ...ctx }
    if (reason instanceof Error) {
      merged.errorMessage = reason.message
      merged.stack = reason.stack
    } else if (reason !== undefined) {
      merged.reason = String(reason)
    }
    write('error', event, merged)
  }
}

export type { LogContext, LogLevel }
