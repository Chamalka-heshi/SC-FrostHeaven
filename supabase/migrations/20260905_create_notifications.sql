-- ==============================================================================
-- Migration: 20260905_create_notifications.sql
-- Description: In-App Customer Notifications & Automated Status Triggers
-- ==============================================================================

-- 1. Create public.notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_order_id UUID NULL REFERENCES public.custom_orders(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create index for fast user unread queries and descending order sorting
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Security Policies
-- SELECT Policy
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE Policy (Mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE Policy
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT Policy (Admin manual insertion; automatic trigger uses SECURITY DEFINER)
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Status-Change Notification Trigger Function
CREATE OR REPLACE FUNCTION public.handle_custom_order_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_notify BOOLEAN := true;
BEGIN
  -- Only trigger if status actually changed and customer_id exists
  IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.customer_id IS NOT NULL) THEN
    CASE NEW.status
      WHEN 'quoted' THEN
        v_type := 'quote_ready';
        v_title := 'Quote Ready';
        v_message := 'Your custom cake quote is ready to review. Open your order to view the latest update and confirm your request.';
      WHEN 'accepted' THEN
        v_type := 'order_confirmed';
        v_title := 'Order Confirmed';
        v_message := 'Your custom cake order has been confirmed and scheduled for production.';
      WHEN 'in_baking' THEN
        v_type := 'in_baking';
        v_title := 'Baking Started';
        v_message := 'Our pastry team has started preparing your custom cake.';
      WHEN 'ready' THEN
        v_type := 'order_ready';
        v_title := 'Your Cake Is Ready';
        v_message := 'Your cake is ready for pickup or delivery.';
      WHEN 'completed' THEN
        v_type := 'order_completed';
        v_title := 'Order Completed';
        v_message := 'Your custom cake order has been completed. Thank you for celebrating with SC FrostHeaven!';
      WHEN 'declined' THEN
        v_type := 'order_declined';
        v_title := 'Order Update';
        v_message := 'There''s an important update regarding your custom cake request. Open your order for more information.';
      WHEN 'cancelled' THEN
        v_type := 'order_cancelled';
        v_title := 'Request Cancelled';
        v_message := 'Your custom cake request has been cancelled.';
      ELSE
        -- submitted, under_review do not generate customer notifications
        v_notify := false;
    END CASE;

    IF v_notify THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        related_order_id,
        is_read,
        created_at
      ) VALUES (
        NEW.customer_id,
        v_type,
        v_title,
        v_message,
        NEW.id,
        false,
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Trigger on public.custom_orders
DROP TRIGGER IF EXISTS tr_custom_orders_status_notification ON public.custom_orders;
CREATE TRIGGER tr_custom_orders_status_notification
  AFTER UPDATE OF status ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_custom_order_status_notification();

-- 7. Helper RPC functions for atomic mark-as-read
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$;
