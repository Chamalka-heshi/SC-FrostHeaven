import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export interface InAppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["notifications", user?.id], [user?.id]);

  // 1. Fetch latest 10 notifications for authenticated user
  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<InAppNotification[]>({
    queryKey,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, message, related_order_id, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        // Table might be initializing or empty
        console.warn("Could not load notifications:", error.message);
        return [];
      }

      return (data as InAppNotification[]) || [];
    },
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // 2. Computed unread count
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // 3. Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) return;

      // Try RPC first for atomic security, fallback to scoped update
      try {
        const { error: rpcError } = await supabase.rpc("mark_notification_as_read", {
          p_notification_id: notificationId,
        });

        if (rpcError) {
          // Fallback to direct scoped update
          const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", notificationId)
            .eq("user_id", user.id);

          if (error) throw error;
        }
      } catch {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notificationId)
          .eq("user_id", user.id);

        if (error) throw error;
      }
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<InAppNotification[]>(queryKey);

      if (previousNotifications) {
        queryClient.setQueryData<InAppNotification[]>(
          queryKey,
          previousNotifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
        );
      }

      return { previousNotifications };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      try {
        const { error: rpcError } = await supabase.rpc("mark_all_notifications_as_read");

        if (rpcError) {
          const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", user.id)
            .eq("is_read", false);

          if (error) throw error;
        }
      } catch {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (error) throw error;
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<InAppNotification[]>(queryKey);

      if (previousNotifications) {
        queryClient.setQueryData<InAppNotification[]>(
          queryKey,
          previousNotifications.map((n) => ({ ...n, is_read: true })),
        );
      }

      return { previousNotifications };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 5. Optional Realtime listener for instantaneous notification delivery
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, queryKey]);

  const markAsRead = useCallback(
    (notificationId: string) => markAsReadMutation.mutate(notificationId),
    [markAsReadMutation],
  );

  const markAllAsRead = useCallback(() => markAllAsReadMutation.mutate(), [markAllAsReadMutation]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isError,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
