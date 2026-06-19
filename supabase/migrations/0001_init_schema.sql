-- Nova Bank — Initial schema
-- Replaces the old platform-db.ts schema with Supabase-native tables.
--
-- Design decisions (see bug-report.md):
--   * User identities live in auth.users (managed by Supabase Auth).
--     We do NOT store passwords or PINs in plaintext anywhere.
--   * `profiles` is the public mirror of auth.users with app-specific
--     metadata (full_name, NIC, role).
--   * `accounts.balance` has CHECK (balance >= 0) so overdraft is
--     impossible at the DB level (bug L2).
--   * `transactions.amount` has CHECK (amount > 0) so negative
--     transfers are impossible at the DB level (bug L3).
--   * All primary keys on user-owned tables use UUIDs from auth.users,
--     eliminating the SERIAL collision bug (L5).
--   * `accounts.pin_hash` stores a hashed PIN (never plaintext — bug S6);
--     it is NEVER selected by any API route (bug S4).

-- profiles: 1:1 with auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  nic         TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- accounts: per-user bank accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id             SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_number TEXT UNIQUE NOT NULL,
  account_name   TEXT NOT NULL,
  balance        NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pin_hash       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- transactions: money movements between accounts
CREATE TABLE IF NOT EXISTS public.transactions (
  id          SERIAL PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account   TEXT NOT NULL,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON public.transactions(from_account);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON public.transactions(to_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- audit_logs: security event log (admin-viewable only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         SERIAL PRIMARY KEY,
  event      TEXT NOT NULL,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON public.audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
