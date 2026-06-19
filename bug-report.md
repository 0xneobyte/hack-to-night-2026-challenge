# Nova Bank — Bug & Vulnerability Report

> Hack to Night 2026 — System Audit  
> Audited: 2026-06-19

---

## Executive Summary

The Nova Bank online banking system has **critical security vulnerabilities** in every API route, **zero authentication enforcement**, and a **frontend that is completely disconnected from the backend** — no page actually calls any API endpoint. The backend is vulnerable to full database takeover via SQL injection, and the frontend simulates success/failure with random numbers and hardcoded data.

---

## CRITICAL — Security

### S1. SQL Injection in Every API Route

**Files:** `lib/platform-db.ts`, all `/api/*` routes  
**Impact:** Full database read/write/delete, data exfiltration, auth bypass

Every API endpoint builds SQL by string interpolation into `runStatement()`. Zero parameterized queries anywhere.

| Endpoint | Injectable fields |
|---|---|
| `POST /api/auth/login` | `username`, `password` |
| `POST /api/transfer` | `fromAccount`, `toAccount`, `amount`, `description`, `userId` |
| `GET /api/accounts` | `userId`, `includePins` |
| `GET /api/transactions` | `account` |
| `GET /api/search` | `q` |

**Example:** Login with `username = ' OR '1'='1' --` bypasses all authentication.

**Fix direction:** Replace all raw SQL with parameterized queries (`$1`, `$2` placeholders via `pool.query(sql, params)`).

---

### S2. Login GET Endpoint Dumps All Users with Plaintext Passwords

**File:** `app/api/auth/login/route.ts:4-17` (GET handler)  
**Impact:** Any unauthenticated user can retrieve every username, password, role, NIC, and email.

`GET /api/auth/login` returns all user rows including the `password` column in plaintext. This is publicly accessible with no authentication.

**Fix direction:** Remove the GET handler entirely. Passwords should be hashed (bcrypt/argon2) and never returned in any response.

---

### S3. Admin System Endpoint Leaks All Secrets — No Auth

**File:** `app/api/admin/system/route.ts`  
**Impact:** Full environment variable leak, all user data, all account data

`GET /api/admin/system` requires zero authentication and returns:
- `process.env` — every environment variable including `DATABASE_URL` with credentials
- All user records (passwords included)
- All account records (PINs included)
- Raw cookies from the request

**Fix direction:** Delete or gate behind verified admin session with server-side role check.

---

### S4. Account PINs Exposed via Query Parameter

**File:** `app/api/accounts/route.ts:7-8`  
**Impact:** Anyone can request `?includePins=true` to get all PINs for any user

The `includePins` flag uses `SELECT a.*` which returns the `pin` column. Combined with no auth, any user's PINs are freely accessible.

**Fix direction:** Never return PINs in API responses. Remove the `includePins` parameter entirely.

---

### S5. Forgeable Session — Unsigned Token + Client-Set Role Cookie

**File:** `app/api/auth/login/route.ts:46-53`  
**Impact:** Any user can escalate to admin

The "token" is just `base64(id:role:session-token)` — trivially decoded and forgeable. The `role` cookie is set client-side with no signature or encryption. An attacker can set `role=admin` in their browser cookies.

Cookies also lack `HttpOnly` and `Secure` flags, making them accessible to JavaScript (XSS) and transmitted over HTTP.

**Fix direction:** Use signed, HttpOnly, Secure session tokens (JWT with a server secret, or server-side sessions). Never trust client-set role cookies.

---

### S6. Plaintext Passwords and PINs at Rest

**File:** `lib/platform-db.ts:55-66`  
**Impact:** Database breach exposes all credentials immediately

Passwords and PINs are stored in plaintext in the database. No hashing algorithm is used anywhere.

**Fix direction:** Hash passwords with bcrypt/argon2 on registration. PINs should be hashed or encrypted at rest.

---

### S7. Error Responses Leak Database Connection String and Stack Traces

**File:** `lib/platform-db.ts:93-112`  
**Impact:** Attacker learns database host, port, username, password from any error

`serviceFailure()` returns `connectionString` (includes password), full stack trace, and internal error codes to the client.

**Fix direction:** Return generic error messages to clients. Log details server-side only.

---

### S8. SQL Queries Logged to Console with User Input

**File:** `lib/platform-db.ts:77-78`  
**Impact:** Passwords, PINs, and user data appear in server logs

`console.log('[bank-sql]', sql)` logs every query including those with interpolated passwords and sensitive data.

**Fix direction:** Remove SQL logging, or log only parameterized query templates (never values).

---

### S9. Login Response Includes Executed SQL Query

**File:** `app/api/auth/login/route.ts:38, 56`  
**Impact:** Attacker sees exact SQL structure, making SQLi trivial

Both success and failure login responses include the `sql` field showing the full executed query.

**Fix direction:** Never return SQL in API responses.

---

### S10. Hardcoded Database Credentials in Source Code

**File:** `lib/platform-db.ts:5`  
**Impact:** Credentials are in version control

The fallback connection string `postgresql://postgres:supersecurepassword@localhost:5432/htn26db` is hardcoded. `.env.local` is also committed with the same password.

**Fix direction:** Use environment variables only, add `.env.local` to `.gitignore`, rotate credentials.

---

## CRITICAL — Logical

### L1. Transfer is Not Atomic — No Transaction Wrapping

**File:** `app/api/transfer/route.ts:12-28`  
**Impact:** Money can be destroyed or created from nothing

Debit and credit are separate `UPDATE` statements with no `BEGIN`/`COMMIT`. If the credit fails (e.g. invalid `toAccount`), the debit still executes — money vanishes. Network errors between the two queries cause the same issue.

**Fix direction:** Wrap debit + credit + insert in a single SQL transaction (`BEGIN ... COMMIT` with `ROLLBACK` on failure).

---

### L2. No Balance Check — Unlimited Overdraft

**File:** `app/api/transfer/route.ts:12-16`  
**Impact:** Any account can go to negative balance, creating money

The debit runs `SET balance = balance - ${amount}` with no `WHERE balance >= amount` guard. Any amount can be transferred regardless of balance.

**Fix direction:** Add `WHERE balance >= amount` to the debit query, or check balance first within the transaction.

---

### L3. Negative and Zero Amount Transfers Accepted

**File:** `app/api/transfer/route.ts:8`  
**Impact:** Attacker can reverse transfers, steal funds

`amount` is taken as-is from the request body with no validation. A negative amount reverses the flow: debiting becomes crediting and vice versa. An attacker can drain any account into their own.

**Fix direction:** Validate `amount` is a positive number > 0 on the server side before processing.

---

### L4. No Ownership Verification on Transfers

**File:** `app/api/transfer/route.ts:6,10`  
**Impact:** Anyone can transfer from any account

`fromAccount` and `userId` come directly from the request body, not from an authenticated session. An attacker can specify any `fromAccount` to transfer from anyone's account.

Default values are also dangerous: `fromAccount` defaults to `'1000003423'` (Dilara's account) and `userId` defaults to `'1'`.

**Fix direction:** Derive `userId` from the authenticated session. Verify `fromAccount` belongs to the authenticated user.

---

### L5. SERIAL Primary Key Collision with Explicit Seed IDs

**File:** `lib/platform-db.ts:55-58`  
**Impact:** First real user registration will fail

Seed data inserts users with explicit `id` values (1, 2, 3) without advancing the SERIAL sequence. The next `INSERT` without an explicit id will try `id=1` and fail with a duplicate key error.

**Fix direction:** After seeding, run `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`.

---

## HIGH — Functional

### F1. Frontend is Completely Disconnected from Backend

**Files:** All page components  
**Impact:** The application does not function as a banking system

**No page in the entire application calls any API endpoint.** There is zero `fetch()` usage across the frontend:
- Login page has no `onSubmit` handler — form inputs have no `value`/`onChange` state binding
- Sign-up page has no form submission logic
- Reset password page has no backend integration or OTP sending
- Bank transfer `handleTransfer` generates a random confirmation number client-side and never calls `/api/transfer`
- Dashboard shows hardcoded mock transactions
- E-statement form doesn't fetch any data
- Pay Bills uses a hardcoded `MOCK_BALANCE` of Rs.5000

The backend API and frontend UI are two completely separate, non-working halves.

**Fix direction:** Wire every form to its corresponding API endpoint with proper `fetch()` calls, state management, and error handling.

---

### F2. No Route Protection — Root Page Skips Login, All Pages Accessible Without Auth

**Files:** `app/page.tsx`, no `middleware.ts` exists  
**Impact:** Any user can access every page without authenticating — there is no login gate

The root URL (`/`) shows a "Smart Spend" landing page with direct links to Accounts, Bank Transfer, Pay Bills, etc. — **it does not redirect to `/login`**. There is no `middleware.ts` or any route guard anywhere. A user opening the app for the first time goes straight to banking features without ever seeing a login screen. The login page exists at `/login` but nothing forces users through it.

**Fix direction:** Add `middleware.ts` that checks for a valid session cookie and redirects unauthenticated users to `/login`. Change the root `/` to redirect to `/login` (or `/dashboard` if authenticated).

---

### F3. Bank Transfer "BACK" Button Navigates to Failure Screen

**File:** `app/bank-transfer/page.tsx:198`  
**Impact:** Clicking BACK on confirmation shows "Transaction Failed!" instead of returning to the form

```tsx
onClick={() => setStep('failure')}  // Should be setStep('form')
```

The BACK button on the confirm step sets the screen to `'failure'` instead of `'form'`, showing users a fake "Transaction Failed! Insufficient Balance" message.

**Fix direction:** Change `setStep('failure')` to `setStep('form')`.

---

### F4. Failure Screen Shows Hardcoded Balance

**File:** `app/bank-transfer/page.tsx:308-309`  
**Impact:** Misleading error information

The failure screen always shows "Current Balance is: Rs.500" regardless of actual balance.

**Fix direction:** Fetch and display the actual account balance.

---

### F5. Dashboard Data is Entirely Hardcoded

**File:** `app/dashboard/page.tsx:6-22, 43-46`  
**Impact:** Dashboard never shows real account data

Username "Dilara", balance "Rs. 100,000", and all transaction data are hardcoded constants. Nothing is fetched from the database.

**Fix direction:** Fetch user data and recent transactions from the API on page load.

---

### F6. Asset Case Mismatch — 404 on Linux/Docker

**File:** `app/dashboard/page.tsx:55`  
**Impact:** Dashboard image breaks in production (case-sensitive file systems)

References `/dashboard-logo.png` but the actual file is `/Dashboard-logo.png`. Works on macOS (case-insensitive) but 404s on Linux/Docker.

**Fix direction:** Rename the file to match the reference, or update the reference.

---

### F7. Sensitive Data in URL Query String

**File:** `app/bank-accounts/page.tsx:217`  
**Impact:** Account numbers and emails stored in browser history and server logs

`handleUpdateAccount` puts `accountNumber`, `accountName`, `email`, and `nickname` directly in the URL query string. This data persists in browser history, bookmarks, and server access logs.

**Fix direction:** Use POST requests or component state instead of URL parameters for sensitive data.

---

### F8. Sign-Up and Reset Password Pages Are Non-Functional Shells

**Files:** `app/(accounts)/sign-up/page.tsx`, `app/(accounts)/reset-password/page.tsx`  
**Impact:** Users cannot register or recover passwords

Both pages render form fields but have no submission logic, no API calls, no state management, and no corresponding backend endpoints.

**Fix direction:** Implement `/api/auth/signup` and `/api/auth/reset-password` endpoints, and wire the forms to them.

---

### F9. E-Statement Page Fetches Nothing

**File:** `app/e-statement/page.tsx`  
**Impact:** Statement page shows empty template regardless of input

The account number input has no `onChange` handler, no `value` state, and no fetch logic. The statement template below shows empty `<dd>` elements and an empty table.

**Fix direction:** Bind the input, fetch transaction data on submit, and populate the statement template.

---

### F10. Smart Spend Page is Blank

**File:** `app/smart-spend/page.tsx`  
**Impact:** Menu item leads to an empty page

The file exists but is empty (1 line, no content). The sidebar links to it but nothing renders.

**Fix direction:** Implement the page or remove from sidebar navigation.

---

## Summary Table

| ID | Severity | Category | Issue |
|----|----------|----------|-------|
| S1 | CRITICAL | Security | SQL Injection in every API route |
| S2 | CRITICAL | Security | GET /api/auth/login dumps all passwords |
| S3 | CRITICAL | Security | Admin endpoint leaks process.env + all data |
| S4 | CRITICAL | Security | PINs exposed via query parameter |
| S5 | CRITICAL | Security | Forgeable session tokens + unsigned cookies |
| S6 | CRITICAL | Security | Plaintext passwords and PINs |
| S7 | HIGH | Security | Error responses leak connection string + stack |
| S8 | HIGH | Security | SQL with user data logged to console |
| S9 | HIGH | Security | Login response includes executed SQL |
| S10 | MEDIUM | Security | Hardcoded credentials in source code |
| L1 | CRITICAL | Logical | Transfer not atomic — money can vanish |
| L2 | CRITICAL | Logical | No balance check — unlimited overdraft |
| L3 | CRITICAL | Logical | Negative amounts accepted — reverse theft |
| L4 | CRITICAL | Logical | No ownership check on transfers |
| L5 | MEDIUM | Logical | SERIAL id collision on first real signup |
| F1 | CRITICAL | Functional | Frontend never calls backend — fully disconnected |
| F2 | HIGH | Functional | No route protection — pages load without login |
| F3 | HIGH | Functional | BACK button navigates to failure screen |
| F4 | MEDIUM | Functional | Hardcoded balance on failure screen |
| F5 | HIGH | Functional | Dashboard entirely hardcoded |
| F6 | MEDIUM | Functional | Asset case mismatch — 404 on Linux |
| F7 | MEDIUM | Functional | Sensitive data in URL query string |
| F8 | HIGH | Functional | Sign-up and reset password are non-functional |
| F9 | HIGH | Functional | E-statement fetches nothing |
| F10 | MEDIUM | Functional | Smart Spend page is blank |

**Total: 10 Security, 5 Logical, 10 Functional bugs identified.**
