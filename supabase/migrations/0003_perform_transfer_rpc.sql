-- Nova Bank — perform_transfer RPC
--
-- Atomic money transfer between two accounts. Replaces the three
-- non-transactional UPDATE/UPDATE/INSERT statements that previously
-- lived in /api/transfer/route.ts (bugs L1, L2, L3, L4).
--
-- SECURITY DEFINER lets the function run with the owner's privileges,
-- bypassing RLS so it can debit/credit both accounts and insert the
-- transaction row in a single atomic operation. The function itself
-- performs ownership and balance checks before touching any data.
--
-- Returns JSONB:
--   { ok: true,  transaction_id: <int> }                         on success
--   { ok: false, message: "..." }                                on validation failure
--   { ok: false, message: "Insufficient balance", balance: <n> } on overdraft attempt

CREATE OR REPLACE FUNCTION public.perform_transfer(
  p_from_account TEXT,
  p_to_account   TEXT,
  p_amount       NUMERIC,
  p_description  TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_balance NUMERIC;
  v_user_id      UUID;
  v_tx_id        INTEGER;
BEGIN
  -- 1. Validate amount (defense in depth — the CHECK constraint on
  --    transactions.amount also enforces this, but we want a clean
  --    error message instead of a constraint violation).
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Amount must be positive');
  END IF;

  -- 2. Lock the source row and verify ownership + existence.
  SELECT user_id, balance
    INTO v_user_id, v_from_balance
  FROM public.accounts
  WHERE account_number = p_from_account
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Source account not found');
  END IF;

  IF v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not your account');
  END IF;

  -- 3. Balance check (bug L2). The CHECK (balance >= 0) constraint
  --    would also reject this, but again we want a clean message.
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Insufficient balance',
      'balance', v_from_balance
    );
  END IF;

  -- 4. Verify destination exists.
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE account_number = p_to_account
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Destination account not found');
  END IF;

  -- 5. Atomic transfer: debit, credit, insert transaction row.
  UPDATE public.accounts
    SET balance = balance - p_amount
    WHERE account_number = p_from_account;

  UPDATE public.accounts
    SET balance = balance + p_amount
    WHERE account_number = p_to_account;

  INSERT INTO public.transactions (from_account, to_account, amount, description, created_by)
    VALUES (p_from_account, p_to_account, p_amount, p_description, auth.uid())
    RETURNING id INTO v_tx_id;

  -- 6. Audit log entry.
  INSERT INTO public.audit_logs (event, user_id, payload)
    VALUES (
      'transfer',
      auth.uid(),
      jsonb_build_object(
        'tx_id', v_tx_id,
        'from',  p_from_account,
        'to',    p_to_account,
        'amount', p_amount
      )
    );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx_id);
END;
$$;

-- Revoke execute from anon/public; grant only to authenticated users.
REVOKE EXECUTE ON FUNCTION public.perform_transfer(TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.perform_transfer(TEXT, TEXT, NUMERIC, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.perform_transfer(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
