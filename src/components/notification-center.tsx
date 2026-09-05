import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Sparkles,
  ChefHat,
  PackageCheck,
  CheckCircle2,
  Cake,
  AlertCircle,
  XCircle,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications, type InAppNotification } from "@/hooks/use-notifications";

export function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: InAppNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);

    if (notification.related_order_id) {
      navigate({
        to: "/account",
        search: { orderId: notification.related_order_id },
      });
    } else {
      navigate({ to: "/account" });
    }
  };

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "quote_ready":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 flex-shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
        );
      case "order_confirmed":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 flex-shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case "in_baking":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 flex-shrink-0">
            <ChefHat className="h-4 w-4" />
          </div>
        );
      case "order_ready":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 flex-shrink-0">
            <PackageCheck className="h-4 w-4" />
          </div>
        );
      case "order_completed":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 flex-shrink-0">
            <Cake className="h-4 w-4" />
          </div>
        );
      case "order_declined":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
        );
      case "order_cancelled":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-600 flex-shrink-0">
            <XCircle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
            <Bell className="h-4 w-4" />
          </div>
        );
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return "Just now";
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 172800) return "Yesterday";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 1. Bell Trigger Button with Unread Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary hover:text-primary transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 2. Slide-over / Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] max-w-[90vw] rounded-3xl bg-card shadow-2xl border border-border/80 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Scrollable Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <Inbox className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-medium text-foreground">All caught up!</h4>
                <p className="text-xs text-muted-foreground max-w-xs">
                  You don&apos;t have any notifications yet. Status updates for your custom cake
                  orders will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const shortId = n.related_order_id
                  ? n.related_order_id.slice(0, 8).toUpperCase()
                  : null;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-3 p-4 transition-colors cursor-pointer hover:bg-secondary/40 ${
                      !n.is_read ? "bg-primary/5 font-medium" : "opacity-90"
                    }`}
                  >
                    {renderNotificationIcon(n.type)}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="text-xs font-semibold text-foreground truncate">
                          {n.title}
                        </h5>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {n.message}
                      </p>

                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                        {shortId && (
                          <span className="font-mono font-medium text-primary">#{shortId}</span>
                        )}
                        {!n.is_read && (
                          <span className="flex items-center gap-1 font-semibold text-primary ml-auto">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 p-3 bg-muted/20 text-center">
            <Link
              to="/account"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>View custom orders in My Account</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
