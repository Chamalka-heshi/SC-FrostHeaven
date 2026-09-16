-- ==============================================================================
-- Migration: 20260906_phase5c_polish_and_notes.sql
-- Description: Phase 5C - Guest order linking RPC & notes separation
-- ==============================================================================

-- 1. Add customer_message and internal_notes columns to public.custom_orders
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS customer_message TEXT NULL,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT NULL;

-- 2. Safely backfill existing admin_notes data so no historical notes are lost
UPDATE public.custom_orders
SET customer_message = admin_notes
WHERE customer_message IS NULL AND admin_notes IS NOT NULL;

UPDATE public.custom_orders
SET internal_notes = admin_notes
WHERE internal_notes IS NULL AND admin_notes IS NOT NULL;

-- Add descriptive comments to columns
COMMENT ON COLUMN public.custom_orders.customer_message IS 'Customer-facing message, quote breakdown, and updates from the bakery team. Visible to customers in /account.';
COMMENT ON COLUMN public.custom_orders.internal_notes IS 'Private administrative and kitchen notes. Restricted to bakery staff and admins.';
COMMENT ON COLUMN public.custom_orders.admin_notes IS 'Legacy notes column retained for backwards compatibility.';

-- 3. Create secure guest order linking RPC function
CREATE OR REPLACE FUNCTION public.link_guest_custom_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_linked_count INTEGER := 0;
BEGIN
  -- 1. Ensure user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to link guest orders.';
  END IF;

  -- 2. Fetch authenticated user email from auth.users
  SELECT lower(email) INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Fallback to profiles if not found in auth.users
  IF v_user_email IS NULL OR v_user_email = '' THEN
    SELECT lower(email) INTO v_user_email
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;

  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN 0;
  END IF;

  -- 3. Link unassigned orders that match the user's email
  WITH updated AS (
    UPDATE public.custom_orders
    SET
      customer_id = v_user_id,
      updated_at = now()
    WHERE customer_id IS NULL
      AND lower(customer_email) = v_user_email
    RETURNING id
  )
  SELECT count(*) INTO v_linked_count FROM updated;

  RETURN v_linked_count;
END;
$$;

-- 4. Restrict execution permissions
REVOKE EXECUTE ON FUNCTION public.link_guest_custom_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_guest_custom_orders() TO authenticated;
