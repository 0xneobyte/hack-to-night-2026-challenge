-- Nova Bank — Demo CSE Stock Trading schema
--
-- Adds three tables to support a virtual / paper-trading sandbox:
--   * demo_balances   — per-user virtual cash balance (defaults to 1M LKR)
--   * demo_holdings   — per-user stock positions (one row per symbol)
--   * demo_trades     — audit log of every BUY / SELL order
--
-- Two RPCs (`perform_demo_buy`, `perform_demo_sell`) make trade execution
-- atomic and enforced at the database level. They check ownership,
-- balance, and share quantity before applying any write, and auto-create
-- a `profiles` row for the caller if one is missing (defence in depth
-- for users who existed before the handle_new_user trigger was added).
--
-- A `handle_new_user` trigger auto-creates a `profiles` row whenever a
-- new auth.users row is inserted, so the FK on demo_balances.user_id
-- will never fail for legitimate signups.
--
-- Apply via Supabase SQL Editor (or `supabase db push`).
-- All objects use IF NOT EXISTS / CREATE OR REPLACE so re-running is safe.

-- ===========================================================================
-- 0. handle_new_user trigger — auto-create profiles row on signup
-- ===========================================================================
-- This must come BEFORE the demo_* tables because their FKs reference
-- public.profiles. If a user signs up and no profile row is created,
-- every demo_* write will fail with a FK violation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, nic, role, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'nic',
    'customer',
    LOWER(NEW.raw_user_meta_data->>'username')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.demo_balances (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    NUMERIC(18, 2) NOT NULL DEFAULT 1000000.00
                            CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.demo_holdings (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  avg_price    NUMERIC(18, 2) NOT NULL CHECK (avg_price > 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_demo_holdings_user_id
  ON public.demo_holdings(user_id);

CREATE TABLE IF NOT EXISTS public.demo_trades (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  side        TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  price       NUMERIC(18, 2) NOT NULL CHECK (price > 0),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  total       NUMERIC(18, 2) GENERATED ALWAYS AS (price * quantity) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_trades_user_id
  ON public.demo_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_trades_created_at
  ON public.demo_trades(created_at DESC);

-- ===========================================================================
-- 2. Row Level Security
-- ===========================================================================

ALTER TABLE public.demo_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_trades   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_balances_select_own" ON public.demo_balances;
CREATE POLICY "demo_balances_select_own"
  ON public.demo_balances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "demo_holdings_select_own" ON public.demo_holdings;
CREATE POLICY "demo_holdings_select_own"
  ON public.demo_holdings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "demo_trades_select_own" ON public.demo_trades;
CREATE POLICY "demo_trades_select_own"
  ON public.demo_trades FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies from the authenticated role —
-- all writes happen through the SECURITY DEFINER RPCs below.

-- ===========================================================================
-- 3. Helper: ensure_profile(p_user_id)
--    Creates a profiles row for the user if one is missing. Used by both
--    perform_demo_buy and perform_demo_sell so they never fail with a
--    FK violation, even for users who signed up before the
--    handle_new_user trigger existed.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.ensure_profile(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  SELECT
    p_user_id,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      split_part(u.email, '@', 1)
    ),
    'customer'
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ===========================================================================
-- 4. perform_demo_buy(p_symbol, p_price, p_quantity)
--
-- Atomic virtual BUY:
--   1. Ensure a profile row exists (defence in depth).
--   2. Ensure a balance row exists (auto-seed with 1,000,000 LKR).
--   3. Verify the user has enough cash.
--   4. Deduct cash, upsert holding (weighted-average price), log trade.
--
-- Returns JSONB:
--   { ok: true,  trade_id, new_balance, quantity }
--   { ok: false, message }
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.perform_demo_buy(
  p_symbol   TEXT,
  p_price    NUMERIC,
  p_quantity INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_balance   NUMERIC;
  v_cost      NUMERIC;
  v_old_qty   INTEGER;
  v_old_avg   NUMERIC;
  v_new_qty   INTEGER;
  v_new_avg   NUMERIC;
  v_trade_id  INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not authenticated');
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Price must be positive');
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Quantity must be a positive integer');
  END IF;

  -- Ensure profile + balance rows exist for this user.
  PERFORM public.ensure_profile(v_user_id);

  INSERT INTO public.demo_balances (user_id, balance)
    VALUES (v_user_id, 1000000.00)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
    FROM public.demo_balances
    WHERE user_id = v_user_id
    FOR UPDATE;

  v_cost := p_price * p_quantity;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Insufficient virtual balance',
      'balance', v_balance,
      'cost', v_cost
    );
  END IF;

  -- Upsert holding with weighted-average price.
  SELECT quantity, avg_price INTO v_old_qty, v_old_avg
    FROM public.demo_holdings
    WHERE user_id = v_user_id AND symbol = p_symbol
    FOR UPDATE;

  IF v_old_qty IS NULL THEN
    v_new_qty := p_quantity;
    v_new_avg := p_price;
    INSERT INTO public.demo_holdings (user_id, symbol, quantity, avg_price)
      VALUES (v_user_id, p_symbol, v_new_qty, v_new_avg);
  ELSE
    v_new_qty := v_old_qty + p_quantity;
    v_new_avg := ((v_old_avg * v_old_qty) + (p_price * p_quantity)) / v_new_qty;
    UPDATE public.demo_holdings
      SET quantity = v_new_qty, avg_price = v_new_avg, updated_at = NOW()
      WHERE user_id = v_user_id AND symbol = p_symbol;
  END IF;

  -- Deduct cash.
  UPDATE public.demo_balances
    SET balance = balance - v_cost, updated_at = NOW()
    WHERE user_id = v_user_id;

  -- Log trade.
  INSERT INTO public.demo_trades (user_id, symbol, side, price, quantity)
    VALUES (v_user_id, p_symbol, 'BUY', p_price, p_quantity)
    RETURNING id INTO v_trade_id;

  RETURN jsonb_build_object(
    'ok', true,
    'trade_id', v_trade_id,
    'new_balance', v_balance - v_cost,
    'quantity', v_new_qty
  );
END;
$$;

-- ===========================================================================
-- 5. perform_demo_sell(p_symbol, p_price, p_quantity)
--
-- Atomic virtual SELL:
--   1. Ensure profile row exists (defence in depth).
--   2. Verify user owns at least p_quantity shares of p_symbol.
--   3. Credit cash, decrement holding (delete row if quantity hits 0).
--   4. Log trade.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.perform_demo_sell(
  p_symbol   TEXT,
  p_price    NUMERIC,
  p_quantity INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_old_qty   INTEGER;
  v_old_avg   NUMERIC;
  v_proceeds  NUMERIC;
  v_balance   NUMERIC;
  v_trade_id  INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not authenticated');
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Price must be positive');
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Quantity must be a positive integer');
  END IF;

  PERFORM public.ensure_profile(v_user_id);

  -- Lock the holding row.
  SELECT quantity, avg_price INTO v_old_qty, v_old_avg
    FROM public.demo_holdings
    WHERE user_id = v_user_id AND symbol = p_symbol
    FOR UPDATE;

  IF v_old_qty IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You do not own this stock');
  END IF;

  IF v_old_qty < p_quantity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Insufficient shares to sell',
      'owned', v_old_qty
    );
  END IF;

  v_proceeds := p_price * p_quantity;

  -- Ensure balance row exists, then lock + credit.
  INSERT INTO public.demo_balances (user_id, balance)
    VALUES (v_user_id, 1000000.00)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
    FROM public.demo_balances
    WHERE user_id = v_user_id
    FOR UPDATE;

  UPDATE public.demo_balances
    SET balance = balance + v_proceeds, updated_at = NOW()
    WHERE user_id = v_user_id;

  -- Decrement or delete holding.
  IF v_old_qty = p_quantity THEN
    DELETE FROM public.demo_holdings
      WHERE user_id = v_user_id AND symbol = p_symbol;
  ELSE
    UPDATE public.demo_holdings
      SET quantity = v_old_qty - p_quantity, updated_at = NOW()
      WHERE user_id = v_user_id AND symbol = p_symbol;
  END IF;

  -- Log trade.
  INSERT INTO public.demo_trades (user_id, symbol, side, price, quantity)
    VALUES (v_user_id, p_symbol, 'SELL', p_price, p_quantity)
    RETURNING id INTO v_trade_id;

  RETURN jsonb_build_object(
    'ok', true,
    'trade_id', v_trade_id,
    'new_balance', v_balance + v_proceeds,
    'remaining_quantity', v_old_qty - p_quantity
  );
END;
$$;

-- ===========================================================================
-- 6. Grants
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.ensure_profile(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(UUID) FROM anon;
-- Do not grant execute on ensure_profile to authenticated — it's an internal helper.

REVOKE EXECUTE ON FUNCTION public.perform_demo_buy(TEXT, NUMERIC, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.perform_demo_buy(TEXT, NUMERIC, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION public.perform_demo_buy(TEXT, NUMERIC, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.perform_demo_sell(TEXT, NUMERIC, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.perform_demo_sell(TEXT, NUMERIC, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION public.perform_demo_sell(TEXT, NUMERIC, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
