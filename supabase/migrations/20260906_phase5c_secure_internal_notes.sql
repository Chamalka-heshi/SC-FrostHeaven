-- ==============================================================================
-- Migration: 20260906_phase5c_secure_internal_notes.sql
-- Description: Phase 5C - Database-level protection for internal_notes
-- ==============================================================================

-- 1. Ensure RLS is enabled on public.custom_orders
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing SELECT policies on public.custom_orders
DROP POLICY IF EXISTS "Admins can select custom_orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Customers can view their own custom orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Allow authenticated users to read their own custom orders" ON public.custom_orders;

-- 3. Restrict direct SELECT on public.custom_orders to Administrators only
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

-- 4. Preserve/ensure INSERT policy for anyone (guests & authenticated customers)
DROP POLICY IF EXISTS "Anyone can insert custom orders" ON public.custom_orders;
CREATE POLICY "Anyone can insert custom orders"
  ON public.custom_orders
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 5. Preserve/ensure UPDATE policies for Admins and Customers
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

DROP POLICY IF EXISTS "Customers can update their own custom orders" ON public.custom_orders;
CREATE POLICY "Customers can update their own custom orders"
  ON public.custom_orders
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- 6. Create customer-facing secure view without internal_notes
CREATE OR REPLACE VIEW public.customer_custom_orders
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

-- 7. Grant SELECT on customer_custom_orders exclusively to authenticated users
REVOKE ALL ON public.customer_custom_orders FROM PUBLIC;
GRANT SELECT ON public.customer_custom_orders TO authenticated;

COMMENT ON VIEW public.customer_custom_orders IS 'Secure customer-facing view for custom orders. Excludes internal_notes and enforces customer row ownership.';
