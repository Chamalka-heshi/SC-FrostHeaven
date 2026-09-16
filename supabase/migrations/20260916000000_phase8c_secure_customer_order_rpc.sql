-- ==============================================================================
-- Migration: 20260916_phase8c_secure_customer_order_rpc.sql
-- Description: Phase 8C - Secure Customer Order RPC & Security Definer View Removal
-- ==============================================================================

-- 1. Drop the flagged security_definer view to resolve Supabase Advisor Critical Finding
DROP VIEW IF EXISTS public.customer_custom_orders;

-- 2. Ensure base table public.custom_orders RLS remains strictly Admin-Only for SELECT
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select custom_orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Customers and admins can select custom_orders" ON public.custom_orders;

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

-- 3. Create the hardened customer-facing RPC function
CREATE OR REPLACE FUNCTION public.get_my_custom_orders()
RETURNS TABLE (
  id UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  event_type TEXT,
  event_date DATE,
  cake_details TEXT,
  status TEXT,
  customer_message TEXT,
  quoted_price_lkr INTEGER,
  deposit_amount_lkr INTEGER,
  amount_paid_lkr INTEGER,
  payment_status TEXT,
  payment_method TEXT,
  quote_issued_at TIMESTAMPTZ,
  deposit_paid_at TIMESTAMPTZ,
  fully_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- Unauthenticated callers receive no rows
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    co.id,
    co.customer_id,
    co.customer_name,
    co.customer_email,
    co.customer_phone,
    co.event_type,
    co.event_date,
    co.cake_details,
    co.status,
    co.customer_message,
    co.quoted_price_lkr,
    co.deposit_amount_lkr,
    co.amount_paid_lkr,
    co.payment_status,
    co.payment_method,
    co.quote_issued_at,
    co.deposit_paid_at,
    co.fully_paid_at,
    co.created_at,
    co.updated_at
  FROM public.custom_orders co
  WHERE co.customer_id = v_user_id
  ORDER BY co.created_at DESC;
END;
$$;

-- 4. Set explicit execution permissions on the RPC
REVOKE ALL ON FUNCTION public.get_my_custom_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_custom_orders() TO authenticated;

COMMENT ON FUNCTION public.get_my_custom_orders() IS
  'Phase 8C: Hardened RPC for authenticated customers to retrieve their own custom orders with complete exclusion of private internal notes, admin notes, payment audit data, and kitchen scheduling metadata.';
