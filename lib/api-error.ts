import type { ApiError, ApiResponse, ApiSuccess } from '@/lib/types'

/**
 * Generic API error helpers.
 *
 * Every API route in this app MUST use these helpers so that:
 *   1. Internal error details (Supabase error objects, stack traces, DB
 *      connection strings) never leak to the client — fixes bug S7.
 *   2. The response envelope is consistent: `{ ok: false, message }` on
 *      failure, `{ ok: true, data }` on success.
 *   3. Unexpected errors are logged server-side with full context for
 *      debugging without exposing that context to callers.
 */

/**
 * Returns a 4xx/5xx JSON response with a safe, user-facing message.
 * Use this for *expected* failures (validation, auth, business rules)
 * where the message is safe to show to the client.
 *
 * @example
 *   return apiError('Amount must be positive', 400)
 */
export function apiError(message: string, status = 400): Response {
  const body: ApiError = { ok: false, message }
  return Response.json(body, { status })
}

/**
 * Returns a 200 JSON response wrapping the successful payload.
 *
 * @example
 *   return apiSuccess({ accounts })
 *   // => { ok: true, data: { accounts: [...] } }
 */
export function apiSuccess<T>(data: T, status = 200): Response {
  const body: ApiSuccess<T> = { ok: true, data }
  return Response.json(body, { status })
}

/**
 * Handler for *unexpected* failures. Logs the full reason server-side,
 * then returns a generic 500 to the client. The reason may be a Supabase
 * error object, an Error instance, or anything thrown by the runtime.
 *
 * NEVER pass the reason's message to the client — it may contain SQL,
 * connection strings, or other internal details (bug S7).
 */
export function serverError(reason: unknown): Response {
  // Pull the most useful fields out of common shapes without ever
  // forwarding them to the client.
  if (reason && typeof reason === 'object') {
    const err = reason as {
      message?: unknown
      code?: unknown
      details?: unknown
      hint?: unknown
      stack?: unknown
    }
    console.error('[api-error] server error', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      stack: err.stack
    })
  } else {
    console.error('[api-error] server error', reason)
  }

  const body: ApiError = { ok: false, message: 'Something went wrong' }
  return Response.json(body, { status: 500 })
}

/** Type guard for the standard API envelope — useful in client code. */
export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
  return !res.ok
}
