-- ==============================================================================
-- Migration: 20260907_phase6b_structured_payments.sql
-- Description: Phase 6B - Structured Quotation & Payment Database Implementation
-- ==============================================================================

-- 1. ADD STRUCTURED FINANCIAL & PAYMENT COLUMNS TO public.custom_orders
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS quoted_price_lkr INTEGER NULL,
  ADD COLUMN IF NOT EXISTS deposit_amount_lkr INTEGER NULL,
  ADD COLUMN IF NOT EXISTS amount_paid_lkr INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS quote_issued_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS fully_paid_at TIMESTAMPTZ NULL;

-- 2. ADD COLUMN COMMENTS FOR SCHEMA DOCUMENTATION
COMMENT ON COLUMN public.custom_orders.quoted_price_lkr IS 'Total agreed price in whole LKR (e.g., 18500 = LKR 18,500). NULL for legacy/unquoted orders.';
COMMENT ON COLUMN public.custom_orders.deposit_amount_lkr IS 'Required deposit in whole LKR. NULL or 0 if no deposit required.';
COMMENT ON COLUMN public.custom_orders.amount_paid_lkr IS 'Total verified funds received to date in whole LKR. Default 0.';
COMMENT ON COLUMN public.custom_orders.payment_status IS 'Financial state: NULL (legacy/unquoted), unpaid, deposit_paid, fully_paid.';
COMMENT ON COLUMN public.custom_orders.payment_method IS 'Payment method: bank_transfer, cash_on_pickup, card_pos, online_payment.';
COMMENT ON COLUMN public.custom_orders.payment_reference IS 'Bank transaction ID, transfer slip ref, or counter receipt number. Admin-only.';
COMMENT ON COLUMN public.custom_orders.payment_notes IS 'Internal administrative payment audit commentary. Admin-only.';
COMMENT ON COLUMN public.custom_orders.quote_issued_at IS 'Timestamp when the structured quote was formally submitted.';
COMMENT ON COLUMN public.custom_orders.deposit_paid_at IS 'Timestamp when the deposit payment was verified.';
COMMENT ON COLUMN public.custom_orders.fully_paid_at IS 'Timestamp when the final balance reached zero.';

-- 3. ADD DATABASE CHECK CONSTRAINTS
ALTER TABLE public.custom_orders
  DROP CONSTRAINT IF EXISTS chk_custom_orders_quoted_price_lkr_positive,
  DROP CONSTRAINT IF EXISTS chk_custom_orders_deposit_lkr_valid,
  DROP CONSTRAINT IF EXISTS chk_custom_orders_amount_paid_lkr_valid,
  DROP CONSTRAINT IF EXISTS chk_custom_orders_payment_status,
  DROP CONSTRAINT IF EXISTS chk_custom_orders_payment_method;

ALTER TABLE public.custom_orders
  ADD CONSTRAINT chk_custom_orders_quoted_price_lkr_positive
    CHECK (quoted_price_lkr IS NULL OR quoted_price_lkr > 0),
  ADD CONSTRAINT chk_custom_orders_deposit_lkr_valid
    CHECK (
      deposit_amount_lkr IS NULL OR (
        deposit_amount_lkr >= 0 AND
        (quoted_price_lkr IS NULL OR deposit_amount_lkr <= quoted_price_lkr)
      )
    ),
  ADD CONSTRAINT chk_custom_orders_amount_paid_lkr_valid
    CHECK (
      amount_paid_lkr >= 0 AND
      (quoted_price_lkr IS NULL OR amount_paid_lkr <= quoted_price_lkr)
    ),
  ADD CONSTRAINT chk_custom_orders_payment_status
    CHECK (
      payment_status IS NULL OR
      payment_status IN ('unpaid', 'deposit_paid', 'fully_paid')
    ),
  ADD CONSTRAINT chk_custom_orders_payment_method
    CHECK (
      payment_method IS NULL OR
      payment_method IN ('bank_transfer', 'cash_on_pickup', 'card_pos', 'online_payment')
    );

-- 4. UPDATE ROW LEVEL SECURITY (RLS) POLICIES ON public.custom_orders
-- Ensure RLS is enabled
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

-- Revoke direct customer UPDATE policy (all customer mutations must route through secure RPCs)
DROP POLICY IF EXISTS "Customers can update their own custom orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Users can update their own custom orders" ON public.custom_orders;

-- Ensure Admin SELECT policy
DROP POLICY IF EXISTS "Admins can select custom_orders" ON public.custom_orders;
CREATE POLICY "Admins can select custom_orders"
  ON public.custom_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Ensure Admin UPDATE policy
DROP POLICY IF EXISTS "Admins can update custom_orders" ON public.custom_orders;
CREATE POLICY "Admins can update custom_orders"
  ON public.custom_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Ensure Public INSERT policy (Guests and authenticated users can create requests)
DROP POLICY IF EXISTS "Anyone can insert custom orders" ON public.custom_orders;
CREATE POLICY "Anyone can insert custom orders"
  ON public.custom_orders
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 5. RECREATE SECURE CUSTOMER-FACING VIEW public.customer_custom_orders
DROP VIEW IF EXISTS public.customer_custom_orders;

CREATE VIEW public.customer_custom_orders
WITH (security_invoker = false)
AS
SELECT
  id,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  event_type,
  event_date,
  cake_details,
  status,
  customer_message,
  admin_notes,
  quoted_price_lkr,
  deposit_amount_lkr,
  amount_paid_lkr,
  payment_status,
  payment_method,
  quote_issued_at,
  deposit_paid_at,
  fully_paid_at,
  created_at,
  updated_at
FROM public.custom_orders
WHERE customer_id = auth.uid()
   OR (
     EXISTS (
       SELECT 1 FROM public.profiles
       WHERE profiles.id = auth.uid()
         AND profiles.role = 'admin'
     )
   );

REVOKE ALL ON public.customer_custom_orders FROM PUBLIC;
GRANT SELECT ON public.customer_custom_orders TO authenticated;

COMMENT ON VIEW public.customer_custom_orders IS 'Secure customer-facing view for custom orders. Excludes internal_notes, payment_reference, and payment_notes while exposing customer-safe financial and quotation fields.';

-- 6. CREATE SECURE CUSTOMER RPC #1: accept_custom_order_quote
CREATE OR REPLACE FUNCTION public.accept_custom_order_quote(target_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_user_id UUID;
BEGIN
  -- 1. Verify user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept a quote.' USING ERRCODE = '42501';
  END IF;

  -- 2. Fetch order
  SELECT * INTO v_order
  FROM public.custom_orders
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom order not found.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Verify customer ownership
  IF v_order.customer_id IS NULL OR v_order.customer_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you do not have permission to accept this order quote.' USING ERRCODE = '42501';
  END IF;

  -- 4. Verify order is in quoted status
  IF v_order.status != 'quoted' THEN
    RAISE EXCEPTION 'Order is not in quoted status (current status: %)', v_order.status USING ERRCODE = '22023';
  END IF;

  -- 5. Verify order has a valid positive quoted price (or valid quote notes)
  IF (v_order.quoted_price_lkr IS NOT NULL AND v_order.quoted_price_lkr <= 0) THEN
    RAISE EXCEPTION 'Cannot accept order with invalid quoted price.' USING ERRCODE = '22023';
  END IF;

  -- 6. Perform atomic status transition
  UPDATE public.custom_orders
  SET
    status = 'accepted',
    updated_at = now()
  WHERE id = target_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', target_order_id,
    'status', 'accepted'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_custom_order_quote(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_custom_order_quote(UUID) TO authenticated;

COMMENT ON FUNCTION public.accept_custom_order_quote(UUID) IS 'Secure RPC for authenticated customers to accept a quoted custom order.';

-- 7. CREATE SECURE CUSTOMER RPC #2: cancel_custom_order
CREATE OR REPLACE FUNCTION public.cancel_custom_order(
  target_order_id UUID,
  cancel_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_user_id UUID;
  v_trimmed_reason TEXT;
  v_customer_msg TEXT;
BEGIN
  -- 1. Verify user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to cancel an order.' USING ERRCODE = '42501';
  END IF;

  -- 2. Fetch order
  SELECT * INTO v_order
  FROM public.custom_orders
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom order not found.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Verify customer ownership
  IF v_order.customer_id IS NULL OR v_order.customer_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you do not have permission to cancel this order.' USING ERRCODE = '42501';
  END IF;

  -- 4. Enforce cancelable statuses: only submitted, under_review, quoted
  IF v_order.status NOT IN ('submitted', 'under_review', 'quoted') THEN
    RAISE EXCEPTION 'Cannot cancel an order that is already accepted, in production, completed, or cancelled (current status: %)', v_order.status USING ERRCODE = '22023';
  END IF;

  -- 5. Format safe cancellation message if reason is provided (capped at 300 chars)
  v_trimmed_reason := SUBSTRING(TRIM(COALESCE(cancel_reason, '')) FROM 1 FOR 300);
  IF v_trimmed_reason != '' THEN
    v_customer_msg := 'Order cancelled by customer. Reason: ' || v_trimmed_reason;
  ELSE
    v_customer_msg := 'Order cancelled by customer.';
  END IF;

  -- 6. Perform atomic cancellation update
  UPDATE public.custom_orders
  SET
    status = 'cancelled',
    customer_message = v_customer_msg,
    updated_at = now()
  WHERE id = target_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', target_order_id,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_custom_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_custom_order(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.cancel_custom_order(UUID, TEXT) IS 'Secure RPC for authenticated customers to cancel an unconfirmed custom order.';

-- 8. CREATE DEFENSE-IN-DEPTH BEFORE UPDATE TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.guard_custom_order_financial_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();

  -- If operation is initiated by background trigger/system without auth context, allow
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if caller is an administrator
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_user_id;

  -- Admins have full authorization
  IF v_is_admin IS TRUE THEN
    RETURN NEW;
  END IF;

  -- For non-admin callers (e.g. if invoked via direct table mutation):
  -- 1. Block any changes to financial fields, audit fields, internal notes, or customer ownership
  IF (OLD.quoted_price_lkr IS DISTINCT FROM NEW.quoted_price_lkr) OR
     (OLD.deposit_amount_lkr IS DISTINCT FROM NEW.deposit_amount_lkr) OR
     (OLD.amount_paid_lkr IS DISTINCT FROM NEW.amount_paid_lkr) OR
     (OLD.payment_status IS DISTINCT FROM NEW.payment_status) OR
     (OLD.payment_method IS DISTINCT FROM NEW.payment_method) OR
     (OLD.payment_reference IS DISTINCT FROM NEW.payment_reference) OR
     (OLD.payment_notes IS DISTINCT FROM NEW.payment_notes) OR
     (OLD.quote_issued_at IS DISTINCT FROM NEW.quote_issued_at) OR
     (OLD.deposit_paid_at IS DISTINCT FROM NEW.deposit_paid_at) OR
     (OLD.fully_paid_at IS DISTINCT FROM NEW.fully_paid_at) OR
     (OLD.internal_notes IS DISTINCT FROM NEW.internal_notes) OR
     (OLD.customer_id IS DISTINCT FROM NEW.customer_id) THEN
    RAISE EXCEPTION 'Access denied: Non-administrators cannot modify financial, administrative, or ownership fields.' USING ERRCODE = '42501';
  END IF;

  -- 2. Guard status transitions: only valid customer lifecycle transitions are permitted
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT (
      (OLD.status = 'quoted' AND NEW.status = 'accepted') OR
      (OLD.status IN ('submitted', 'under_review', 'quoted') AND NEW.status = 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Access denied: Unauthorized status transition from % to %.', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_custom_order_financial_updates ON public.custom_orders;
CREATE TRIGGER tr_guard_custom_order_financial_updates
  BEFORE UPDATE ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_custom_order_financial_updates();

COMMENT ON FUNCTION public.guard_custom_order_financial_updates() IS 'Defense-in-depth trigger preventing non-administrators from tampering with financial data or performing illegal status transitions.';
