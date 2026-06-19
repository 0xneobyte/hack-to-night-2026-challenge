export function apiError(message: string, status = 400) {
  return Response.json({ ok: false, message }, { status })
}

export function serverError(reason: unknown) {
  console.error('[api-error]', reason)
  return Response.json(
    { ok: false, message: 'Something went wrong' },
    { status: 500 }
  )
}
