-- Nova Bank — Row Level Security policies
--
-- RLS guarantees users can only read or modify their own data, even if
-- a backend bug tries to query without a filter. This is the single
-- most important security control after the schema constraints.
--
-- All policies use `auth.uid()` which returns the authenticated user's
-- UUID from the Supabase Auth JWT. Anonymous requests get NULL and
-- therefore match no rows.

-- ============================================================================
-- profiles
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- INSERT is handled by a trigger (see 0004_handle_new_user.sql if added)
-- or by the signup flow using the service role key server-side.
-- We do NOT allow direct user INSERTs/DELETEs on profiles from the
-- anon/authenticated keys.

-- ============================================================================
-- accounts
-- ============================================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select_own"
  ON public.accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates/deletes on accounts are server-side operations
-- (admin or service role only). The default authenticated key cannot
-- create new accounts directly — that goes through a secure endpoint.

-- ============================================================================
-- transactions
-- ============================================================================
-- Users can read transactions where they own either the source or
-- destination account. We use a subquery so the policy stays correct
-- even if account ownership changes.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (
    from_account IN (SELECT account_number FROM public.accounts WHERE user_id = auth.uid())
    OR
    to_account IN (SELECT account_number FROM public.accounts WHERE user_id = auth.uid())
  );

-- INSERTs happen only via the perform_transfer RPC (SECURITY DEFINER),
-- which bypasses RLS. Direct INSERTs from authenticated clients are
-- rejected because no INSERT policy exists.

-- ============================================================================
-- audit_logs
-- ============================================================================
-- Users cannot read audit logs directly. Only the service role key
-- (server-side, never exposed to the client) can read them, and only
-- for the admin audit log viewer (Phase 3, issue #49).
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated/anon roles:
-- the table is effectively write-only from the RPC (via SECURITY
-- DEFINER) and read-only from the service role key.
