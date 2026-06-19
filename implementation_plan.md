# Nova Bank — Base Fixes Before Feature Work

The goal is to fix the **foundational infrastructure** so that every future feature is built on a solid, secure, working base. These are the fixes that **must happen before any feature implementation** because they affect every API route, every page, and the entire data flow.

---

## Proposed Changes

The fixes are organized into **4 priority layers**, ordered by dependency (Layer 1 must be done first because Layer 2 depends on it, etc.).

---

### Layer 1: Secure the Database Layer (Foundation)

> Everything goes through `lib/platform-db.ts`. If this is broken, nothing else matters.

#### [MODIFY] [platform-db.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/lib/platform-db.ts)

**Fix S1 — Parameterized Query Support:**
- Replace `runStatement(sql: string)` with `runQuery(sql: string, params?: any[])` that calls `pool.query(sql, params)` 
- All callers will use `$1`, `$2` placeholders instead of string interpolation
- This is the single most important fix — it eliminates SQL injection across the entire app

**Fix S7 — Stop Leaking Internals in Error Responses:**
- Rewrite `serviceFailure()` to return a generic `{ ok: false, error: "Internal server error" }` 
- Remove `connectionString`, `stack`, `code`, `detail` from the response
- Add `console.error()` for server-side logging only

**Fix S8 — Stop Logging Sensitive SQL:**
- Remove `console.log('[bank-sql]', sql)` line entirely
- Or replace with a query template log that never includes parameter values

**Fix S10 — Remove Hardcoded Connection String:**
- Remove the fallback `'postgresql://postgres:supersecurepassword@localhost:5432/htn26db'`
- Require `DATABASE_URL` environment variable; throw a clear startup error if missing

**Fix L5 — Fix SERIAL Sequence After Seeding:**
- Add `SELECT setval(...)` calls after the seed `INSERT` statements to advance the serial sequences past the seeded IDs
- Without this, the first real user signup will crash with a duplicate key error

---

### Layer 2: Fix Every API Route (Backend Security)

> With `platform-db.ts` fixed, now rewrite every route to use parameterized queries and stop leaking data.

#### [MODIFY] [login/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/auth/login/route.ts)

**Fix S2 — Delete the GET Handler:**
- Remove the entire `GET()` function that dumps all users with plaintext passwords
- This endpoint is a catastrophic data leak

**Fix S1 — Parameterize the POST Login Query:**
```diff
- WHERE username = '${username}' AND password = '${password}'
+ WHERE username = $1 AND password = $2
```

**Fix S9 — Remove SQL from Responses:**
- Remove the `sql` field from both success and failure response bodies

**Fix S5 — Secure Session Cookies:**
- Add `HttpOnly`, `Secure`, `SameSite=Strict` flags to cookies
- Remove the client-settable `role` cookie (role should come from the server, derived from the user_id lookup)

---

#### [MODIFY] [transfer/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/transfer/route.ts)

**Fix S1 — Parameterize All Queries:**
- Convert all 3 SQL statements to use `$1`, `$2` placeholders

**Fix L1 — Wrap in a Transaction:**
- Use `BEGIN` / `COMMIT` / `ROLLBACK` so that debit+credit+insert are atomic
- If credit fails, debit is rolled back — money doesn't vanish

**Fix L2 — Add Balance Check:**
- Add `WHERE balance >= $2` to the debit UPDATE, or check balance first within the transaction
- Prevents unlimited overdraft

**Fix L3 — Validate Positive Amount:**
- Server-side check: reject if `amount <= 0` or `isNaN(amount)` 
- Prevents negative transfers (reverse theft)

**Fix L4 — Remove Dangerous Defaults:**
- Remove `fromAccount` defaulting to `'1000003423'` and `userId` defaulting to `'1'`
- Require all fields to be present; return 400 if missing

---

#### [MODIFY] [accounts/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/accounts/route.ts)

**Fix S1 — Parameterize Query:**
- Use `WHERE a.user_id = $1` instead of interpolation

**Fix S4 — Remove `includePins` Parameter:**
- Never return the `pin` column in API responses
- Remove the `includePins` query parameter entirely

---

#### [MODIFY] [transactions/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/transactions/route.ts)

**Fix S1 — Parameterize Query:**
- Use `WHERE from_account = $1 OR to_account = $1` with params array

**Remove Dangerous Default:**
- Stop defaulting `account` to `'1000003423'`

---

#### [MODIFY] [search/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/search/route.ts)

**Fix S1 — Parameterize Query:**
- Use `$1` with `'%' || $1 || '%'` pattern for ILIKE

---

#### [MODIFY] [admin/system/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/admin/system/route.ts)

**Fix S3 — Remove or Lock Down:**
- Option A: Delete the entire route (safest for now)
- Option B: Keep but remove `process.env` from the response, remove password columns from user queries, and add a comment that auth gating will be added later
- Either way: stop returning `process.env`, cookies, and full user/account data to unauthenticated callers

---

#### [MODIFY] [health/route.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/api/health/route.ts)

**Minor — Stop Leaking env:**
- It currently uses `serviceFailure()` in the catch block which leaks the connection string
- Already fixed by Layer 1's `serviceFailure()` rewrite

---

### Layer 3: Fix Critical Frontend Bugs (Quick Wins)

> These are simple, mechanical fixes that don't require backend wiring but fix broken user-facing behavior.

#### [MODIFY] [bank-transfer/page.tsx](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/bank-transfer/page.tsx)

**Fix F3 — BACK Button Navigates to Failure Screen:**
```diff
- onClick={() => setStep('failure')}
+ onClick={() => setStep('form')}
```
Line 197. One character fix.

**Fix F4 — Hardcoded Balance on Failure Screen:**
- Remove the hardcoded "Current Balance is: Rs.500" text
- For now, show a generic "Insufficient Balance" message (actual balance will be wired when frontend connects to backend)

---

#### [MODIFY] [dashboard/page.tsx](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/dashboard/page.tsx)

**Fix F6 — Asset Case Mismatch:**
```diff
- src="/dashboard-logo.png"
+ src="/Dashboard-logo.png"
```
Line 55. Fixes 404 on Linux/Docker (case-sensitive file systems).

---

#### [MODIFY] [bank-accounts/page.tsx](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/app/bank-accounts/page.tsx)

**Fix F7 — Sensitive Data in URL Query String:**
- Change `handleUpdateAccount` to use component state instead of URL params for `accountNumber`, `accountName`, `email`, `nickname`
- This keeps sensitive data out of browser history and server logs

---

### Layer 4: Create Auth Infrastructure Skeleton

> This doesn't implement full auth, but creates the **skeleton** that all future authenticated features will plug into.

#### [NEW] [middleware.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/middleware.ts)

**Fix F2 — Route Protection Skeleton:**
- Create a Next.js middleware that checks for the `user_id` cookie
- If no cookie, redirect to `/login` for all protected routes
- Public routes: `/login`, `/sign-up`, `/reset-password`, `/api/auth/login`, `/api/health`, `/api/setup`
- This is a basic cookie-presence check — not full session validation yet — but it prevents anonymous access to dashboard/transfer/accounts pages

#### [NEW] [lib/auth.ts](file:///c:/Projects/Hacktonight/hack-to-night-2026-challenge/lib/auth.ts)

**Session Helper Utility:**
- Create `getCurrentUser(request: Request)` helper that reads `user_id` from cookies and fetches the user from DB
- API routes can call this to get the authenticated user
- Returns `null` if no valid session — routes can return 401
- This is the foundation for Fix L4 (ownership verification on transfers) and all future auth-gated features

---

## What This Plan Does NOT Include (Deferred to Feature Work)

These are important but depend on feature decisions and should be done during feature implementation, not as base fixes:

| Deferred Item | Why |
|---|---|
| Password hashing (S6) | Requires deciding on bcrypt vs argon2, changes registration flow, needs migration for existing seed data |
| Wiring frontend to backend (F1) | This is literally "build the app" — every page needs different API calls based on features |
| Sign-up & reset password (F8) | Needs new API endpoints + business logic decisions |
| E-statement functionality (F9) | Feature work, needs design decisions |
| Smart Spend page (F10) | Feature work, needs design decisions |
| Dashboard real data (F5) | Needs frontend-backend wiring (F1 prerequisite) |
| JWT/signed tokens (S5 full fix) | Requires choosing a session strategy — the skeleton in Layer 4 is a stepping stone |

---

## Summary: 27 Bug Fixes Across 10 Files

| Layer | Files Modified | Bug IDs Fixed | Effort |
|---|---|---|---|
| **1. Database Layer** | 1 file | S1 (foundation), S7, S8, S10, L5 | ~30 min |
| **2. API Routes** | 6 files | S1 (all routes), S2, S3, S4, S5 (partial), S9, L1, L2, L3, L4 | ~45 min |
| **3. Frontend Quick Fixes** | 3 files | F3, F4, F6, F7 | ~15 min |
| **4. Auth Skeleton** | 2 new files | F2 (partial), L4 (foundation) | ~20 min |

**Total: ~2 hours for all 4 layers, fixing 20 of 25 identified bugs.**

---

## Verification Plan

### Automated Tests
- After fixes, run `docker compose up --build --watch` to verify the app starts
- `curl` each API endpoint to verify:
  - No SQL in responses
  - No connection string in error responses
  - Login POST works with valid credentials
  - Login GET returns 404/405
  - Transfer rejects negative amounts, missing fields
  - Accounts never return PINs
  - Admin/system is deleted or locked down

### Manual Verification
- Open browser, verify:
  - Unauthenticated access to `/dashboard` redirects to `/login`
  - BACK button on transfer confirmation returns to form (not failure)
  - Dashboard image loads (case fix)

> [!IMPORTANT]
> These are **infrastructure fixes only**. After this, the codebase will have a secure, working backend and correct UI behavior — ready for feature work like wiring the frontend, implementing real auth, building sign-up/reset-password, etc.
