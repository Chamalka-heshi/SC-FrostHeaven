-- ==============================================================================
-- Migration: 20260920000000_phase9a_auth_users_profile_trigger.sql
-- Description: Phase 9A-1 - Automated auth.users -> profiles Database Trigger & Idempotent Handler
-- ==============================================================================

-- 1. CREATE SECURE PROFILE CREATION TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  -- Extract full_name from OAuth user_metadata or fallback to email prefix
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    CASE
      WHEN NEW.email IS NOT NULL AND POSITION('@' IN NEW.email) > 1
      THEN split_part(NEW.email, '@', 1)
      ELSE NULL
    END
  );

  -- Idempotently insert into public.profiles
  -- Security enforcement: role MUST always be hardcoded to 'customer'
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    'customer',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    -- Strictly preserve existing role (never overwrite admin with customer)
    role = public.profiles.role,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log warning so auth signup transaction is not aborted if profile sync encounters an error
    RAISE WARNING '[handle_new_auth_user] Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Revoke execution from public, grant to service_role and postgres
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, service_role;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Phase 9A-1: Automatically and securely creates or reconciles a public.profiles record for newly registered Supabase Auth users (email/password, Google OAuth, Facebook OAuth). Always hardcodes initial role to customer.';

-- 2. CREATE TRIGGER ON auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
