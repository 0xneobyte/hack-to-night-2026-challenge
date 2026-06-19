# Nova Bank — API Contracts

> Single source of truth for every API route in the app.
> Phase 2 frontend work MUST code against this contract.
> Last updated: 2026-06-20.

## Conventions

### Standard response envelope

Every route returns JSON with one of two shapes. There are no exceptions.

**Success (HTTP 2xx):**
```json
{ "ok": true, "data": { ... } }
```

**Error (HTTP 4xx / 5xx):**
```json
{ "ok": false, "message": "Human-readable, safe to show to the user" }
```

Internal details (SQL, connection strings, stack traces, Supabase error
codes) are NEVER included in the response. They are logged server-side.

### Authentication

Every route requires a valid Supabase Auth session cookie set by
`@supabase/ssr`. Anonymous requests get `401 Unauthorized`.

The middleware (`middleware.ts`) redirects unauthenticated browser
requests from protected pages to `/login`. API routes return JSON
`401` instead of redirecting.

### Error status codes

| Code | Meaning                                                            |
|------|-------------------------------------------------------------------|
| 400  | Validation failure, business rule rejection (e.g. overdraft)      |
| 401  | No session or session expired                                     |
| 403  | Authenticated but not allowed (e.g. trying to transfer from someone else's account) |
| 500  | Unexpected server error — logged internally, generic message returned |

---

## `POST /api/transfer`

Execute an atomic money transfer between two accounts via the
`perform_transfer` Supabase RPC.

### Request body

```json
{
  "fromAccount": "1000003423",
  "toAccount":   "2000006754",
  "amount":      4500,
  "description": "Lunch money"
}
```

| Field         | Type    | Required | Notes                                              |
|---------------|---------|----------|----------------------------------------------------|
| `fromAccount` | string  | yes      | Must belong to the authenticated user              |
| `toAccount`   | string  | yes      | Must differ from `fromAccount`                     |
| `amount`      | number  | yes      | Must be a finite number > 0; rounded to 2 dp       |
| `description` | string  | no       | Optional, truncated to 280 chars                   |

### Responses

**200 — Success**
```json
{
  "ok": true,
  "data": {
    "message": "Transfer successful",
    "transaction_id": 42
  }
}
```

**400 — Validation failure / business rule**
```json
{ "ok": false, "message": "Amount must be greater than zero" }
```
Common messages: `From account is required`, `To account is required`,
`Amount must be a positive number`, `Source and destination accounts must differ`,
`Insufficient balance`, `Destination account not found`.

**401 — Unauthorized**
```json
{ "ok": false, "message": "Unauthorized" }
```

**403 — Ownership violation**
```json
{ "ok": false, "message": "Not your account" }
```

---

## `GET /api/accounts`

List all accounts owned by the authenticated user. PIN hashes are
never returned.

### Query parameters

None.

### Response (200)

```json
{
  "ok": true,
  "data": {
    "accounts": [
      {
        "id":             1,
        "account_number": "1000003423",
        "account_name":   "Dilara Savings",
        "balance":        95500.00,
        "created_at":     "2026-06-19T18:30:00.000Z"
      }
    ]
  }
}
```

| Field            | Type     | Notes                              |
|------------------|----------|------------------------------------|
| `id`             | number   | Internal serial PK                 |
| `account_number` | string   | Public account identifier          |
| `account_name`   | string   | User-chosen label                  |
| `balance`        | number   | Current balance, 2 decimal places  |
| `created_at`     | string   | ISO 8601 timestamp                 |

---

## `GET /api/transactions`

List transactions involving the authenticated user's accounts, newest first.

### Query parameters

| Name      | Type   | Required | Default | Notes                                       |
|-----------|--------|----------|---------|---------------------------------------------|
| `account` | string | no       | —       | Filter to a specific account number         |
| `limit`   | number | no       | 50      | Page size; capped at 100                    |

### Response (200)

```json
{
  "ok": true,
  "data": {
    "transactions": [
      {
        "id":           42,
        "from_account": "1000003423",
        "to_account":   "2000006754",
        "amount":       4500.00,
        "description":  "Lunch money",
        "status":       "SUCCESS",
        "created_at":   "2026-06-19T18:30:00.000Z"
      }
    ]
  }
}
```

The `created_by` column is intentionally omitted to avoid leaking user IDs.

---

## `GET /api/search?q=<query>`

Search across the user's own accounts and transactions by text.

### Query parameters

| Name | Type   | Required | Notes                                                        |
|------|--------|----------|--------------------------------------------------------------|
| `q`  | string | no       | PostgREST filter syntax (`,`, `.`, `(`, `)`, `%`, `_`) is stripped |

Empty `q` returns `{ results: [] }` with 200.

### Response (200)

```json
{
  "ok": true,
  "data": {
    "results": [
      { "type": "account",     "id": "1",  "label": "1000003423",         "detail": "Dilara Savings" },
      { "type": "transaction", "id": "42", "label": "1000003423 -> 2000006754", "detail": "Lunch money" }
    ]
  }
}
```

At most 10 account matches + 10 transaction matches are returned.

---

## `GET /api/profile`

Fetch the authenticated user's profile and email.

### Response (200)

```json
{
  "ok": true,
  "data": {
    "profile": {
      "id":         "00000000-0000-0000-0000-000000000001",
      "full_name":  "Dilara Perera",
      "nic":        "200112345678",
      "role":       "customer",
      "created_at": "2026-06-19T18:00:00.000Z",
      "email":      "dilara@example.com"
    }
  }
}
```

| Field        | Type             | Notes                                 |
|--------------|------------------|---------------------------------------|
| `id`         | string (UUID)    | Matches `auth.users.id`               |
| `full_name`  | string           |                                       |
| `nic`        | string \| null   | National ID card number               |
| `role`       | `"customer"` \| `"admin"` |                              |
| `created_at` | string           | ISO 8601                              |
| `email`      | string \| null   | From `auth.users.email`               |

---

## Removed endpoints

The following routes existed in the old `platform-db.ts` backend and
have been deleted. They must NOT be reintroduced:

| Route                       | Reason                                                       |
|-----------------------------|--------------------------------------------------------------|
| `GET /api/auth/login`       | Dumped all users with plaintext passwords (bug S2)           |
| `GET /api/admin/system`     | Leaked `process.env`, all users, all accounts (bug S3)       |
| `GET /api/health`           | Used `serviceFailure()` which leaked the connection string   |
| `POST /api/setup`           | Bootstrapped the local DB — Supabase handles schema now      |
| `lib/platform-db.ts`        | Raw SQL with string interpolation — replaced by Supabase client |

Authentication is now handled by Supabase Auth directly from the
frontend (`supabase.auth.signInWithPassword`, etc.) — there is no
`/api/auth/login` route. The session cookie is set by `@supabase/ssr`
and refreshed by `lib/supabase/middleware.ts`.
