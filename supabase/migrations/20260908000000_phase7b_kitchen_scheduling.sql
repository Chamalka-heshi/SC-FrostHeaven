-- ==============================================================================
-- Migration: 20260908_phase7b_kitchen_scheduling.sql
-- Description: Phase 7B - Kitchen Scheduling, Capacity & Staff Assignment DB Foundation
-- ==============================================================================

-- 1. ADD SCHEDULING, CAPACITY & STAFF ASSIGNMENT COLUMNS TO public.custom_orders
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS scheduled_bake_date DATE NULL,
  ADD COLUMN IF NOT EXISTS scheduled_decorate_date DATE NULL,
  ADD COLUMN IF NOT EXISTS target_pickup_time TIME NULL,
  ADD COLUMN IF NOT EXISTS production_priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS complexity_units NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS assigned_baker_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_decorator_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS production_completed_at TIMESTAMPTZ NULL;

-- 2. ADD COLUMN COMMENTS FOR SCHEMA DOCUMENTATION
COMMENT ON COLUMN public.custom_orders.scheduled_bake_date IS 'Target calendar date for sponge baking / preparation. Admin-only.';
COMMENT ON COLUMN public.custom_orders.scheduled_decorate_date IS 'Target calendar date for icing, fondant modeling, and decorating. Admin-only.';
COMMENT ON COLUMN public.custom_orders.target_pickup_time IS 'Target daily pickup or dispatch time window (e.g. 10:00:00). Admin-only.';
COMMENT ON COLUMN public.custom_orders.production_priority IS 'Production priority tier: normal (default), high, urgent. Admin-only.';
COMMENT ON COLUMN public.custom_orders.complexity_units IS 'Workload / capacity units (0.5 to 10.0, default 1.0) representing labor intensity. Admin-only.';
COMMENT ON COLUMN public.custom_orders.assigned_baker_id IS 'Profile UUID of the primary baker assigned to prep / sponge baking. Admin-only.';
COMMENT ON COLUMN public.custom_orders.assigned_decorator_id IS 'Profile UUID of the lead cake artist / decorator. Admin-only.';
COMMENT ON COLUMN public.custom_orders.production_started_at IS 'Timestamp when order entered in_baking status.';
COMMENT ON COLUMN public.custom_orders.production_completed_at IS 'Timestamp when order entered ready status.';

-- 3. ADD DATABASE CHECK CONSTRAINTS ON public.custom_orders
ALTER TABLE public.custom_orders
  DROP CONSTRAINT IF EXISTS chk_custom_orders_production_priority,
  DROP CONSTRAINT IF EXISTS chk_custom_orders_complexity_units,
  DROP CONSTRAINT IF EXISTS chk_custom_orders_scheduled_dates;

ALTER TABLE public.custom_orders
  ADD CONSTRAINT chk_custom_orders_production_priority
    CHECK (production_priority IN ('normal', 'high', 'urgent')),
  ADD CONSTRAINT chk_custom_orders_complexity_units
    CHECK (complexity_units >= 0.5 AND complexity_units <= 10.0),
  ADD CONSTRAINT chk_custom_orders_scheduled_dates
    CHECK (
      scheduled_decorate_date IS NULL OR
      scheduled_bake_date IS NULL OR
      scheduled_decorate_date >= scheduled_bake_date
    );

-- 4. ADD PERFORMANCE INDEXES FOR SCHEDULING & STAFF LOOKUPS
CREATE INDEX IF NOT EXISTS idx_custom_orders_scheduled_bake_date ON public.custom_orders (scheduled_bake_date);
CREATE INDEX IF NOT EXISTS idx_custom_orders_scheduled_decorate_date ON public.custom_orders (scheduled_decorate_date);
CREATE INDEX IF NOT EXISTS idx_custom_orders_event_date ON public.custom_orders (event_date);
CREATE INDEX IF NOT EXISTS idx_custom_orders_assigned_baker ON public.custom_orders (assigned_baker_id);
CREATE INDEX IF NOT EXISTS idx_custom_orders_assigned_decorator ON public.custom_orders (assigned_decorator_id);
CREATE INDEX IF NOT EXISTS idx_custom_orders_production_priority ON public.custom_orders (production_priority);

-- 5. CREATE CAPACITY SETTINGS TABLE: public.kitchen_capacity_settings
CREATE TABLE IF NOT EXISTS public.kitchen_capacity_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  max_capacity_units NUMERIC(4,1) NOT NULL DEFAULT 8.0 CHECK (max_capacity_units > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure explicit unique constraint on day_of_week (defensive against pre-existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'kitchen_capacity_settings'
      AND c.contype = 'u'
  ) THEN
    ALTER TABLE public.kitchen_capacity_settings
      ADD CONSTRAINT uq_kitchen_capacity_settings_day_of_week UNIQUE (day_of_week);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.kitchen_capacity_settings IS 'Daily kitchen capacity configuration per weekday (0=Sunday ... 6=Saturday).';
COMMENT ON COLUMN public.kitchen_capacity_settings.day_of_week IS 'Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.';
COMMENT ON COLUMN public.kitchen_capacity_settings.max_capacity_units IS 'Maximum total cake complexity units bakery can produce on this weekday. Default 8.0.';

-- 6. SEED DEFAULT CAPACITY CONFIGURATION ROWS (0=Sunday through 6=Saturday)
INSERT INTO public.kitchen_capacity_settings (day_of_week, max_capacity_units)
SELECT v.day_of_week, v.max_capacity_units
FROM (VALUES
  (0, 8.0), -- Sunday
  (1, 8.0), -- Monday
  (2, 8.0), -- Tuesday
  (3, 8.0), -- Wednesday
  (4, 8.0), -- Thursday
  (5, 8.0), -- Friday
  (6, 8.0)  -- Saturday
) AS v(day_of_week, max_capacity_units)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kitchen_capacity_settings s WHERE s.day_of_week = v.day_of_week
);

-- 7. CREATE BLACKOUT DATES TABLE: public.bakery_blackout_dates
CREATE TABLE IF NOT EXISTS public.bakery_blackout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blackout_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure explicit unique constraint on blackout_date (defensive against pre-existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'bakery_blackout_dates'
      AND c.contype = 'u'
  ) THEN
    ALTER TABLE public.bakery_blackout_dates
      ADD CONSTRAINT uq_bakery_blackout_dates_blackout_date UNIQUE (blackout_date);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.bakery_blackout_dates IS 'Bakery blackout and closure dates when custom order production is unavailable.';
COMMENT ON COLUMN public.bakery_blackout_dates.blackout_date IS 'Calendar date of bakery closure / blackout.';
COMMENT ON COLUMN public.bakery_blackout_dates.reason IS 'Administrative explanation for closure (e.g. Public Holiday, Maintenance, Fully Booked).';

-- 8. ROW LEVEL SECURITY (RLS) FOR CAPACITY & BLACKOUT TABLES
ALTER TABLE public.kitchen_capacity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bakery_blackout_dates ENABLE ROW LEVEL SECURITY;

-- 8A. Capacity Settings Policies (Admin Only)
DROP POLICY IF EXISTS "Admins can select kitchen_capacity_settings" ON public.kitchen_capacity_settings;
CREATE POLICY "Admins can select kitchen_capacity_settings"
  ON public.kitchen_capacity_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert kitchen_capacity_settings" ON public.kitchen_capacity_settings;
CREATE POLICY "Admins can insert kitchen_capacity_settings"
  ON public.kitchen_capacity_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update kitchen_capacity_settings" ON public.kitchen_capacity_settings;
CREATE POLICY "Admins can update kitchen_capacity_settings"
  ON public.kitchen_capacity_settings
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

DROP POLICY IF EXISTS "Admins can delete kitchen_capacity_settings" ON public.kitchen_capacity_settings;
CREATE POLICY "Admins can delete kitchen_capacity_settings"
  ON public.kitchen_capacity_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 8B. Blackout Dates Policies (Admin Only)
DROP POLICY IF EXISTS "Admins can select bakery_blackout_dates" ON public.bakery_blackout_dates;
CREATE POLICY "Admins can select bakery_blackout_dates"
  ON public.bakery_blackout_dates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert bakery_blackout_dates" ON public.bakery_blackout_dates;
CREATE POLICY "Admins can insert bakery_blackout_dates"
  ON public.bakery_blackout_dates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update bakery_blackout_dates" ON public.bakery_blackout_dates;
CREATE POLICY "Admins can update bakery_blackout_dates"
  ON public.bakery_blackout_dates
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

DROP POLICY IF EXISTS "Admins can delete bakery_blackout_dates" ON public.bakery_blackout_dates;
CREATE POLICY "Admins can delete bakery_blackout_dates"
  ON public.bakery_blackout_dates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Revoke direct table permissions from anon/public
REVOKE ALL ON public.kitchen_capacity_settings FROM anon, public;
REVOKE ALL ON public.bakery_blackout_dates FROM anon, public;

-- 9. RECREATE SECURE CUSTOMER-FACING VIEW public.customer_custom_orders
-- Explicitly exclude internal_notes, payment_reference, payment_notes, and all internal scheduling/staff fields
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

COMMENT ON VIEW public.customer_custom_orders IS 'Secure customer-facing view for custom orders. Excludes internal_notes, payment_reference, payment_notes, and all internal kitchen scheduling/staff assignment fields while exposing customer-safe financial and order status fields.';

-- 10. EXTEND DEFENSE-IN-DEPTH TRIGGER FUNCTION FOR SCHEDULING & PRODUCTION TIMESTAMPS
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

  -- If operation is initiated by background trigger/system without auth context:
  IF v_user_id IS NULL THEN
    -- Track production start timestamp if status transitions to in_baking
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'in_baking') AND (NEW.production_started_at IS NULL) THEN
      NEW.production_started_at := now();
    END IF;

    -- Track production completed timestamp if status transitions to ready
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'ready') AND (NEW.production_completed_at IS NULL) THEN
      NEW.production_completed_at := now();
    END IF;

    RETURN NEW;
  END IF;

  -- Check if caller is an administrator
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_user_id;

  -- Administrators have full authorization
  IF v_is_admin IS TRUE THEN
    -- Track production start timestamp if status transitions to in_baking
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'in_baking') AND (NEW.production_started_at IS NULL) THEN
      NEW.production_started_at := now();
    END IF;

    -- Track production completed timestamp if status transitions to ready
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'ready') AND (NEW.production_completed_at IS NULL) THEN
      NEW.production_completed_at := now();
    END IF;

    RETURN NEW;
  END IF;

  -- For non-admin callers (e.g. if invoked via direct table mutation or customer RPC):
  -- 1. Block any changes to financial fields, audit fields, internal notes, customer ownership, OR scheduling/staff fields
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
     (OLD.customer_id IS DISTINCT FROM NEW.customer_id) OR
     (OLD.scheduled_bake_date IS DISTINCT FROM NEW.scheduled_bake_date) OR
     (OLD.scheduled_decorate_date IS DISTINCT FROM NEW.scheduled_decorate_date) OR
     (OLD.target_pickup_time IS DISTINCT FROM NEW.target_pickup_time) OR
     (OLD.production_priority IS DISTINCT FROM NEW.production_priority) OR
     (OLD.complexity_units IS DISTINCT FROM NEW.complexity_units) OR
     (OLD.assigned_baker_id IS DISTINCT FROM NEW.assigned_baker_id) OR
     (OLD.assigned_decorator_id IS DISTINCT FROM NEW.assigned_decorator_id) OR
     (OLD.production_started_at IS DISTINCT FROM NEW.production_started_at) OR
     (OLD.production_completed_at IS DISTINCT FROM NEW.production_completed_at) THEN
    RAISE EXCEPTION 'Access denied: Non-administrators cannot modify financial, administrative, scheduling, staff assignment, or ownership fields.' USING ERRCODE = '42501';
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

COMMENT ON FUNCTION public.guard_custom_order_financial_updates() IS 'Defense-in-depth trigger preventing non-administrators from tampering with financial data, scheduling metadata, staff assignments, or performing illegal status transitions.';
