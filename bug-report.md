# Nova Bank — Bug Report & Implementation Plan

> Hack to Night 2026 — Team Audit & Roadmap  
> Date: 2026-06-19  
> Team: Neo, Gimhani, Zenith, Ruwithma

---

## Executive Summary

The Nova Bank system has **25 bugs** across security, logic, and functionality. The frontend is **completely disconnected from the backend** — no page calls any API. The backend is vulnerable to **SQL injection in every route** and has **zero authentication**. Below is the fix plan organized by dependency order and assigned across the team.

---

## Team & Workstream Overview

| Member | Workstream | Focus Area |
|--------|-----------|------------|
| **Neo** | Backend Foundation | Database layer, auth system, middleware, sessions |
| **Gimhani** | API Security & Logic | Fix all API routes, transfer logic, remove leaks |
| **Zenith** | Frontend Auth & Core | Login, signup, reset password, dashboard wiring |
| **Ruwithma** | Frontend Features | Bank transfer, pay bills, e-statement, smart spend, accounts |

---

## Phase 1 — Foundation (Do First, Everything Depends On This)

> **Blockers:** Nothing in Phase 2-4 works until Phase 1 is done.

### NEO — Database & Auth Foundation

| # | Bug ID | Task | File(s) | Severity |
|---|--------|------|---------|----------|
| 1 | S1 | **Replace `runStatement` with parameterized queries** — change `pool.query(sql)` to `pool.query(sql, params)` with `$1, $2` placeholders. Every API route depends on this. | `lib/platform-db.ts` | CRITICAL |
| 2 | S6 | **Add password hashing** — install bcrypt, hash passwords on insert, compare on login. Hash PINs at rest. | `lib/platform-db.ts` | CRITICAL |
| 3 | S7 | **Fix `serviceFailure()`** — remove `connectionString`, `trace`, `detail` from error responses. Return generic `{ ok: false, message: "Internal error" }` to clients. Log details server-side only. | `lib/platform-db.ts:93-112` | HIGH |
| 4 | S8 | **Remove SQL logging** — delete `console.log('[bank-sql]', sql)` or log only query templates without values. | `lib/platform-db.ts:77-78` | HIGH |
| 5 | S10 | **Remove hardcoded credentials** — delete the fallback connection string. Require `DATABASE_URL` env var. Add `.env.local` to `.gitignore`. | `lib/platform-db.ts:5`, `.gitignore` | MEDIUM |
| 6 | S5 | **Build proper session system** — signed HttpOnly Secure cookies (JWT with server secret or server-side sessions). Remove unsigned base64 token and client-set `role` cookie. | `lib/auth.ts` (new) | CRITICAL |
| 7 | F2 | **Create `middleware.ts`** — check session cookie, redirect unauthenticated users to `/login`. Root `/` should redirect to `/login` or `/dashboard`. | `middleware.ts` (new), `app/page.tsx` | HIGH |
| 8 | L5 | **Fix SERIAL sequence after seed** — add `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))` after seed insert. Same for accounts. | `lib/platform-db.ts:55-72` | MEDIUM |

**Deliverable:** A secure `lib/platform-db.ts`, a new `lib/auth.ts` with session helpers, and `middleware.ts` route protection. All other work builds on this.

---

### GIMHANI — API Routes (Can Start Items 1-3 in Parallel with Neo)

| # | Bug ID | Task | File(s) | Severity |
|---|--------|------|---------|----------|
| 1 | S2 | **Delete the GET handler** in login route — it dumps all users with plaintext passwords. | `app/api/auth/login/route.ts:4-17` | CRITICAL |
| 2 | S3 | **Lock down admin endpoint** — either delete it or gate behind verified admin session (depends on Neo's auth). Remove `process.env` from response entirely. | `app/api/admin/system/route.ts` | CRITICAL |
| 3 | S9 | **Remove `sql` field from login responses** — both success and failure responses expose the executed query. | `app/api/auth/login/route.ts:38, 56` | HIGH |

> **BLOCKED on Neo's Phase 1 (items 1, 6)** — the items below need parameterized queries and session auth:

| # | Bug ID | Task | File(s) | Severity |
|---|--------|------|---------|----------|
| 4 | S4 | **Remove `includePins` parameter** — never return PINs in any API response. Fix column selection to explicit safe list. | `app/api/accounts/route.ts` | CRITICAL |
| 5 | — | **Rewrite login POST** — use parameterized query, bcrypt compare, return signed session token from Neo's auth module. | `app/api/auth/login/route.ts` | CRITICAL |
| 6 | L1 | **Make transfer atomic** — wrap debit + credit + insert in `BEGIN/COMMIT` with `ROLLBACK` on failure. | `app/api/transfer/route.ts` | CRITICAL |
| 7 | L2 | **Add balance check** — `WHERE balance >= $amount` on debit, or check within transaction. Return error if insufficient. | `app/api/transfer/route.ts` | CRITICAL |
| 8 | L3 | **Validate transfer amount server-side** — must be a positive number > 0. Reject negative, zero, NaN, non-numeric. | `app/api/transfer/route.ts` | CRITICAL |
| 9 | L4 | **Add ownership check on transfers** — derive `userId` from session (not request body). Verify `fromAccount` belongs to that user. Remove dangerous defaults. | `app/api/transfer/route.ts` | CRITICAL |
| 10 | — | **Rewrite accounts, transactions, search routes** — parameterized queries, auth checks, safe column selection. | `app/api/accounts/route.ts`, `app/api/transactions/route.ts`, `app/api/search/route.ts` | HIGH |
| 11 | — | **Create `/api/auth/signup` endpoint** — validate inputs, hash password, insert user, create account. | `app/api/auth/signup/route.ts` (new) | HIGH |
| 12 | — | **Create `/api/auth/reset-password` endpoint** — OTP or email token flow for password reset. | `app/api/auth/reset-password/route.ts` (new) | HIGH |

**Deliverable:** All API routes secured with parameterized queries, auth checks, proper transfer logic, and new auth endpoints.

---

## Phase 2 — Frontend Wiring (After Phase 1 APIs Are Working)

> **Blocked on:** Neo's middleware + Gimhani's API endpoints

### ZENITH — Auth Pages & Dashboard

| # | Bug ID | Task | File(s) | Severity |
|---|--------|------|---------|----------|
| 1 | F1 | **Wire login page** — add `useState` for username/password, `onSubmit` handler that calls `POST /api/auth/login`, handle errors, redirect on success. | `app/(accounts)/login/page.tsx` | CRITICAL |
| 2 | F8 | **Wire sign-up page** — add state for all fields, validate password match, call `POST /api/auth/signup`, handle errors. | `app/(accounts)/sign-up/page.tsx` | HIGH |
| 3 | F8 | **Wire reset password page** — add state, call `/api/auth/reset-password`, handle OTP flow. | `app/(accounts)/reset-password/page.tsx` | HIGH |
| 4 | F5 | **Wire dashboard to real data** — fetch logged-in user's accounts and recent transactions from API. Replace all hardcoded values. | `app/dashboard/page.tsx` | HIGH |
| 5 | F6 | **Fix asset case mismatch** — rename `Dashboard-logo.png` to `dashboard-logo.png` (or update the reference). | `public/Dashboard-logo.png` | MEDIUM |

**Deliverable:** Login/signup/reset working end-to-end, dashboard showing real user data.

---

### RUWITHMA — Feature Pages

| # | Bug ID | Task | File(s) | Severity |
|---|--------|------|---------|----------|
| 1 | F1 | **Wire bank transfer to API** — `handleTransfer` must call `POST /api/transfer`, show real success/failure based on response. | `app/bank-transfer/page.tsx` | CRITICAL |
| 2 | F3 | **Fix BACK button** — change `setStep('failure')` to `setStep('form')` on line 198. | `app/bank-transfer/page.tsx:198` | HIGH |
| 3 | F4 | **Show real balance on failure** — fetch actual balance from `/api/accounts` instead of hardcoded "Rs.500". | `app/bank-transfer/page.tsx:308` | MEDIUM |
| 4 | F1 | **Wire pay bills to API** — replace `MOCK_BALANCE` with real balance from `/api/accounts`, call transfer API on payment. | `app/pay-bills/page.tsx` | HIGH |
| 5 | F7 | **Fix sensitive data in URL** — replace `handleUpdateAccount` URL params with component state or POST. | `app/bank-accounts/page.tsx:217` | MEDIUM |
| 6 | F1 | **Wire bank accounts to API** — fetch real accounts from `/api/accounts`, implement add/edit/delete with API calls. | `app/bank-accounts/page.tsx` | HIGH |
| 7 | F9 | **Wire e-statement** — add state to input, fetch transactions from `/api/transactions`, populate statement template. | `app/e-statement/page.tsx` | HIGH |
| 8 | F10 | **Implement Smart Spend page** — design and build the page (analytics, spending categories, budgets). | `app/smart-spend/page.tsx` | MEDIUM |

**Deliverable:** All feature pages calling real APIs, showing real data, with proper error handling.

---

## Phase 3 — New Features (After Core System Works)

> These are suggested enhancements to "make it your own" for the hackathon.

| # | Feature | Description | Suggested Owner | Priority |
|---|---------|-------------|-----------------|----------|
| 1 | **Transaction History with Filters** | Filterable/searchable transaction list with date range, type, and amount filters. | Ruwithma | HIGH |
| 2 | **Smart Spend Analytics** | Spending breakdown by category (pie chart), monthly trends (line chart), budget alerts. | Ruwithma | HIGH |
| 3 | **Real-time Balance Updates** | After transfer/payment, update balance across all pages without full reload. | Zenith | MEDIUM |
| 4 | **User Profile & Settings Page** | Allow users to update name, email, password. Wire the settings icon in sidebar. | Zenith | MEDIUM |
| 5 | **Admin Dashboard** | Secure admin panel — view all users, accounts, transactions, system health. Role-gated. | Gimhani | MEDIUM |
| 6 | **Transfer Confirmation PIN** | Require account PIN before executing transfers (with rate limiting on wrong attempts). | Neo + Gimhani | HIGH |
| 7 | **Email Notifications** | Send email on transfer, login from new device, password reset. | Neo | LOW |
| 8 | **Dark Mode** | Theme toggle with CSS variables. | Zenith | LOW |
| 9 | **Export E-Statement as PDF** | Generate downloadable PDF from the e-statement view. | Ruwithma | MEDIUM |
| 10 | **Rate Limiting** | Add rate limiting to login and transfer endpoints to prevent brute force. | Neo | HIGH |
| 11 | **Audit Logging** | Log all sensitive actions (login, transfer, password change) to `audit_logs` table. Currently the table exists but is never written to. | Gimhani | MEDIUM |

---

## Dependency Graph

```
Phase 1 (PARALLEL START)
├── Neo: platform-db.ts fixes (parameterized queries, hashing, error handling)
│   ├── Neo: auth system (lib/auth.ts)
│   │   └── Neo: middleware.ts (route protection)
│   │       └── Phase 2: Zenith + Ruwithma (frontend wiring)
│   │           └── Phase 3: New features
│   └── Gimhani: API route fixes (uses Neo's parameterized query helpers)
│       └── Gimhani: New API endpoints (signup, reset-password)
│           └── Phase 2: Zenith (auth page wiring)
│
├── Gimhani: Quick wins (delete GET login, remove sql from responses, lock admin)
│   [NO DEPENDENCIES — can start immediately]
│
├── Ruwithma: Quick UI fix (BACK button bug, asset rename)
│   [NO DEPENDENCIES — can start immediately]
│
└── Zenith: Login page state/form structure (prep work, no API call yet)
    [NO DEPENDENCIES — can start immediately]
```

---

## Quick Wins (Everyone Can Start Now)

These have **zero dependencies** and can be fixed in minutes:

| Task | Owner | Time |
|------|-------|------|
| Delete GET handler in `app/api/auth/login/route.ts` | Gimhani | 2 min |
| Remove `sql` field from login responses | Gimhani | 2 min |
| Remove `process.env` from admin response | Gimhani | 2 min |
| Fix BACK button: `setStep('failure')` → `setStep('form')` | Ruwithma | 1 min |
| Rename `Dashboard-logo.png` → `dashboard-logo.png` | Ruwithma | 1 min |
| Remove `console.log('[bank-sql]', sql)` | Neo | 1 min |
| Remove `databaseUrl: connectionString` from `serviceFailure()` | Neo | 1 min |
| Add `useState` + `onChange` to login form inputs (prep for API wiring) | Zenith | 10 min |

---

## All Bugs Reference

| ID | Severity | Category | Issue | Phase | Owner |
|----|----------|----------|-------|-------|-------|
| S1 | CRITICAL | Security | SQL Injection in every API route | 1 | Neo |
| S2 | CRITICAL | Security | GET /api/auth/login dumps all passwords | 1 | Gimhani |
| S3 | CRITICAL | Security | Admin endpoint leaks process.env + all data | 1 | Gimhani |
| S4 | CRITICAL | Security | PINs exposed via query parameter | 1 | Gimhani |
| S5 | CRITICAL | Security | Forgeable session tokens + unsigned cookies | 1 | Neo |
| S6 | CRITICAL | Security | Plaintext passwords and PINs | 1 | Neo |
| S7 | HIGH | Security | Error responses leak connection string + stack | 1 | Neo |
| S8 | HIGH | Security | SQL with user data logged to console | 1 | Neo |
| S9 | HIGH | Security | Login response includes executed SQL | 1 | Gimhani |
| S10 | MEDIUM | Security | Hardcoded credentials in source code | 1 | Neo |
| L1 | CRITICAL | Logical | Transfer not atomic — money can vanish | 1 | Gimhani |
| L2 | CRITICAL | Logical | No balance check — unlimited overdraft | 1 | Gimhani |
| L3 | CRITICAL | Logical | Negative amounts accepted — reverse theft | 1 | Gimhani |
| L4 | CRITICAL | Logical | No ownership check on transfers | 1 | Gimhani |
| L5 | MEDIUM | Logical | SERIAL id collision on first real signup | 1 | Neo |
| F1 | CRITICAL | Functional | Frontend never calls backend — fully disconnected | 2 | Zenith + Ruwithma |
| F2 | HIGH | Functional | No route protection — root skips login | 1 | Neo |
| F3 | HIGH | Functional | BACK button navigates to failure screen | QW | Ruwithma |
| F4 | MEDIUM | Functional | Hardcoded balance on failure screen | 2 | Ruwithma |
| F5 | HIGH | Functional | Dashboard entirely hardcoded | 2 | Zenith |
| F6 | MEDIUM | Functional | Asset case mismatch — 404 on Linux | QW | Ruwithma |
| F7 | MEDIUM | Functional | Sensitive data in URL query string | 2 | Ruwithma |
| F8 | HIGH | Functional | Sign-up and reset password non-functional | 2 | Zenith |
| F9 | HIGH | Functional | E-statement fetches nothing | 2 | Ruwithma |
| F10 | MEDIUM | Functional | Smart Spend page is blank | 3 | Ruwithma |

**Total: 10 Security, 5 Logical, 10 Functional — 25 bugs across 3 phases.**
