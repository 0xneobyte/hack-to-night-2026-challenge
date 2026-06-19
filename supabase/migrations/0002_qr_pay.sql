-- ============================================================================
-- QR Pay — Share QR payment requests + group (split-bill) payments
-- ============================================================================
-- Run this in the Supabase SQL editor (Phase 3 feature).
--
-- Adds:
--   payment_requests  — a requester generates a QR (static "personal" QR with
--                       open amount, or a "temp" QR with a fixed amount + expiry).
--   payment_splits    — when a scanner chooses "group", each invited participant
--                       owes a percentage share they settle from their own account.
--
-- All money movement reuses the existing perform_transfer(...) RPC so balance
-- checks, ownership checks, transaction + audit rows stay consistent (L1–L4).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,                       -- token encoded in the QR
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_account   TEXT NOT NULL REFERENCES public.accounts(account_number),
  amount       NUMERIC(14, 2) CHECK (amount IS NULL OR amount > 0),  -- NULL = open amount
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'OPEN'                -- OPEN | PAID | EXPIRED | CANCELLED
               CHECK (status IN ('OPEN', 'PAID', 'EXPIRED', 'CANCELLED')),
  expires_at   TIMESTAMPTZ,                                -- NULL = never expires (static QR)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_requests_requester_idx
  ON public.payment_requests (requester_id);

CREATE TABLE IF NOT EXISTS public.payment_splits (
  id             BIGSERIAL PRIMARY KEY,
  request_id     BIGINT NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  host_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- scanner who set up the split
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- who owes this share
  percentage     NUMERIC(5, 2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount         NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status         TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'PAID')),
  transaction_id BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_splits_participant_idx
  ON public.payment_splits (participant_id, status);
CREATE INDEX IF NOT EXISTS payment_splits_request_idx
  ON public.payment_splits (request_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits   ENABLE ROW LEVEL SECURITY;

-- A payer must be able to read a request by scanning its QR, so any
-- authenticated user can SELECT. Requests only expose amount + destination
-- account number, which the payer must see anyway to pay.
DROP POLICY IF EXISTS "Authenticated can read payment requests" ON public.payment_requests;
CREATE POLICY "Authenticated can read payment requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (true);

-- Only the requester may cancel/expire their own request directly.
DROP POLICY IF EXISTS "Requester can update own request" ON public.payment_requests;
CREATE POLICY "Requester can update own request"
  ON public.payment_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id);

-- Splits are visible to the host who created them and to the participant who
-- owes the share.
DROP POLICY IF EXISTS "Host or participant can read split" ON public.payment_splits;
CREATE POLICY "Host or participant can read split"
  ON public.payment_splits FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = participant_id);

-- Inserts/updates for both tables go through SECURITY DEFINER RPCs below, so
-- no INSERT/UPDATE policies are granted to clients directly.

-- ----------------------------------------------------------------------------
-- RPC: create_payment_request
--   Generates a URL-safe code, validates the destination account belongs to
--   the caller, and inserts the request. Returns the generated code.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_payment_request(
  p_to_account  TEXT,
  p_amount      NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_owner UUID;
  v_code  TEXT;
BEGIN
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Amount must be positive');
  END IF;

  -- Destination account must belong to the caller.
  SELECT user_id INTO v_owner
  FROM public.accounts
  WHERE account_number = p_to_account;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Account not found');
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not your account');
  END IF;

  -- URL-safe random code (~12 chars).
  v_code := replace(replace(encode(gen_random_bytes(9), 'base64'), '/', '_'), '+', '-');

  INSERT INTO public.payment_requests
    (code, requester_id, to_account, amount, description, expires_at)
  VALUES
    (v_code, auth.uid(), p_to_account, p_amount,
     NULLIF(btrim(coalesce(p_description, '')), ''), p_expires_at);

  RETURN jsonb_build_object('ok', true, 'code', v_code);
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: pay_payment_request  (single / full payment)
--   The scanner pays the whole request from their own account.
--   For open-amount (personal) QRs the payer supplies p_amount.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pay_payment_request(
  p_code         TEXT,
  p_from_account TEXT,
  p_amount       NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_req     public.payment_requests%ROWTYPE;
  v_amount  NUMERIC;
  v_result  JSONB;
BEGIN
  SELECT * INTO v_req FROM public.payment_requests WHERE code = p_code;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Payment request not found');
  END IF;
  IF v_req.status <> 'OPEN' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This request is no longer open');
  END IF;
  IF v_req.expires_at IS NOT NULL AND v_req.expires_at < NOW() THEN
    UPDATE public.payment_requests SET status = 'EXPIRED' WHERE id = v_req.id;
    RETURN jsonb_build_object('ok', false, 'message', 'This request has expired');
  END IF;

  v_amount := COALESCE(v_req.amount, p_amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Amount is required');
  END IF;

  -- Reuse perform_transfer: it enforces ownership of p_from_account,
  -- balance, destination existence, and writes transaction + audit rows.
  v_result := public.perform_transfer(
    p_from_account, v_req.to_account, v_amount,
    COALESCE(v_req.description, 'QR pay')
  );

  IF NOT (v_result->>'ok')::boolean THEN
    RETURN v_result;
  END IF;

  UPDATE public.payment_requests SET status = 'PAID' WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', (v_result->>'transaction_id')::bigint,
    'amount', v_amount
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: create_split  (group payment)
--   The scanner (host) splits the request across participants by percentage.
--   p_participants: jsonb array of { "username": text, "percentage": number }.
--   Percentages must sum to 100. One PENDING split row is created per
--   participant; each settles their own share via pay_split.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_split(
  p_code         TEXT,
  p_participants JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_req       public.payment_requests%ROWTYPE;
  v_total_pct NUMERIC := 0;
  v_part      JSONB;
  v_username  TEXT;
  v_pct       NUMERIC;
  v_pid       UUID;
BEGIN
  SELECT * INTO v_req FROM public.payment_requests WHERE code = p_code;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Payment request not found');
  END IF;
  IF v_req.status <> 'OPEN' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This request is no longer open');
  END IF;
  IF v_req.amount IS NULL OR v_req.amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Group pay needs a fixed amount');
  END IF;
  IF jsonb_typeof(p_participants) <> 'array' OR jsonb_array_length(p_participants) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'At least one participant is required');
  END IF;

  -- Prevent a double split on the same request.
  IF EXISTS (SELECT 1 FROM public.payment_splits WHERE request_id = v_req.id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This request is already split');
  END IF;

  FOR v_part IN SELECT * FROM jsonb_array_elements(p_participants)
  LOOP
    v_total_pct := v_total_pct + COALESCE((v_part->>'percentage')::numeric, 0);
  END LOOP;

  IF round(v_total_pct, 2) <> 100 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Percentages must add up to 100');
  END IF;

  FOR v_part IN SELECT * FROM jsonb_array_elements(p_participants)
  LOOP
    v_username := lower(btrim(v_part->>'username'));
    v_pct      := (v_part->>'percentage')::numeric;

    SELECT id INTO v_pid FROM public.profiles WHERE lower(username) = v_username;
    IF v_pid IS NULL THEN
      RETURN jsonb_build_object('ok', false,
        'message', 'User not found: ' || v_username);
    END IF;

    INSERT INTO public.payment_splits
      (request_id, host_id, participant_id, percentage, amount)
    VALUES
      (v_req.id, auth.uid(), v_pid, v_pct,
       round(v_req.amount * v_pct / 100, 2));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'request_id', v_req.id);
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: pay_split
--   A participant settles their own pending share from their own account.
--   When the last share is paid, the parent request flips to PAID.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pay_split(
  p_split_id     BIGINT,
  p_from_account TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_split   public.payment_splits%ROWTYPE;
  v_req     public.payment_requests%ROWTYPE;
  v_result  JSONB;
  v_pending INTEGER;
BEGIN
  SELECT * INTO v_split FROM public.payment_splits WHERE id = p_split_id;

  IF v_split.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Split not found');
  END IF;
  IF v_split.participant_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not your split');
  END IF;
  IF v_split.status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Share already paid');
  END IF;

  SELECT * INTO v_req FROM public.payment_requests WHERE id = v_split.request_id;

  v_result := public.perform_transfer(
    p_from_account, v_req.to_account, v_split.amount,
    COALESCE(v_req.description, 'QR split pay')
  );

  IF NOT (v_result->>'ok')::boolean THEN
    RETURN v_result;
  END IF;

  UPDATE public.payment_splits
  SET status = 'PAID', transaction_id = (v_result->>'transaction_id')::bigint
  WHERE id = v_split.id;

  SELECT count(*) INTO v_pending
  FROM public.payment_splits
  WHERE request_id = v_req.id AND status = 'PENDING';

  IF v_pending = 0 THEN
    UPDATE public.payment_requests SET status = 'PAID' WHERE id = v_req.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', (v_result->>'transaction_id')::bigint,
    'amount', v_split.amount,
    'request_settled', v_pending = 0
  );
END;
$$;

-- Allow authenticated clients to call the RPCs.
GRANT EXECUTE ON FUNCTION public.create_payment_request(TEXT, NUMERIC, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_payment_request(TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_split(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_split(BIGINT, TEXT) TO authenticated;
