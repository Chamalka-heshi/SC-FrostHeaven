-- ==============================================================================
-- Migration: 20260914_phase8b_pg_net_transactional_email_trigger.sql
-- Description: Phase 8B - Automated pg_net Trigger for Transactional Emails
-- ==============================================================================

-- 1. Create the pg_net notification handler function
CREATE OR REPLACE FUNCTION public.handle_notification_transactional_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, pg_temp
AS $$
DECLARE
  v_secret TEXT;
  v_url TEXT := 'https://xaqczelrmlhjhfjxlwzv.supabase.co/functions/v1/send-transactional-email';
  v_headers JSONB;
  v_payload JSONB;
BEGIN
  -- 1. Only process the 7 canonical customer order milestone notification types
  IF NEW.type NOT IN (
    'quote_ready',
    'order_confirmed',
    'in_baking',
    'order_ready',
    'order_completed',
    'order_declined',
    'order_cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Ignore notifications without a linked custom order
  IF NEW.related_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Retrieve webhook authentication secret dynamically from Supabase Vault
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'scfrostheaven_transactional_email_webhook_key'
  LIMIT 1;

  -- 4. Guard against missing or empty Vault secret (never send unauthenticated requests)
  IF v_secret IS NULL OR TRIM(v_secret) = '' THEN
    RAISE WARNING '[handle_notification_transactional_email] Missing or empty Vault secret: scfrostheaven_transactional_email_webhook_key. Transactional email webhook skipped.';
    RETURN NEW;
  END IF;

  -- 5. Construct authentication headers (apikey header only)
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', v_secret
  );

  -- 6. Construct standard database webhook payload containing only metadata & IDs
  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'notifications',
    'schema', 'public',
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'related_order_id', NEW.related_order_id
    )
  );

  -- 7. Dispatch asynchronous HTTP POST via pg_net (non-blocking)
  PERFORM net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log warning without aborting parent transaction or blocking notification insert
    RAISE WARNING '[handle_notification_transactional_email] Error queueing pg_net email request: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Restrict direct execution permissions on the trigger function
REVOKE ALL ON FUNCTION public.handle_notification_transactional_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_notification_transactional_email() TO postgres, service_role;

-- 3. Add descriptive comment
COMMENT ON FUNCTION public.handle_notification_transactional_email() IS
  'Phase 8B: Asynchronously dispatches transactional email requests to the send-transactional-email Edge Function via pg_net using Vault authentication.';

-- 4. Create AFTER INSERT trigger on public.notifications
DROP TRIGGER IF EXISTS on_notification_insert_send_email ON public.notifications;
CREATE TRIGGER on_notification_insert_send_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_notification_transactional_email();

-- 5. Diagnostic / Verification helper RPC (Returns metadata and secret existence without exposing secret values)
CREATE OR REPLACE FUNCTION public.inspect_phase8b_trigger_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_catalog, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_vault_exists BOOLEAN := false;
  v_vault_non_empty BOOLEAN := false;
  v_vault_len INTEGER := 0;
  v_func_exists BOOLEAN := false;
  v_trigger_rec RECORD;
  v_order_trigger_rec RECORD;
  v_pg_net_exists BOOLEAN := false;
BEGIN
  -- Check pg_net extension
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO v_pg_net_exists;

  -- Check Vault secret without exposing value
  SELECT
    true,
    (decrypted_secret IS NOT NULL AND TRIM(decrypted_secret) != ''),
    LENGTH(decrypted_secret)
  INTO v_vault_exists, v_vault_non_empty, v_vault_len
  FROM vault.decrypted_secrets
  WHERE name = 'scfrostheaven_transactional_email_webhook_key'
  LIMIT 1;

  -- Check trigger function existence
  SELECT true INTO v_func_exists
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'handle_notification_transactional_email';

  -- Check trigger on public.notifications
  SELECT
    t.tgname,
    c.relname as table_name,
    pg_get_triggerdef(t.oid) as def
  INTO v_trigger_rec
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'notifications'
    AND t.tgname = 'on_notification_insert_send_email';

  -- Check existing notification trigger on public.custom_orders
  SELECT
    t.tgname,
    c.relname as table_name,
    pg_get_triggerdef(t.oid) as def
  INTO v_order_trigger_rec
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'custom_orders'
    AND t.tgname = 'tr_custom_orders_status_notification';

  v_result := jsonb_build_object(
    'pg_net_installed', v_pg_net_exists,
    'vault_secret_exists', COALESCE(v_vault_exists, false),
    'vault_secret_non_empty', COALESCE(v_vault_non_empty, false),
    'vault_secret_length', COALESCE(v_vault_len, 0),
    'function_exists', COALESCE(v_func_exists, false),
    'trigger_notifications', jsonb_build_object(
      'name', v_trigger_rec.tgname,
      'table', v_trigger_rec.table_name,
      'definition', v_trigger_rec.def
    ),
    'trigger_custom_orders', jsonb_build_object(
      'name', v_order_trigger_rec.tgname,
      'table', v_order_trigger_rec.table_name,
      'definition', v_order_trigger_rec.def
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inspect_phase8b_trigger_status() TO anon, authenticated, service_role;

-- 6. Diagnostic RPC to safely inspect recent pg_net HTTP response logs
CREATE OR REPLACE FUNCTION public.inspect_phase8b_pg_net_logs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, pg_temp
AS $$
DECLARE
  v_logs JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'status_code', status_code,
      'content', content,
      'timed_out', timed_out,
      'error_msg', error_msg,
      'created', created
    )
  )
  INTO v_logs
  FROM (
    SELECT id, status_code, content, timed_out, error_msg, created
    FROM net._http_response
    ORDER BY id DESC
    LIMIT 5
  ) sub;

  RETURN COALESCE(v_logs, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_array(jsonb_build_object('error', SQLERRM));
END;
$$;

GRANT EXECUTE ON FUNCTION public.inspect_phase8b_pg_net_logs() TO anon, authenticated, service_role;

-- 7. Diagnostic helper to trigger a controlled end-to-end custom order status change
CREATE OR REPLACE FUNCTION public.test_phase8b_e2e_dispatch(p_test_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
  v_notif_id UUID;
BEGIN
  -- Look for an existing profile
  SELECT id INTO v_user_id FROM public.profiles WHERE email = p_test_email LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.profiles LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No user profile found');
  END IF;

  -- 1. Create a controlled test custom order in 'submitted' status
  INSERT INTO public.custom_orders (
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    event_type,
    event_date,
    cake_details,
    status,
    quoted_price_lkr,
    deposit_amount_lkr,
    amount_paid_lkr,
    customer_message
  ) VALUES (
    v_user_id,
    'Phase 8B Controlled Test',
    p_test_email,
    '+94 77 123 4567',
    'Birthday',
    '2026-10-15',
    'Chocolate Fudge Tier Cake',
    'submitted',
    15000,
    5000,
    0,
    'Phase 8B controlled quote ready test'
  ) RETURNING id INTO v_order_id;

  -- 2. Transition status to 'quoted' to trigger tr_custom_orders_status_notification
  UPDATE public.custom_orders
  SET status = 'quoted'
  WHERE id = v_order_id;

  -- 3. Retrieve the generated notification record
  SELECT id INTO v_notif_id
  FROM public.notifications
  WHERE related_order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'notification_id', v_notif_id,
    'user_id', v_user_id,
    'test_email', p_test_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_phase8b_e2e_dispatch(TEXT) TO anon, authenticated, service_role;




