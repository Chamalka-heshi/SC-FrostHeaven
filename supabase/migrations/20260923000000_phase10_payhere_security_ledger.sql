-- ==============================================================================
-- Migration: 20260923000000_phase10_payhere_security_ledger.sql
-- Description: Phase 10 - Authoritative PayHere Payment Ledger, Idempotency & Verified Processing
-- ==============================================================================

-- 1. CREATE PAYMENT TRANSACTIONS LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'PayHere',
  gateway_reference TEXT NOT NULL, -- PayHere payment_id (e.g. "320025112521")
  order_reference TEXT NOT NULL,   -- Order reference / ID submitted to PayHere
  amount_lkr NUMERIC NOT NULL CHECK (amount_lkr > 0),
  currency TEXT NOT NULL DEFAULT 'LKR',
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'pending', 'failed', 'quarantined'
  payment_type TEXT NULL,                  -- 'deposit', 'full', 'balance'
  raw_metadata JSONB NULL,                 -- Sanitized gateway metadata (method, timestamp, status_code)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_transactions_gateway_ref UNIQUE (gateway, gateway_reference)
);

-- Index for fast order lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_ref ON public.payment_transactions(gateway, gateway_reference);

-- 2. ENABLE ROW LEVEL SECURITY ON payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view all transactions
DROP POLICY IF EXISTS "Admins can view payment_transactions" ON public.payment_transactions;
CREATE POLICY "Admins can view payment_transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Customers can view their own order transactions
DROP POLICY IF EXISTS "Customers can view own payment_transactions" ON public.payment_transactions;
CREATE POLICY "Customers can view own payment_transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_orders
      WHERE custom_orders.id = payment_transactions.order_id
        AND custom_orders.customer_id = auth.uid()
    )
  );

-- Only service_role and postgres can insert/update/delete payment_transactions
-- (No public/anon/authenticated INSERT/UPDATE policies)

-- 3. CREATE TRUSTED SERVER-SIDE PAYMENT PROCESSING FUNCTION
DROP FUNCTION IF EXISTS public.process_verified_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.process_verified_payment(
  p_order_id UUID,
  p_payment_ref TEXT,
  p_amount_lkr NUMERIC,
  p_gateway TEXT DEFAULT 'PayHere',
  p_payment_type TEXT DEFAULT 'deposit',
  p_raw_meta JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_existing_tx RECORD;
  v_order RECORD;
  v_new_amount_paid NUMERIC;
  v_new_payment_status TEXT;
  v_new_order_status TEXT;
  v_now TIMESTAMPTZ := now();
  v_ref_entry TEXT;
  v_remaining_balance NUMERIC;
BEGIN
  -- Input checks
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID is required.';
  END IF;

  IF p_payment_ref IS NULL OR TRIM(p_payment_ref) = '' THEN
    RAISE EXCEPTION 'Payment reference is required.';
  END IF;

  IF p_amount_lkr IS NULL OR p_amount_lkr <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  -- 1. IDEMPOTENCY CHECK: Check if this gateway reference has already been processed
  SELECT * INTO v_existing_tx
  FROM public.payment_transactions
  WHERE gateway = p_gateway AND gateway_reference = TRIM(p_payment_ref);

  IF FOUND THEN
    -- Return already processed idempotency response
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_processed',
      'order_id', p_order_id,
      'payment_reference', p_payment_ref,
      'amount_lkr', v_existing_tx.amount_lkr,
      'processed_at', v_existing_tx.processed_at
    );
  END IF;

  -- 2. Fetch order with row-level lock
  SELECT * INTO v_order
  FROM public.custom_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom order % not found.', p_order_id;
  END IF;

  -- 3. Verify order is in payable financial state
  IF v_order.quoted_price_lkr IS NULL OR v_order.quoted_price_lkr <= 0 THEN
    RAISE EXCEPTION 'Cannot record payment for an order that has not received a formal quotation.';
  END IF;

  IF v_order.status IN ('declined', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot record payment for a declined or cancelled order.';
  END IF;

  -- 4. Overpayment check: Ensure verified payment amount does not exceed remaining balance
  v_remaining_balance := v_order.quoted_price_lkr - COALESCE(v_order.amount_paid_lkr, 0);

  IF p_amount_lkr > v_remaining_balance THEN
    -- Overpayment detected: Quarantine transaction for admin review rather than silently altering amount
    INSERT INTO public.payment_transactions (
      order_id,
      gateway,
      gateway_reference,
      order_reference,
      amount_lkr,
      currency,
      status,
      payment_type,
      raw_metadata,
      created_at,
      processed_at
    ) VALUES (
      p_order_id,
      p_gateway,
      TRIM(p_payment_ref),
      p_order_id::TEXT,
      p_amount_lkr,
      'LKR',
      'quarantined',
      p_payment_type,
      jsonb_build_object(
        'reason', 'Amount exceeds remaining order balance',
        'remaining_balance', v_remaining_balance,
        'received_amount', p_amount_lkr,
        'meta', p_raw_meta
      ),
      v_now,
      v_now
    );

    RAISE EXCEPTION 'Verified payment amount (LKR %) exceeds authoritative remaining balance (LKR %). Transaction quarantined.', p_amount_lkr, v_remaining_balance;
  END IF;

  -- 5. Insert into payment_transactions ledger
  INSERT INTO public.payment_transactions (
    order_id,
    gateway,
    gateway_reference,
    order_reference,
    amount_lkr,
    currency,
    status,
    payment_type,
    raw_metadata,
    created_at,
    processed_at
  ) VALUES (
    p_order_id,
    p_gateway,
    TRIM(p_payment_ref),
    p_order_id::TEXT,
    p_amount_lkr,
    'LKR',
    'completed',
    p_payment_type,
    p_raw_meta,
    v_now,
    v_now
  );

  -- 6. Calculate new financial balance & payment status
  v_new_amount_paid := COALESCE(v_order.amount_paid_lkr, 0) + p_amount_lkr;

  IF v_new_amount_paid >= v_order.quoted_price_lkr THEN
    v_new_payment_status := 'fully_paid';
  ELSIF v_order.deposit_amount_lkr IS NOT NULL AND v_order.deposit_amount_lkr > 0 AND v_new_amount_paid >= v_order.deposit_amount_lkr THEN
    v_new_payment_status := 'deposit_paid';
  ELSE
    v_new_payment_status := 'unpaid';
  END IF;

  -- Lifecycle status: transition quoted -> accepted
  IF v_order.status = 'quoted' THEN
    v_new_order_status := 'accepted';
  ELSE
    v_new_order_status := v_order.status;
  END IF;

  v_ref_entry := CONCAT(p_gateway, ': ', TRIM(p_payment_ref));

  -- 7. Update custom_orders record
  UPDATE public.custom_orders
  SET
    amount_paid_lkr = v_new_amount_paid,
    payment_status = v_new_payment_status,
    payment_method = 'online_payment',
    payment_reference = CASE
      WHEN payment_reference IS NULL OR payment_reference = '' THEN v_ref_entry
      ELSE CONCAT(payment_reference, ', ', v_ref_entry)
    END,
    status = v_new_order_status,
    deposit_paid_at = CASE
      WHEN v_new_payment_status IN ('deposit_paid', 'fully_paid') AND deposit_paid_at IS NULL THEN v_now
      ELSE deposit_paid_at
    END,
    fully_paid_at = CASE
      WHEN v_new_payment_status = 'fully_paid' AND fully_paid_at IS NULL THEN v_now
      ELSE fully_paid_at
    END,
    updated_at = v_now
  WHERE id = p_order_id;

  -- 8. Trigger customer notification (if order belongs to an authenticated user)
  IF v_order.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      related_order_id,
      is_read,
      created_at
    ) VALUES (
      v_order.customer_id,
      'payment_received',
      'Payment Received',
      CONCAT('Payment of LKR ', to_char(p_amount_lkr, 'FM999,999,999'), ' received via ', p_gateway, ' (Ref: ', TRIM(p_payment_ref), '). Thank you!'),
      p_order_id,
      false,
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'order_id', p_order_id,
    'amount_paid_lkr', v_new_amount_paid,
    'payment_status', v_new_payment_status,
    'order_status', v_new_order_status,
    'payment_reference', v_ref_entry
  );
END;
$$;

-- Restrict execution to service_role and postgres only
REVOKE ALL ON FUNCTION public.process_verified_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_verified_payment(UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO postgres, service_role;

COMMENT ON FUNCTION public.process_verified_payment IS
  'Phase 10: Server-only trusted payment recording function. Enforces idempotency via payment_transactions, prevents overpayment, updates financial status, and transitions quoted orders to accepted.';

-- 4. SECURE GUEST ORDER CLAIMING HELPER
-- Replaces insecure arbitrary claiming in client RPC
CREATE OR REPLACE FUNCTION public.claim_guest_custom_order(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_user_phone TEXT;
  v_order RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to link orders.';
  END IF;

  SELECT * INTO v_order
  FROM public.custom_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- If already claimed by current user, return success
  IF v_order.customer_id = v_user_id THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already linked to your account.');
  END IF;

  -- If claimed by another user, reject
  IF v_order.customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Order is already linked to another account.';
  END IF;

  -- Fetch user profile email/phone
  SELECT email, phone INTO v_user_email, v_user_phone
  FROM public.profiles
  WHERE id = v_user_id;

  -- Fallback to auth.jwt() email
  IF v_user_email IS NULL THEN
    v_user_email := auth.jwt()->>'email';
  END IF;

  -- Verify ownership: email or phone MUST match the order record
  IF (v_user_email IS NOT NULL AND LOWER(TRIM(v_order.customer_email)) = LOWER(TRIM(v_user_email)))
     OR
     (v_user_phone IS NOT NULL AND v_order.customer_phone IS NOT NULL AND
      REGEXP_REPLACE(v_order.customer_phone, '[^0-9]', '', 'g') LIKE '%' || RIGHT(REGEXP_REPLACE(v_user_phone, '[^0-9]', '', 'g'), 7))
  THEN
    UPDATE public.custom_orders
    SET customer_id = v_user_id, updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Order linked to your account successfully.');
  ELSE
    RAISE EXCEPTION 'Contact details on the order do not match your authenticated account.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_custom_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_guest_custom_order(UUID) TO authenticated;

COMMENT ON FUNCTION public.claim_guest_custom_order IS
  'Phase 10: Securely links an unclaimed guest order to an authenticated user ONLY IF the user email or phone matches the order record.';

-- 5. DEPRECATE / LOCK DOWN LEGACY CLIENT-INVOCABLE RPC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'record_online_custom_order_payment'
  ) THEN
    REVOKE ALL ON FUNCTION public.record_online_custom_order_payment FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.record_online_custom_order_payment FROM anon, authenticated;
  END IF;
END $$;
