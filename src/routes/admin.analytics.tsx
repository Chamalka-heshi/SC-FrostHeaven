import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  Cake,
  Users,
  Star,
  MessageSquare,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  PieChart as PieIcon,
  Layers,
  ChefHat,
  Loader2,
  CalendarDays,
  HeartHandshake,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exportToCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Business Analytics & Reports — SC Frost Heaven" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminAnalyticsPage,
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

interface CustomerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  role: string;
  created_at: string;
}

interface ReviewItem {
  id: string;
  customer_name: string;
  rating: number;
  occasion: string | null;
  is_approved: boolean;
  created_at: string;
}

interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  created_at: string;
}

interface InAppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  is_read: boolean;
  created_at: string;
}

const ACTIVE_STATUSES = ["submitted", "under_review", "quoted", "accepted", "in_baking", "ready"];
const TERMINAL_STATUSES = ["completed", "declined", "cancelled"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "Submitted", color: "#f59e0b", bg: "bg-amber-500/10" },
  under_review: { label: "Under Review", color: "#6366f1", bg: "bg-indigo-500/10" },
  quoted: { label: "Quoted", color: "#0ea5e9", bg: "bg-sky-500/10" },
  accepted: { label: "Accepted", color: "#3b82f6", bg: "bg-blue-500/10" },
  in_baking: { label: "In Baking", color: "#a855f7", bg: "bg-purple-500/10" },
  ready: { label: "Ready", color: "#14b8a6", bg: "bg-teal-500/10" },
  completed: { label: "Completed", color: "#10b981", bg: "bg-emerald-500/10" },
  declined: { label: "Declined", color: "#f43f5e", bg: "bg-rose-500/10" },
  cancelled: { label: "Cancelled", color: "#71717a", bg: "bg-zinc-500/10" },
};

const PIE_COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#64748b"];

function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 1. Strict Administrator Authorization Guard
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

  // 2. Concurrently fetch operational data from Supabase
  const fetchAnalyticsData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoadingData(true);
    setErrorMessage(null);

    try {
      const [ordersRes, profilesRes, reviewsRes, inquiriesRes, notificationsRes] =
        await Promise.all([
          supabase
            .from("custom_orders")
            .select(
              "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, created_at, updated_at",
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("profiles")
            .select("id, full_name, email, phone, city, role, created_at")
            .eq("role", "customer"),
          supabase
            .from("reviews")
            .select("id, customer_name, rating, occasion, is_approved, created_at"),
          supabase
            .from("contact_inquiries")
            .select("id, name, email, phone, message, status, created_at"),
          supabase.from("notifications").select("id, user_id, type, title, is_read, created_at"),
        ]);

      if (ordersRes.error) throw ordersRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (inquiriesRes.error) throw inquiriesRes.error;

      setOrders((ordersRes.data as CustomOrder[]) || []);
      setCustomers((profilesRes.data as CustomerProfile[]) || []);
      setReviews((reviewsRes.data as ReviewItem[]) || []);
      setInquiries((inquiriesRes.data as ContactInquiry[]) || []);
      setNotifications((notificationsRes.data as InAppNotification[]) || []);
      setLastUpdated(new Date());

      if (isManual) {
        toast.success("Analytics data refreshed.");
      }
    } catch (err: unknown) {
      console.error("Analytics data load error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load analytics data.");
      toast.error("Could not load analytics metrics from Supabase.");
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchAnalyticsData();
    }
  }, [profile, fetchAnalyticsData]);

  // 3. Multi-Domain KPI Calculations
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter((o) =>
      ACTIVE_STATUSES.includes(o.status.toLowerCase()),
    ).length;
    const readyOrders = orders.filter((o) => o.status.toLowerCase() === "ready").length;
    const totalRegisteredCustomers = customers.length;

    // Customer order frequency map
    const customerOrderCounts = new Map<string, number>();
    orders.forEach((o) => {
      if (o.customer_id) {
        customerOrderCounts.set(o.customer_id, (customerOrderCounts.get(o.customer_id) || 0) + 1);
      }
    });

    const customersWithOrders = customerOrderCounts.size;
    const repeatCustomersCount = Array.from(customerOrderCounts.values()).filter(
      (cnt) => cnt >= 2,
    ).length;

    // Repeat customer rate: (>= 2 orders / >= 1 order) * 100
    const repeatCustomerRate =
      customersWithOrders > 0 ? Math.round((repeatCustomersCount / customersWithOrders) * 100) : 0;

    // Approved reviews CSAT
    const approvedReviews = reviews.filter((r) => r.is_approved);
    const avgRating =
      approvedReviews.length > 0
        ? (
            approvedReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
            approvedReviews.length
          ).toFixed(1)
        : null;

    // Unread inquiries
    const unreadInquiries = inquiries.filter((i) => i.status.toLowerCase() === "unread").length;

    return {
      totalOrders,
      activeOrders,
      readyOrders,
      totalRegisteredCustomers,
      customersWithOrders,
      repeatCustomerRate,
      avgRating,
      approvedReviewsCount: approvedReviews.length,
      unreadInquiries,
      totalInquiries: inquiries.length,
      totalNotifications: notifications.length,
    };
  }, [orders, customers, reviews, inquiries, notifications]);

  // 4A. Monthly Custom Order Volume (created_at = submission date)
  const monthlyVolumeData = useMemo(() => {
    if (orders.length === 0) return [];

    const monthMap = new Map<string, { label: string; count: number; sortKey: string }>();

    orders.forEach((o) => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const sortKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      const existing = monthMap.get(sortKey);
      if (existing) {
        existing.count += 1;
      } else {
        monthMap.set(sortKey, { label, count: 1, sortKey });
      }
    });

    const sorted = Array.from(monthMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return sorted.slice(-6); // Last 6 historical months available
  }, [orders]);

  const peakMonthLabel = useMemo(() => {
    if (monthlyVolumeData.length === 0) return "N/A";
    let top = monthlyVolumeData[0];
    if (!top) return "N/A";
    for (const item of monthlyVolumeData) {
      if (item.count > top.count) {
        top = item;
      }
    }
    return top.label;
  }, [monthlyVolumeData]);

  // 4B. Event Type Distribution (Donut Chart)
  const eventTypeData = useMemo(() => {
    if (orders.length === 0) return [];

    const countMap = new Map<string, number>();
    orders.forEach((o) => {
      const type = (o.event_type || "Custom Cake").trim();
      const formatted = type.charAt(0).toUpperCase() + type.slice(1);
      countMap.set(formatted, (countMap.get(formatted) || 0) + 1);
    });

    const total = orders.length;
    return Array.from(countMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: ((value / total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // 4C. Status Funnel & Pipeline Distribution
  const statusPipelineData = useMemo(() => {
    const total = orders.length;
    const statusOrder = [
      "submitted",
      "under_review",
      "quoted",
      "accepted",
      "in_baking",
      "ready",
      "completed",
      "declined",
      "cancelled",
    ];

    return statusOrder.map((st) => {
      const config = STATUS_CONFIG[st] || { label: st, color: "#94a3b8", bg: "bg-slate-500/10" };
      const count = orders.filter((o) => o.status.toLowerCase() === st).length;
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
      const isTerminal = TERMINAL_STATUSES.includes(st);

      return {
        key: st,
        name: config.label,
        count,
        percentage: Number(percentage),
        color: config.color,
        isTerminal,
      };
    });
  }, [orders]);

  // 4D. 14-Day Kitchen Production Workload Forecast (event_date)
  const upcomingWorkloadData = useMemo(() => {
    const result: Array<{
      dateStr: string;
      label: string;
      activeOrders: number;
      isBusy: boolean;
      ordersList: CustomOrder[];
    }> = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0] || "";

      // Formatted label (e.g. "Mon 5th", "Today", "Tomorrow")
      let label = targetDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      });
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";

      // Active orders for this event date
      const activeForDate = orders.filter((o) => {
        if (!o.event_date) return false;
        const statusLower = o.status.toLowerCase();
        if (TERMINAL_STATUSES.includes(statusLower)) return false;
        return o.event_date === dateStr;
      });

      const count = activeForDate.length;
      result.push({
        dateStr,
        label,
        activeOrders: count,
        isBusy: count >= 2,
        ordersList: activeForDate,
      });
    }

    return result;
  }, [orders]);

  // 5. Export Master Analytics Summary CSV
  const handleExportAnalyticsSummary = () => {
    const todayStr = new Date().toISOString().split("T")[0] || "";
    const headers = ["Metric Category", "Metric Name", "Metric Value", "Calculation Details"];
    const rows: (string | number)[][] = [
      ["Overview", "Total Custom Orders", kpis.totalOrders, "All recorded custom cake requests"],
      [
        "Overview",
        "Active Orders",
        kpis.activeOrders,
        "Orders in progress (excluding completed, declined, cancelled)",
      ],
      ["Overview", "Orders Ready", kpis.readyOrders, "Orders ready for pickup / delivery"],
      [
        "Customers",
        "Total Registered Customers",
        kpis.totalRegisteredCustomers,
        "Customer accounts in directory",
      ],
      [
        "Customers",
        "Customers With Orders",
        kpis.customersWithOrders,
        "Customers with at least 1 custom order",
      ],
      [
        "Customers",
        "Repeat Customer Rate",
        `${kpis.repeatCustomerRate}%`,
        "(Customers with >= 2 orders / Customers with >= 1 order) * 100",
      ],
      [
        "Reputation",
        "Average Review Rating (CSAT)",
        kpis.avgRating ? `${kpis.avgRating} / 5.0` : "N/A",
        `Based on ${kpis.approvedReviewsCount} approved customer reviews`,
      ],
      [
        "Communication",
        "Unread Contact Inquiries",
        kpis.unreadInquiries,
        "Pending inquiries in inbox",
      ],
      ["Communication", "Total Inquiries", kpis.totalInquiries, "All received contact inquiries"],
      [
        "Alerts",
        "Customer Notifications Sent",
        kpis.totalNotifications,
        "Automated status alerts generated",
      ],
    ];

    exportToCsv(`frostheaven-analytics-summary-${todayStr}.csv`, headers, rows);
    toast.success("Analytics summary exported to CSV");
  };

  if (authLoading || !user || !profile || profile.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-soft border border-border/70 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-medium text-foreground sm:text-3xl">
                  Business Analytics & Intelligence
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <Sparkles className="h-3 w-3" /> Live Data
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comprehensive operational reporting, kitchen production capacity, and customer
                insights.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground">
              Last synced:{" "}
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => fetchAnalyticsData(true)}
            disabled={isRefreshing}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </Button>

          <Button
            onClick={handleExportAnalyticsSummary}
            className="rounded-full gap-2 bg-primary text-primary-foreground shadow-xs cursor-pointer hover:bg-primary/90"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Summary (CSV)</span>
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {errorMessage && (
        <div className="rounded-3xl bg-destructive/10 p-6 text-center shadow-soft border border-destructive/20 space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <div>
            <h3 className="text-sm font-medium text-destructive">
              Unable to compute analytics metrics
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalyticsData()}
            className="rounded-full border-destructive/30 text-destructive cursor-pointer"
          >
            Retry Analytics
          </Button>
        </div>
      )}

      {/* 2. Multi-Domain KPI Summary Cards (8 Cards) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Key Performance Indicators
          </h2>
          <span className="text-xs text-muted-foreground">
            Calculated across custom order pipeline & customer directory
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Custom Orders */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Custom Orders</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Cake className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-foreground">{kpis.totalOrders}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All booking submissions to date
              </p>
            </div>
          </div>

          {/* Card 2: Active Orders */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Orders</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-amber-600">{kpis.activeOrders}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                In review, quoted, accepted, or baking
              </p>
            </div>
          </div>

          {/* Card 3: Orders Ready */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Orders Ready</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-teal-600">{kpis.readyOrders}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Awaiting customer pickup / dispatch
              </p>
            </div>
          </div>

          {/* Card 4: Registered Customers */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Registered Customers
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-foreground">
                {kpis.totalRegisteredCustomers}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Active member accounts in directory
              </p>
            </div>
          </div>

          {/* Card 5: Customers with Orders */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Customers With Orders
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <HeartHandshake className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-blue-600">{kpis.customersWithOrders}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.totalRegisteredCustomers > 0
                  ? `${Math.round((kpis.customersWithOrders / kpis.totalRegisteredCustomers) * 100)}% conversion from account creation`
                  : "0% conversion"}
              </p>
            </div>
          </div>

          {/* Card 6: Repeat Customer Rate */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Repeat Customer Rate
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-purple-600">{kpis.repeatCustomerRate}%</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ordering customers placing 2+ cake requests
              </p>
            </div>
          </div>

          {/* Card 7: Average Review Rating */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Average Review Rating
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Star className="h-4 w-4 fill-amber-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-foreground">
                {kpis.avgRating ? `${kpis.avgRating} ★` : "No ratings yet"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.approvedReviewsCount > 0
                  ? `Across ${kpis.approvedReviewsCount} approved customer reviews`
                  : "Awaiting customer review submissions"}
              </p>
            </div>
          </div>

          {/* Card 8: Unread Inquiries */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Unread Inquiries</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-rose-600">{kpis.unreadInquiries}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.unreadInquiries > 0
                  ? "Requires admin team response"
                  : "All customer inquiries resolved"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recharts Section 1: Monthly Volume (created_at) & Event Type Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 3A. Monthly Custom Order Volume */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Monthly Custom Order Volume
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Custom cake bookings over time (based on order submission date `created_at`)
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              Last {monthlyVolumeData.length} Months
            </span>
          </div>

          {monthlyVolumeData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
              No historical booking records available yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyVolumeData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="orderVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                    opacity={0.6}
                  />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "1rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(value: unknown) => [`${value} orders`, "Bookings"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#orderVolumeGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Peak Month: {peakMonthLabel}</span>
            <span>Total Historical Bookings: {kpis.totalOrders}</span>
          </div>
        </div>

        {/* 3B. Event Type Distribution */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-purple-600" /> Event & Celebration Distribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown of cake orders by event theme (Birthdays, Weddings, Anniversaries, etc.)
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {eventTypeData.length} Types
            </span>
          </div>

          {eventTypeData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
              No event type data found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 h-64">
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eventTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {eventTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(
                        value: unknown,
                        _name: unknown,
                        item: { payload?: { name?: string; percentage?: string } },
                      ) => [
                        `${value} orders (${item.payload?.percentage ?? "0"}%)`,
                        item.payload?.name ?? "Event",
                      ]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "1rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Event Type Breakdown Legend */}
              <div className="space-y-2 overflow-y-auto max-h-56 pr-2">
                {eventTypeData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-foreground truncate font-medium">{item.name}</span>
                    </div>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {item.value} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Primary Celebration: {eventTypeData[0]?.name || "N/A"}</span>
            <span>Total Categories: {eventTypeData.length}</span>
          </div>
        </div>
      </div>

      {/* 4. Recharts Section 2: 14-Day Kitchen Workload Forecast & Order Status Workflow Funnel */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4A. 14-Day Kitchen Workload Forecast (event_date) */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-600" /> 14-Day Kitchen Workload Forecast
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active cakes scheduled for production by celebration deadline (`event_date`)
              </p>
            </div>
            <span className="rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
              Next 14 Days
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={upcomingWorkloadData}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                  opacity={0.6}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  stroke="#94a3b8"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(
                    value: unknown,
                    _name: unknown,
                    item: { payload?: { dateStr?: string } },
                  ) => [`${value} active orders`, `Date: ${item.payload?.dateStr ?? ""}`]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "1rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="activeOrders" radius={[6, 6, 0, 0]}>
                  {upcomingWorkloadData.map((entry, index) => (
                    <Cell
                      key={`workload-bar-${index}`}
                      fill={
                        entry.activeOrders === 0 ? "#e2e8f0" : entry.isBusy ? "#f59e0b" : "#14b8a6"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Standard Load
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> High Workload (2+ Cakes)
              </span>
            </div>
            <span>
              Upcoming 14-Day Queue:{" "}
              {upcomingWorkloadData.reduce((sum, d) => sum + d.activeOrders, 0)} Cakes
            </span>
          </div>
        </div>

        {/* 4B. Status Pipeline & Workflow Distribution */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-blue-600" /> Custom Order Pipeline Distribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current order counts across all 9 workflow lifecycle stages
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              9 Status Stages
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-64 pr-2">
            {statusPipelineData.map((st) => (
              <div key={st.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: st.color }}
                    />
                    <span className="font-medium text-foreground">{st.name}</span>
                    {st.isTerminal && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        (terminal)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{st.count} orders</span>
                    <span className="text-muted-foreground text-[11px]">({st.percentage}%)</span>
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(st.percentage, st.count > 0 ? 4 : 0)}%`,
                      backgroundColor: st.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              Fulfillment Rate:{" "}
              {kpis.totalOrders > 0
                ? Math.round(
                    ((statusPipelineData.find((s) => s.key === "completed")?.count || 0) /
                      kpis.totalOrders) *
                      100,
                  )
                : 0}
              %
            </span>
            <span>
              Active Pipeline: {kpis.activeOrders} of {kpis.totalOrders}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
