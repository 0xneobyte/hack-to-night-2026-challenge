# Nova Bank — Bug Report & Implementation Plan

> Hack to Night 2026 — System Audit & Roadmap  
> Date: 2026-06-19  
> Team: Neo, Gimhani, Zenith, Ruwithma  
> Stack: **Next.js 16 + Supabase (Auth + Postgres + RLS)**

---

## Executive Summary

The Nova Bank system has **29 bugs** across security, logic, and functionality. We're **ripping out the broken backend** and replacing it with **Supabase** — this instantly kills most security bugs (SQL injection, plaintext passwords, forgeable sessions, credential leaks) because Supabase handles auth, hashing, sessions, and parameterized queries out of the box.

**What Supabase gives us for free:**
- Auth (login, signup, reset password, email verification, JWT sessions)
- Password hashing (bcrypt, built-in)
- Row Level Security (RLS) — users can only access their own data
- Parameterized queries via the JS client — no SQL injection possible
- Secure session management via `@supabase/ssr`
- Admin dashboard for DB management (replaces the leaky admin endpoint)

---

## Team & Workstream Overview

| Member | Workstream | Focus Area |
|--------|-----------|------------|
| **Neo** | Supabase Setup & Backend | Supabase project, schema, RLS policies, API routes, middleware |
| **Gimhani** | API Routes & Transfer Logic | Rewrite all API routes with Supabase client, fix transfer bugs |
| **Zenith** | Frontend Auth & Core Pages | Login, signup, reset password, dashboard — all wired to Supabase |
| **Ruwithma** | Frontend Feature Pages | Bank transfer, pay bills, e-statement, smart spend, accounts |

---

## Original Bugs Found (29 total)

### Security Bugs (10)

| ID | Severity | Bug | Supabase Fix? |
|----|----------|-----|---------------|
| S1 | CRITICAL | SQL Injection in every API route — raw string interpolation in `runStatement()` | **AUTO-FIXED** — Supabase JS client uses parameterized queries |
| S2 | CRITICAL | `GET /api/auth/login` dumps all users with plaintext passwords | **DELETE** — remove the route entirely, Supabase Auth handles login |
| S3 | CRITICAL | `GET /api/admin/system` leaks `process.env`, all users, all accounts — no auth | **DELETE** — use Supabase Dashboard for admin, delete this route |
| S4 | CRITICAL | `?includePins=true` exposes all PINs via API | **AUTO-FIXED** — RLS + explicit column selection, PINs never returned |
| S5 | CRITICAL | Forgeable session — unsigned base64 token, client-set `role` cookie | **AUTO-FIXED** — Supabase uses signed JWTs with HttpOnly cookies via `@supabase/ssr` |
| S6 | CRITICAL | Plaintext passwords and PINs stored in database | **AUTO-FIXED** — Supabase Auth hashes passwords with bcrypt. PINs we hash manually. |
| S7 | HIGH | `serviceFailure()` leaks connection string + stack trace to client | **DELETE** — remove `lib/platform-db.ts` entirely, use Supabase client |
| S8 | HIGH | `console.log('[bank-sql]', sql)` logs sensitive data | **DELETE** — `runStatement()` removed, no raw SQL logging |
| S9 | HIGH | Login response includes executed SQL query | **DELETE** — old login route removed, Supabase Auth handles it |
| S10 | MEDIUM | Hardcoded DB credentials in source code + `.env.local` committed | **REPLACED** — use `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ANON_KEY` only |

### Logical Bugs (5)

| ID | Severity | Bug | Supabase Fix? |
|----|----------|-----|---------------|
| L1 | CRITICAL | Transfer not atomic — separate UPDATE statements, no BEGIN/COMMIT | **MANUAL FIX** — use Supabase `rpc()` to call a Postgres function with transaction |
| L2 | CRITICAL | No balance check — unlimited overdraft to negative | **MANUAL FIX** — check in the Postgres function + DB constraint |
| L3 | CRITICAL | Negative/zero amounts accepted — can reverse-steal funds | **MANUAL FIX** — server-side validation before calling transfer |
| L4 | CRITICAL | No ownership verification — anyone can transfer from any account | **AUTO-FIXED** — RLS ensures users can only debit their own accounts |
| L5 | MEDIUM | SERIAL id collision after explicit seed inserts | **AUTO-FIXED** — Supabase manages sequences, Auth manages user IDs (UUID) |

### Functional Bugs (12)

| ID | Severity | Bug |
|----|----------|-----|
| F1 | CRITICAL | Frontend never calls backend — zero `fetch()` calls across entire app |
| F2 | HIGH | No route protection — root `/` skips login, all pages accessible without auth |
| F3 | HIGH | BACK button on transfer confirmation navigates to failure screen |
| F4 | MEDIUM | Failure screen shows hardcoded "Rs.500" balance |
| F5 | HIGH | Dashboard entirely hardcoded (name, balance, transactions) |
| F6 | MEDIUM | Asset case mismatch — `dashboard-logo.png` vs `Dashboard-logo.png`, 404 on Linux |
| F7 | MEDIUM | Sensitive data (account number, email) in URL query string |
| F8 | HIGH | Sign-up and reset password pages are non-functional shells |
| F9 | HIGH | E-statement page fetches nothing, empty template |
| F10 | MEDIUM | Smart Spend page is blank |
| F11 | HIGH | Homepage links to `/accounts` but page is at `/bank-accounts` |
| F12 | MEDIUM | Orphaned `layout.tsx` and `page.tsx` at project root (dead code, broken CSS import) |

### DevOps Bugs (2)

| ID | Severity | Bug |
|----|----------|-----|
| D1 | MEDIUM | Dockerfile never copies source code — only works with volume mount |
| D2 | LOW | Dockerfile runs as root — no non-root user |

---

## Implementation Plan

### Phase 0 — Quick Wins (Everyone, RIGHT NOW, No Dependencies)

Do these in the first 10 minutes while Neo sets up Supabase:

| Task | Owner | Time |
|------|-------|------|
| Fix BACK button: `setStep('failure')` → `setStep('form')` in `app/bank-transfer/page.tsx:198` | Ruwithma | 1 min |
| Rename `public/Dashboard-logo.png` → `public/dashboard-logo.png` | Ruwithma | 1 min |
| Fix broken link: `/accounts` → `/bank-accounts` in `app/page.tsx:14` | Ruwithma | 1 min |
| Delete orphaned root `layout.tsx` and `page.tsx` (outside `/app` dir) | Zenith | 1 min |
| Delete `app/api/admin/system/route.ts` entirely (leaks everything) | Gimhani | 1 min |
| Delete GET handler in `app/api/auth/login/route.ts` (dumps passwords) | Gimhani | 1 min |
| Remove `sql` field from login POST success/failure responses | Gimhani | 2 min |

---

### Phase 1 — Supabase Foundation (Neo Leads, Gimhani Assists)

> Everything in Phase 2+ is blocked on this.

#### NEO — Supabase Project Setup

| # | Task | Details |
|---|------|---------|
| 1 | **Create Supabase project** | Create project at supabase.com, get URL + anon key + service role key |
| 2 | **Install packages** | `bun add @supabase/supabase-js @supabase/ssr` |
| 3 | **Create `lib/supabase/client.ts`** | Browser client — uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 4 | **Create `lib/supabase/server.ts`** | Server client — uses `createServerClient` from `@supabase/ssr` with cookie handling for Server Components and API routes |
| 5 | **Create `lib/supabase/middleware.ts`** | Session refresh helper for middleware |
| 6 | **Set up env vars** | Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. Remove old `DATABASE_URL` and hardcoded credentials. |
| 7 | **Create DB schema in Supabase** | Create tables via Supabase SQL editor (see schema below) |
| 8 | **Set up RLS policies** | Enable RLS on all tables, write policies (see policies below) |
| 9 | **Create `middleware.ts`** | Route protection — redirect unauthenticated users to `/login`. Refresh session on every request. Root `/` redirects to `/dashboard` (authed) or `/login` (not authed). **(Fixes F2)** |
| 10 | **Create transfer RPC function** | Postgres function `perform_transfer(...)` that wraps debit + credit + insert in a single transaction with balance check. **(Fixes L1, L2)** |
| 11 | **Delete old files** | Remove `lib/platform-db.ts`, `app/api/auth/login/route.ts`, `app/api/setup/route.ts`, `app/api/health/route.ts`, `app/api/admin/system/route.ts`. **(Fixes S2, S3, S7, S8, S9, S10)** |
| 12 | **Update Dockerfile** | Add `COPY . .` for source code, add non-root user. Update `compose.yml` to remove local Postgres (Supabase is hosted). **(Fixes D1, D2)** |

**Supabase Schema:**

```sql
-- Users are managed by Supabase Auth (auth.users table)
-- We create a public profile table linked to auth

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nic TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.accounts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  account_number TEXT UNIQUE NOT NULL,
  account_name TEXT NOT NULL,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.transactions (
  id SERIAL PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key design decisions:**
- `CHECK (balance >= 0)` on accounts — DB-level overdraft prevention **(fixes L2)**
- `CHECK (amount > 0)` on transactions — DB-level negative amount prevention **(fixes L3)**
- User IDs are UUIDs from Supabase Auth — no SERIAL collision **(fixes L5)**
- PINs stored as `pin_hash` — hashed, never returned **(fixes S4, S6)**

**RLS Policies:**

```sql
-- Profiles: users see only their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Accounts: users see only their own
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Transactions: users see transactions involving their accounts
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own transactions" ON public.transactions
  FOR SELECT USING (
    from_account IN (SELECT account_number FROM public.accounts WHERE user_id = auth.uid())
    OR to_account IN (SELECT account_number FROM public.accounts WHERE user_id = auth.uid())
  );
```

**Transfer RPC Function (fixes L1, L2, L3, L4):**

```sql
CREATE OR REPLACE FUNCTION perform_transfer(
  p_from_account TEXT,
  p_to_account TEXT,
  p_amount NUMERIC,
  p_description TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_balance NUMERIC;
  v_user_id UUID;
  v_tx_id INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Amount must be positive');
  END IF;

  -- Verify ownership: from_account must belong to the calling user
  SELECT user_id, balance INTO v_user_id, v_from_balance
  FROM public.accounts
  WHERE account_number = p_from_account
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Source account not found');
  END IF;

  IF v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not your account');
  END IF;

  -- Check balance
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Insufficient balance',
      'balance', v_from_balance);
  END IF;

  -- Verify destination exists
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE account_number = p_to_account) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Destination account not found');
  END IF;

  -- Atomic transfer
  UPDATE public.accounts SET balance = balance - p_amount WHERE account_number = p_from_account;
  UPDATE public.accounts SET balance = balance + p_amount WHERE account_number = p_to_account;

  INSERT INTO public.transactions (from_account, to_account, amount, description, created_by)
  VALUES (p_from_account, p_to_account, p_amount, p_description, auth.uid())
  RETURNING id INTO v_tx_id;

  -- Audit log
  INSERT INTO public.audit_logs (event, user_id, payload)
  VALUES ('transfer', auth.uid(), jsonb_build_object(
    'tx_id', v_tx_id, 'from', p_from_account, 'to', p_to_account, 'amount', p_amount
  ));

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx_id);
END;
$$;
```

**Deliverable:** Supabase project live, schema + RLS + transfer function deployed, middleware protecting routes, old backend deleted.

---

#### GIMHANI — Rewrite API Routes (After Neo's Supabase Client Is Ready)

| # | Bug IDs | Task | File(s) |
|---|---------|------|---------|
| 1 | L1-L4 | **Rewrite `/api/transfer`** — validate amount > 0, call `supabase.rpc('perform_transfer', {...})`, return result. No raw SQL. | `app/api/transfer/route.ts` |
| 2 | S1, S4 | **Rewrite `/api/accounts`** — use `supabase.from('accounts').select('id, account_number, account_name, balance')`. Never select `pin_hash`. RLS auto-filters by user. | `app/api/accounts/route.ts` |
| 3 | S1 | **Rewrite `/api/transactions`** — use `supabase.from('transactions').select(...)`. RLS handles access control. | `app/api/transactions/route.ts` |
| 4 | S1 | **Rewrite `/api/search`** — use Supabase `.ilike()` filters. No raw SQL. | `app/api/search/route.ts` |
| 5 | — | **Create `/api/profile`** — fetch logged-in user's profile from `profiles` table. | `app/api/profile/route.ts` (new) |
| 6 | — | **Create generic error handler** — all routes return `{ ok: false, message: "..." }` on error, never leak internals. | All routes |

**Deliverable:** All API routes rewritten with Supabase client, zero raw SQL, no data leaks.

---

### Phase 2 — Frontend Wiring (After Phase 1 Is Done)

> **Blocked on:** Neo's middleware + Gimhani's API routes

#### ZENITH — Auth Pages & Dashboard

| # | Bug ID | Task | File(s) |
|---|--------|------|---------|
| 1 | F1 | **Wire login page** — add state, call `supabase.auth.signInWithPassword()`, redirect to `/dashboard` on success. Supabase handles sessions automatically. | `app/(accounts)/login/page.tsx` |
| 2 | F8 | **Wire sign-up page** — call `supabase.auth.signUp()`, insert profile row, handle email confirmation. | `app/(accounts)/sign-up/page.tsx` |
| 3 | F8 | **Wire reset password** — call `supabase.auth.resetPasswordForEmail()`, handle the token callback page. | `app/(accounts)/reset-password/page.tsx` |
| 4 | F5 | **Wire dashboard** — fetch user profile + accounts + recent transactions from Supabase. Replace all hardcoded data. | `app/dashboard/page.tsx` |
| 5 | F6 | **Fix asset case mismatch** — rename `Dashboard-logo.png` → `dashboard-logo.png`. | `public/` |
| 6 | F12 | **Delete orphaned root files** — remove `/layout.tsx` and `/page.tsx` outside `/app`. | root dir |
| 7 | — | **Add logout** — add logout button to sidebar, call `supabase.auth.signOut()`. | `components/sidebar.tsx` |

**Deliverable:** Auth flow working end-to-end, dashboard showing real user data.

---

#### RUWITHMA — Feature Pages

| # | Bug ID | Task | File(s) |
|---|--------|------|---------|
| 1 | F1 | **Wire bank transfer** — call `POST /api/transfer` with real data, show success/failure from API response. | `app/bank-transfer/page.tsx` |
| 2 | F3 | **Fix BACK button** — `setStep('failure')` → `setStep('form')`. | `app/bank-transfer/page.tsx:198` |
| 3 | F4 | **Show real balance on failure** — fetch from `/api/accounts`, display actual balance. | `app/bank-transfer/page.tsx:308` |
| 4 | F1 | **Wire pay bills** — replace `MOCK_BALANCE` with real balance, call transfer API. | `app/pay-bills/page.tsx` |
| 5 | F7 | **Fix sensitive data in URL** — use component state instead of URL params in `handleUpdateAccount`. | `app/bank-accounts/page.tsx:217` |
| 6 | F1 | **Wire bank accounts** — fetch from `/api/accounts`, implement add/edit/delete. | `app/bank-accounts/page.tsx` |
| 7 | F9 | **Wire e-statement** — bind input, fetch from `/api/transactions`, populate template. | `app/e-statement/page.tsx` |
| 8 | F11 | **Fix broken homepage link** — `/accounts` → `/bank-accounts`. | `app/page.tsx:14` |

**Deliverable:** All feature pages calling real APIs, showing real data.

---

### Phase 3 — New Features (Make It Your Own)

> After the core system works — these differentiate your submission.

| # | Feature | Description | Owner | Priority |
|---|---------|-------------|-------|----------|
| 1 | **Smart Spend Analytics** | Spending breakdown by category (pie chart), monthly trends, budget tracking. Build on Supabase queries. **(Fixes F10)** | Ruwithma | HIGH |
| 2 | **Transaction History with Filters** | Filterable list — date range, type, amount. Use Supabase `.gte()/.lte()` range queries. | Ruwithma | HIGH |
| 3 | **Transfer PIN Confirmation** | Require hashed PIN verification before executing transfers. Rate limit wrong attempts. | Neo + Gimhani | HIGH |
| 4 | **Export E-Statement as PDF** | Generate downloadable PDF from statement view. | Ruwithma | MEDIUM |
| 5 | **User Profile & Settings** | Update name, email, password via `supabase.auth.updateUser()`. Wire sidebar settings icon. | Zenith | MEDIUM |
| 6 | **Real-time Balance Updates** | Use Supabase Realtime subscriptions to update balances live across pages. | Zenith | MEDIUM |
| 7 | **Audit Log Viewer** | Admin-only page showing audit_logs. Gate with RLS `role = 'admin'` check. | Gimhani | MEDIUM |
| 8 | **Rate Limiting** | Add rate limiting on auth + transfer endpoints via Supabase Edge Functions or middleware. | Neo | MEDIUM |
| 9 | **Dark Mode** | Theme toggle with CSS variables, persist preference in profile. | Zenith | LOW |
| 10 | **Email Notifications** | Supabase Auth Hooks or Edge Functions to send emails on transfer/login. | Neo | LOW |

---

## Dependency Graph

```
Phase 0: Quick Wins [EVERYONE — START NOW]
│
Phase 1 (PARALLEL START)
├── Neo: Supabase project + schema + RLS + middleware + transfer RPC
│   │
│   ├── Gimhani: Rewrite API routes with Supabase client
│   │   │
│   │   └── Phase 2: Zenith (auth pages) + Ruwithma (feature pages)
│   │       │
│   │       └── Phase 3: New features
│   │
│   └── [Neo frees up after Phase 1 → helps with Phase 3 features]
│
├── Gimhani: Quick wins (delete dangerous endpoints)
│   [NO DEPENDENCIES — start immediately]
│
├── Ruwithma: Quick UI fixes (BACK button, asset rename, broken link)
│   [NO DEPENDENCIES — start immediately]
│
└── Zenith: Prep auth page structure (add state/handlers, no API yet)
    [NO DEPENDENCIES — start immediately]
```

---

## Bugs Auto-Fixed by Supabase Migration

These bugs are **eliminated by switching to Supabase** — no manual fix needed:

| Bug ID | Issue | How Supabase Fixes It |
|--------|-------|----------------------|
| S1 | SQL Injection everywhere | Supabase JS client uses parameterized queries internally |
| S5 | Forgeable sessions | `@supabase/ssr` uses signed JWTs with HttpOnly cookies |
| S6 | Plaintext passwords | Supabase Auth uses bcrypt hashing |
| S7 | Error leaks connection string | `lib/platform-db.ts` deleted, no raw connection |
| S8 | SQL logged to console | `runStatement()` deleted |
| S9 | SQL in login response | Old login route deleted |
| S10 | Hardcoded credentials | Only Supabase URL + anon key needed (safe to expose) |
| S4 | PINs exposed via param | RLS + explicit column selection, `pin_hash` never in queries |
| L4 | No ownership check | RLS policies enforce `auth.uid() = user_id` |
| L5 | SERIAL id collision | Supabase Auth uses UUIDs, no sequence issues |

**10 out of 29 bugs auto-fixed = only 19 to manually address.**

---

## All Bugs Reference

| ID | Severity | Category | Issue | Phase | Owner | Status |
|----|----------|----------|-------|-------|-------|--------|
| S1 | CRITICAL | Security | SQL Injection in every route | — | — | Auto-fixed (Supabase) |
| S2 | CRITICAL | Security | GET login dumps all passwords | 0 | Gimhani | Delete route |
| S3 | CRITICAL | Security | Admin endpoint leaks everything | 0 | Gimhani | Delete route |
| S4 | CRITICAL | Security | PINs exposed via query param | — | — | Auto-fixed (RLS) |
| S5 | CRITICAL | Security | Forgeable sessions | — | — | Auto-fixed (Supabase) |
| S6 | CRITICAL | Security | Plaintext passwords/PINs | — | — | Auto-fixed (Supabase) |
| S7 | HIGH | Security | Error leaks connection string | — | — | Auto-fixed (delete file) |
| S8 | HIGH | Security | SQL logged to console | — | — | Auto-fixed (delete file) |
| S9 | HIGH | Security | Login response includes SQL | — | — | Auto-fixed (delete route) |
| S10 | MEDIUM | Security | Hardcoded credentials | — | — | Auto-fixed (new env vars) |
| L1 | CRITICAL | Logical | Transfer not atomic | 1 | Neo | RPC function |
| L2 | CRITICAL | Logical | No balance check | 1 | Neo | DB constraint + RPC |
| L3 | CRITICAL | Logical | Negative amounts accepted | 1 | Neo + Gimhani | DB constraint + validation |
| L4 | CRITICAL | Logical | No ownership check | — | — | Auto-fixed (RLS) |
| L5 | MEDIUM | Logical | SERIAL id collision | — | — | Auto-fixed (UUIDs) |
| F1 | CRITICAL | Functional | Frontend disconnected from backend | 2 | Zenith + Ruwithma | Wire to APIs |
| F2 | HIGH | Functional | No route protection | 1 | Neo | Middleware |
| F3 | HIGH | Functional | BACK button → failure screen | 0 | Ruwithma | Quick fix |
| F4 | MEDIUM | Functional | Hardcoded balance on failure | 2 | Ruwithma | Fetch real data |
| F5 | HIGH | Functional | Dashboard hardcoded | 2 | Zenith | Fetch real data |
| F6 | MEDIUM | Functional | Asset case mismatch | 0 | Ruwithma | Rename file |
| F7 | MEDIUM | Functional | Sensitive data in URL | 2 | Ruwithma | Use state |
| F8 | HIGH | Functional | Signup/reset non-functional | 2 | Zenith | Supabase Auth calls |
| F9 | HIGH | Functional | E-statement empty | 2 | Ruwithma | Fetch transactions |
| F10 | MEDIUM | Functional | Smart Spend blank | 3 | Ruwithma | Build feature |
| F11 | HIGH | Functional | Homepage link broken | 0 | Ruwithma | Fix path |
| F12 | MEDIUM | Functional | Orphaned root files | 0 | Zenith | Delete files |
| D1 | MEDIUM | DevOps | Dockerfile missing source copy | 1 | Neo | Fix Dockerfile |
| D2 | LOW | DevOps | Dockerfile runs as root | 1 | Neo | Add USER |

**29 total: 10 auto-fixed by Supabase, 7 quick wins, 12 manual fixes across Phase 1-2.**
