import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Cake,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Sparkles,
  ArrowRight,
  ChefHat,
  BadgePercent,
  XCircle,
  Inbox,
  MessageSquare,
  Star,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — SC Frost Heaven" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboardIndex,
});

interface CustomOrder {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_type: string;
  event_date: string;
  cake_details: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at?: string;
}

const ALL_STATUSES = [
  { key: "submitted", label: "Submitted", color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { key: "under_review", label: "Under Review", color: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { key: "quoted", label: "Quoted", color: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  { key: "accepted", label: "Accepted", color: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { key: "in_baking", label: "In Baking", color: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { key: "ready", label: "Ready", color: "bg-teal-500", text: "text-teal-700", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  { key: "completed", label: "Completed", color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { key: "declined", label: "Declined", color: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { key: "cancelled", label: "Cancelled", color: "bg-zinc-500", text: "text-zinc-700", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
] as const;

function AdminDashboardIndex() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 1. Admin Role Security Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: "/login" });
      } else if (profile && profile.role !== "admin") {
        toast.error("Access restricted: Administrator privileges required.");
        navigate({ to: "/account" });
      }
    }
  }, [authLoading, user, profile, navigate]);

  // 2. Fetch Custom Orders from Supabase
  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoadingData(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("custom_orders")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, created_at, updated_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      setLastUpdated(new Date());

      if (isManual) {
        toast.success("Dashboard data refreshed.");
      }
    } catch (err: any) {
      console.error("Dashboard data fetch error:", err);
      setErrorMessage(err.message || "Unable to load dashboard data.");
      toast.error("Could not load dashboard data from Supabase.");
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchDashboardData();
    }
  }, [profile, fetchDashboardData]);

  // 3. Derived Key Operational Metrics
  const metrics = useMemo(() => {
    const total = orders.length;
    const awaitingReview = orders.filter(
      (o) => o.status === "submitted" || o.status === "under_review"
    ).length;
    const inBaking = orders.filter((o) => o.status === "in_baking").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    const completed = orders.filter((o) => o.status === "completed").length;

    return { total, awaitingReview, inBaking, ready, completed };
  }, [orders]);

  // 4. Status Distribution Calculations
  const statusDistribution = useMemo(() => {
    const total = orders.length;
    return ALL_STATUSES.map((st) => {
      const count = orders.filter((o) => o.status === st.key).length;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return { ...st, count, percentage };
    });
  }, [orders]);

  // 5. Orders Needing Attention (Actionable Orders)
  const attentionOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveDaysOut = new Date(today);
    fiveDaysOut.setDate(today.getDate() + 5);

    const items: Array<{
      order: CustomOrder;
      reason: string;
      urgency: "high" | "medium" | "info";
    }> = [];

    orders.forEach((order) => {
      if (order.status === "submitted") {
        items.push({
          order,
          reason: "New submission — requires initial review",
          urgency: "high",
        });
      } else if (order.status === "under_review") {
        items.push({
          order,
          reason: "Under review — evaluate design & send quote",
          urgency: "medium",
        });
      } else if (order.status === "quoted") {
        items.push({
          order,
          reason: "Quoted — awaiting customer confirmation",
          urgency: "info",
        });
      } else if (order.status === "accepted") {
        if (order.event_date) {
          const eventDate = new Date(order.event_date);
          if (eventDate >= today && eventDate <= fiveDaysOut) {
            items.push({
              order,
              reason: "Accepted — event in next 5 days, prepare baking schedule",
              urgency: "high",
            });
          }
        }
      }
    });

    return items.slice(0, 6);
  }, [orders]);

  // 6. Upcoming Cake Events (Future event dates)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders
      .filter((o) => {
        if (!o.event_date) return false;
        if (["completed", "declined", "cancelled"].includes(o.status)) return false;
        const eventDate = new Date(o.event_date);
        return eventDate >= today;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 6);
  }, [orders]);

  // 7. Recent Orders (Latest 6 orders)
  const recentOrders = useMemo(() => {
    return orders.slice(0, 6);
  }, [orders]);

  // Helper: Status badge renderer
  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Submitted
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-500/20">
            <Clock className="h-3 w-3" />
            Under Review
          </span>
        );
      case "quoted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-500/20">
            <BadgePercent className="h-3 w-3" />
            Quoted
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case "in_baking":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-500/20">
            <ChefHat className="h-3 w-3" />
            In Baking
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-500/20">
            Ready
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Declined
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-semibold text-zinc-700 border border-zinc-500/20">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border">
            {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        );
    }
  };

  // Helper: Date formatters
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Date not specified";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const getRelativeDateLabel = (dateStr: string) => {
    if (!dateStr) return { label: "Date not specified", isUrgent: false };
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);

      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return { label: "Today", isUrgent: true };
      if (diffDays === 1) return { label: "Tomorrow", isUrgent: true };
      if (diffDays > 1 && diffDays <= 3) return { label: `In ${diffDays} days`, isUrgent: true };
      if (diffDays > 3 && diffDays <= 7) return { label: `In ${diffDays} days`, isUrgent: false };

      return {
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(target),
        isUrgent: false,
      };
    } catch {
      return { label: dateStr, isUrgent: false };
    }
  };

  if (authLoading || !user || !profile || profile.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const adminName = profile.full_name || user.email?.split("@")[0] || "Administrator";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-soft border border-border/70 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blush text-primary shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground sm:text-3xl">Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overview of SC FrostHeaven custom cake orders and upcoming events.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {errorMessage && (
        <div className="rounded-3xl bg-destructive/10 p-6 text-center shadow-soft border border-destructive/20 space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <div>
            <h3 className="text-sm font-medium text-destructive">Unable to load dashboard data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData()}
            className="rounded-full border-destructive/30 text-destructive cursor-pointer"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* 2. Key Operational Metrics (5 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Total Orders */}
        <div className="flex flex-col justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Orders</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
              <Cake className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-foreground">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.total}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">All-time custom requests</p>
          </div>
        </div>

        {/* Card 2: Awaiting Review */}
        <div className="flex flex-col justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Awaiting Review</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-amber-700">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.awaitingReview}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Submitted / Under Review</p>
          </div>
        </div>

        {/* Card 3: In Baking */}
        <div className="flex flex-col justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">In Baking</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-purple-700">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.inBaking}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Kitchen production</p>
          </div>
        </div>

        {/* Card 4: Ready */}
        <div className="flex flex-col justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Ready</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-teal-700">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.ready}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pickup / Delivery ready</p>
          </div>
        </div>

        {/* Card 5: Completed */}
        <div className="flex flex-col justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-emerald-700">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.completed}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Fulfilled orders</p>
          </div>
        </div>
      </div>

      {/* 3. Order Status Distribution (All 9 Verified Statuses) */}
      <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-foreground">Order Status Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live breakdown of all custom cake requests across the 9 workflow stages
            </p>
          </div>
          <Link
            to="/admin/orders"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Manage All Orders</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Distribution Multi-segment Progress Bar */}
        {orders.length > 0 ? (
          <div className="space-y-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {statusDistribution.map((st) => {
                if (st.count === 0) return null;
                return (
                  <div
                    key={st.key}
                    style={{ width: `${st.percentage}%` }}
                    className={`${st.color} transition-all duration-500`}
                    title={`${st.label}: ${st.count} (${st.percentage.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-3 w-full rounded-full bg-muted" />
        )}

        {/* 9 Status Grid Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-9 pt-1">
          {statusDistribution.map((st) => (
            <div
              key={st.key}
              className={`rounded-2xl p-3 border ${st.bg} ${st.border} flex flex-col justify-between`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${st.color}`} />
                <span className="text-[11px] font-medium text-foreground truncate">{st.label}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-base font-bold ${st.text}`}>{st.count}</span>
                <span className="text-[10px] text-muted-foreground">
                  {orders.length > 0 ? `${st.percentage.toFixed(0)}%` : "0%"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Two-Column Operational Split: Attention Items & Upcoming Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Orders Needing Attention */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-medium text-foreground">Orders Needing Attention</h2>
                <p className="text-[11px] text-muted-foreground">Actionable requests requiring admin follow-up</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
              {attentionOrders.length}
            </span>
          </div>

          {loadingData ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : attentionOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground space-y-1">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600 mb-1" />
              <p className="font-medium text-foreground">No orders currently require attention.</p>
              <p className="text-[11px]">All submissions have been reviewed and scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attentionOrders.map(({ order, reason, urgency }) => (
                <div
                  key={order.id}
                  className="group flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3.5 hover:bg-secondary/40 transition-colors"
                >
                  <div className="space-y-1 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{order.customer_name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{order.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{order.event_type}</span>
                      <span>•</span>
                      <span>{formatDate(order.event_date)}</span>
                    </div>
                    <p className={`text-[11px] font-medium ${urgency === "high" ? "text-amber-700" : "text-primary"}`}>
                      {reason}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {renderStatusBadge(order.status)}
                    <Link
                      to="/admin/orders"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <span>View Order</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Upcoming Cake Celebration Events */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-medium text-foreground">Upcoming Cake Events</h2>
                <p className="text-[11px] text-muted-foreground">Scheduled delivery and celebration dates</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
              {upcomingEvents.length}
            </span>
          </div>

          {loadingData ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground space-y-1">
              <Calendar className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
              <p className="font-medium text-foreground">No upcoming cake events.</p>
              <p className="text-[11px]">Future celebration dates will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((order) => {
                const relative = getRelativeDateLabel(order.event_date);
                return (
                  <div
                    key={order.id}
                    className="group flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3.5 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{order.customer_name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            relative.isUrgent
                              ? "bg-amber-500/15 text-amber-700 border border-amber-500/30 animate-pulse"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {relative.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{order.event_type}</span>
                        <span>•</span>
                        <span>{formatDate(order.event_date)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {renderStatusBadge(order.status)}
                      <Link
                        to="/admin/orders"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <span>View Order</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent Custom Orders (Latest 6 orders) */}
      <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-foreground">Recent Custom Orders</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The latest custom cake requests submitted by customers
            </p>
          </div>
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>View All ({orders.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loadingData ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
            No custom orders yet. Customer requests will appear here once submitted.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Event Date</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">{order.customer_name}</span>
                        <span className="block text-[11px] text-muted-foreground truncate max-w-[150px]">
                          {order.customer_email}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{order.event_type}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(order.event_date)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="py-3 px-4">{renderStatusBadge(order.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to="/admin/orders"
                          className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-3 py-1 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <span>View</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked View */}
            <div className="grid gap-3 md:hidden">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      #{order.id.slice(0, 8)}
                    </span>
                    {renderStatusBadge(order.status)}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-foreground">{order.customer_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {order.event_type} • Event Date: {formatDate(order.event_date)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(order.created_at)}
                    </span>
                    <Link
                      to="/admin/orders"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                    >
                      <span>View Order</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 6. Quick Actions Section */}
      <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">Quick Management Actions</h2>
          <span className="text-xs text-muted-foreground">SC FrostHeaven Admin Suite</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/orders"
            className="group flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 hover:border-primary/40 hover:bg-secondary/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush text-primary">
                <Cake className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Custom Orders
                </h3>
                <p className="text-[11px] text-muted-foreground">View & update status</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/admin/inquiries"
            className="group flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 hover:border-primary/40 hover:bg-secondary/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Inquiries
                </h3>
                <p className="text-[11px] text-muted-foreground">Contact submissions</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/admin/customers"
            className="group flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 hover:border-primary/40 hover:bg-secondary/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Customers
                </h3>
                <p className="text-[11px] text-muted-foreground">Accounts directory</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/admin/reviews"
            className="group flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 hover:border-primary/40 hover:bg-secondary/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Reviews
                </h3>
                <p className="text-[11px] text-muted-foreground">Moderate feedback</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
