-- ==============================================================================
-- Migration: 20260922000000_phase10_guest_order_lookup_rpc.sql
-- Description: Phase 10 - Secure Public Guest Order Lookup RPC
-- ==============================================================================

DROP FUNCTION IF EXISTS public.lookup_guest_order(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.lookup_guest_order(
  p_order_id UUID,
  p_contact TEXT
)
RETURNS TABLE (
  id UUID,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  event_type TEXT,
  event_date DATE,
  cake_details TEXT,
  status TEXT,
  customer_message TEXT,
  quoted_price_lkr NUMERIC,
  deposit_amount_lkr NUMERIC,
  amount_paid_lkr NUMERIC,
  payment_status TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  target_pickup_time TIME,
  quote_issued_at TIMESTAMPTZ,
  deposit_paid_at TIMESTAMPTZ,
  fully_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_contact TEXT;
  v_numeric_contact TEXT;
BEGIN
  IF p_order_id IS NULL OR p_contact IS NULL OR TRIM(p_contact) = '' THEN
    RETURN;
  END IF;

  v_clean_contact := LOWER(TRIM(p_contact));
  v_numeric_contact := REGEXP_REPLACE(p_contact, '[^0-9]', '', 'g');

  RETURN QUERY
  SELECT
    co.id,
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
    co.payment_reference,
    co.target_pickup_time,
    co.quote_issued_at,
    co.deposit_paid_at,
    co.fully_paid_at,
    co.created_at,
    co.updated_at
  FROM public.custom_orders co
  WHERE co.id = p_order_id
    AND (
      -- 1. Direct Email Match (case-insensitive)
      LOWER(TRIM(co.customer_email)) = v_clean_contact
      OR
      -- 2. Phone Match (ignoring spaces, dashes, country code prefix)
      (
        LENGTH(v_numeric_contact) >= 7
        AND REGEXP_REPLACE(COALESCE(co.customer_phone, ''), '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_numeric_contact, 7)
      )
    )
  LIMIT 1;
END;
$$;

-- Revoke all, grant execute to anon and authenticated roles
REVOKE ALL ON FUNCTION public.lookup_guest_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(UUID, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.lookup_guest_order(UUID, TEXT) IS
  'Phase 10: Secure RPC allowing guest customers to look up their custom cake order status, milestones, payment records, and invoice receipt by presenting both Order ID and matching Contact (Email or Phone).';
