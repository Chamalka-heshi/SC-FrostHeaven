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
  Banknote,
  Receipt,
  DollarSign,
  BadgePercent,
  AlertTriangle,
  Flame,
  Printer,
  ShieldCheck,
  PackageCheck,
  Timer,
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
import { exportToCsv, getLocalDateString } from "@/lib/csv-export";
import { formatLKR, getProductionReadiness, getPaymentBadgeInfo } from "@/lib/order-readiness";
import {
  calculateDailyCapacity,
  type KitchenCapacitySetting,
  type BakeryBlackoutDate,
} from "@/lib/capacity-utils";
import {
  getStaffDisplayName,
  getStaffWorkloadSummary,
  type StaffProfileInput,
} from "@/lib/staff-workload-utils";
import {
  calculateAverageProductionDuration,
  calculateProductionCompletionRate,
  calculateKitchenOperationsKPIs,
  calculate14DayWorkloadCapacityForecast,
  generateCapacityReportCsvRows,
  generateStaffWorkloadReportCsvRows,
  type DailyWorkloadForecastItem,
} from "@/lib/analytics-utils";
import { DailyManagementSummaryModal } from "@/components/daily-management-summary-modal";

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
  customer_message?: string | null | undefined;
  internal_notes?: string | null | undefined;
  admin_notes?: string | null | undefined;
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | undefined;
  payment_status?: string | null | undefined;
  payment_method?: string | null | undefined;
  payment_reference?: string | null | undefined;
  payment_notes?: string | null | undefined;
  quote_issued_at?: string | null | undefined;
  deposit_paid_at?: string | null | undefined;
  fully_paid_at?: string | null | undefined;
  scheduled_bake_date?: string | null | undefined;
  scheduled_decorate_date?: string | null | undefined;
  target_pickup_time?: string | null | undefined;
  production_priority?: string | null | undefined;
  complexity_units?: number | null | undefined;
  assigned_baker_id?: string | null | undefined;
  assigned_decorator_id?: string | null | undefined;
  production_started_at?: string | null | undefined;
  production_completed_at?: string | null | undefined;
  created_at: string;
  updated_at?: string | undefined;
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
  const [staff, setStaff] = useState<StaffProfileInput[]>([]);
  const [capacitySettings, setCapacitySettings] = useState<KitchenCapacitySetting[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BakeryBlackoutDate[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showDailyManagementModal, setShowDailyManagementModal] = useState(false);

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
      const [
        ordersRes,
        customersRes,
        staffRes,
        capacityRes,
        blackoutRes,
        reviewsRes,
        inquiriesRes,
        notificationsRes,
      ] = await Promise.all([
        supabase
          .from("custom_orders")
          .select(
            "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, quoted_price_lkr, deposit_amount_lkr, amount_paid_lkr, payment_status, payment_method, quote_issued_at, deposit_paid_at, fully_paid_at, scheduled_bake_date, scheduled_decorate_date, target_pickup_time, production_priority, complexity_units, assigned_baker_id, assigned_decorator_id, production_started_at, production_completed_at, created_at, updated_at",
          )
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, city, role, created_at")
          .eq("role", "customer"),
        supabase.from("profiles").select("id, full_name, email, role").eq("role", "admin"),
        supabase
          .from("kitchen_capacity_settings")
          .select("id, day_of_week, max_capacity_units")
          .order("day_of_week", { ascending: true }),
        supabase
          .from("bakery_blackout_dates")
          .select("id, blackout_date, reason")
          .order("blackout_date", { ascending: true }),
        supabase
          .from("reviews")
          .select("id, customer_name, rating, occasion, is_approved, created_at"),
        supabase
          .from("contact_inquiries")
          .select("id, name, email, phone, message, status, created_at"),
        supabase.from("notifications").select("id, user_id, type, title, is_read, created_at"),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (customersRes.error) throw customersRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (inquiriesRes.error) throw inquiriesRes.error;

      setOrders((ordersRes.data as CustomOrder[]) || []);
      setCustomers((customersRes.data as CustomerProfile[]) || []);
      setStaff((staffRes.data as StaffProfileInput[]) || []);
      setCapacitySettings((capacityRes.data as KitchenCapacitySetting[]) || []);
      setBlackoutDates((blackoutRes.data as BakeryBlackoutDate[]) || []);
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

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  // 3. Multi-Domain Financial & General KPIs
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter((o) =>
      ACTIVE_STATUSES.includes(o.status.toLowerCase()),
    ).length;
    const readyOrders = orders.filter((o) => o.status.toLowerCase() === "ready").length;
    const totalRegisteredCustomers = customers.length;

    // Financial aggregation
    let totalQuotedLkr = 0;
    let totalCollectedLkr = 0;
    let totalOutstandingLkr = 0;
    let quotedCount = 0;
    let acceptedCount = 0;
    let depositPaidCount = 0;
    let fullyPaidCount = 0;
    let unpaidCount = 0;

    orders.forEach((o) => {
      const quoted = Number(o.quoted_price_lkr || 0);
      const paid = Number(o.amount_paid_lkr || 0);
      const statusLower = o.status.toLowerCase();
      const payStatus = (o.payment_status || "unpaid").toLowerCase();

      totalCollectedLkr += paid;
      if (quoted > 0) {
        totalQuotedLkr += quoted;
        quotedCount++;
      }

      if (!TERMINAL_STATUSES.includes(statusLower)) {
        if (quoted > paid) {
          totalOutstandingLkr += quoted - paid;
        }
      }

      if (statusLower === "accepted") acceptedCount++;
      if (payStatus === "fully_paid") fullyPaidCount++;
      else if (payStatus === "deposit_paid") depositPaidCount++;
      else unpaidCount++;
    });

    // Deposit clearance rate among orders requiring payment
    const activePayableOrders = orders.filter((o) =>
      ["accepted", "in_baking", "ready", "completed"].includes(o.status.toLowerCase()),
    ).length;
    const depositClearanceRate =
      activePayableOrders > 0
        ? Math.round(((depositPaidCount + fullyPaidCount) / activePayableOrders) * 100)
        : 0;

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
      totalQuotedLkr,
      totalCollectedLkr,
      totalOutstandingLkr,
      quotedCount,
      acceptedCount,
      depositPaidCount,
      fullyPaidCount,
      unpaidCount,
      depositClearanceRate,
    };
  }, [orders, customers, reviews, inquiries, notifications]);

  // 4. Kitchen Operations & Throughput KPIs (Phase 7G Enhancement)
  const kitchenKPIs = useMemo(() => {
    return calculateKitchenOperationsKPIs(orders, todayStr, blackoutDates);
  }, [orders, todayStr, blackoutDates]);

  // 5. 14-Day Kitchen Workload vs Capacity Horizon Forecast
  const forecast14Days: DailyWorkloadForecastItem[] = useMemo(() => {
    return calculate14DayWorkloadCapacityForecast(
      orders,
      capacitySettings,
      blackoutDates,
      todayStr,
    );
  }, [orders, capacitySettings, blackoutDates, todayStr]);

  // 6. Staff Workload Summary (Today)
  const staffSummary = useMemo(() => {
    return getStaffWorkloadSummary(todayStr, staff, orders);
  }, [todayStr, staff, orders]);

  // 7. Monthly Custom Order Volume (created_at)
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
    return sorted.slice(-6); // Last 6 historical months
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

  // 8. Event Type Distribution
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

  // 9. Status Funnel & Pipeline Distribution
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

  // 10. Payment Status Distribution
  const paymentStatusData = useMemo(() => {
    const total = orders.length;
    const counts = { fully_paid: 0, deposit_paid: 0, unpaid: 0 };

    orders.forEach((o) => {
      const ps = (o.payment_status || "unpaid").toLowerCase();
      if (ps === "fully_paid") counts.fully_paid++;
      else if (ps === "deposit_paid") counts.deposit_paid++;
      else counts.unpaid++;
    });

    return [
      {
        name: "Fully Paid",
        key: "fully_paid",
        count: counts.fully_paid,
        percentage: total > 0 ? ((counts.fully_paid / total) * 100).toFixed(1) : "0.0",
        color: "#10b981",
      },
      {
        name: "Deposit Paid",
        key: "deposit_paid",
        count: counts.deposit_paid,
        percentage: total > 0 ? ((counts.deposit_paid / total) * 100).toFixed(1) : "0.0",
        color: "#3b82f6",
      },
      {
        name: "Unpaid / Pending",
        key: "unpaid",
        count: counts.unpaid,
        percentage: total > 0 ? ((counts.unpaid / total) * 100).toFixed(1) : "0.0",
        color: "#f59e0b",
      },
    ];
  }, [orders]);

  // 11. Production Readiness Distribution Pipeline
  const readinessPipelineData = useMemo(() => {
    const map: Record<string, { label: string; count: number; color: string }> = {
      awaiting_quote: { label: "Awaiting Quote", count: 0, color: "#f59e0b" },
      quoted: { label: "Quoted (Awaiting Confirmation)", count: 0, color: "#0ea5e9" },
      awaiting_deposit: { label: "Awaiting Deposit", count: 0, color: "#d97706" },
      ready_for_production: { label: "Ready for Production", count: 0, color: "#10b981" },
      in_baking: { label: "In Production / Baking", count: 0, color: "#a855f7" },
      ready: { label: "Ready for Pickup", count: 0, color: "#14b8a6" },
      completed: { label: "Completed", count: 0, color: "#059669" },
    };

    orders.forEach((o) => {
      const r = getProductionReadiness(o);
      const entry = map[r.key];
      if (entry) {
        entry.count++;
      }
    });

    const total = orders.length;
    return Object.entries(map).map(([key, item]) => ({
      key,
      name: item.label,
      count: item.count,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0",
      color: item.color,
    }));
  }, [orders]);

  // ============================================================================
  // CSV EXPORTS (RFC-4180 with local date filenames)
  // ============================================================================

  // CSV 1: Master Analytics Summary CSV
  const handleExportAnalyticsSummary = () => {
    const headers = ["Metric Category", "Metric Name", "Metric Value", "Calculation Details"];
    const rows: (string | number)[][] = [
      [
        "Financials",
        "Total Funds Collected (Custom Orders)",
        formatLKR(kpis.totalCollectedLkr),
        "Verified customer payments recorded",
      ],
      [
        "Financials",
        "Total Quoted Pipeline",
        formatLKR(kpis.totalQuotedLkr),
        "Cumulative quoted custom order value",
      ],
      [
        "Financials",
        "Active Outstanding Balance",
        formatLKR(kpis.totalOutstandingLkr),
        "Uncollected balance across active custom orders",
      ],
      [
        "Financials",
        "Deposit Clearance Rate",
        `${kpis.depositClearanceRate}%`,
        "(Deposit/Fully Paid orders / Active payable orders) * 100",
      ],
      ["Financials", "Fully Paid Orders", kpis.fullyPaidCount, "Orders with full amount received"],
      ["Financials", "Deposit Paid Orders", kpis.depositPaidCount, "Orders with deposit cleared"],
      ["Financials", "Unpaid Orders", kpis.unpaidCount, "Orders without recorded payment"],
      ["Overview", "Total Custom Orders", kpis.totalOrders, "All recorded custom cake requests"],
      [
        "Overview",
        "Active Orders",
        kpis.activeOrders,
        "Orders in progress (excluding completed, declined, cancelled)",
      ],
      [
        "Overview",
        "Orders Ready for Pickup",
        kpis.readyOrders,
        "Finished cakes awaiting customer collection",
      ],
      [
        "Kitchen Operations",
        "Average Production Duration",
        kitchenKPIs.averageDuration.formattedAvgDuration,
        `Calculated across ${kitchenKPIs.averageDuration.validOrdersCount} completed orders with valid start & completion timestamps`,
      ],
      [
        "Kitchen Operations",
        "Orders with Valid Production Duration",
        kitchenKPIs.averageDuration.validOrdersCount,
        "Orders with both production_started_at and production_completed_at",
      ],
      [
        "Kitchen Operations",
        "Production Completion Rate",
        kitchenKPIs.completionRate.formattedRate,
        "Completed orders / Eligible production workflow orders (accepted, in_baking, ready, completed)",
      ],
      [
        "Kitchen Operations",
        "Overdue Orders (Total)",
        kitchenKPIs.overdueOrdersCount,
        "Active orders past event date",
      ],
      [
        "Kitchen Operations",
        "Overdue Production",
        kitchenKPIs.overdueProductionCount,
        "Accepted or In Baking orders past event date",
      ],
      [
        "Kitchen Operations",
        "Overdue Handover",
        kitchenKPIs.overdueHandoverCount,
        "Ready orders past event date awaiting pickup",
      ],
      [
        "Kitchen Operations",
        "Urgent Priority Orders",
        kitchenKPIs.urgentOrdersCount,
        "Active orders flagged with urgent production priority",
      ],
      [
        "Kitchen Operations",
        "At-Risk Orders",
        kitchenKPIs.atRiskOrdersCount,
        "Active orders imminent within 2 days with scheduling or payment blockers",
      ],
      [
        "Kitchen Operations",
        "Ready for Production",
        kitchenKPIs.readyForProductionCount,
        "Accepted orders with deposit cleared ready for oven",
      ],
      [
        "Kitchen Operations",
        "In Baking Station",
        kitchenKPIs.inBakingCount,
        "Orders currently in baking station",
      ],
      [
        "Kitchen Operations",
        "Payment Blocked Orders",
        kitchenKPIs.paymentBlockedCount,
        "Accepted orders requiring deposit before baking",
      ],
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

  // CSV 2: Kitchen Capacity Report CSV
  const handleExportCapacityReport = () => {
    const headers = [
      "Date (YYYY-MM-DD)",
      "Day of Week",
      "Configured Capacity (Units)",
      "Bake Workload (Units)",
      "Decorate Workload (Units)",
      "Total Committed Workload (Units)",
      "Remaining Capacity (Units)",
      "Capacity Utilization (%)",
      "Capacity State",
      "Blackout Closure",
      "Blackout Reason",
      "Data Quality Issues",
    ];
    const rows = generateCapacityReportCsvRows(forecast14Days);
    exportToCsv(`kitchen-capacity-report-${todayStr}.csv`, headers, rows);
    toast.success("14-day capacity report exported to CSV");
  };

  // CSV 3: Staff Workload Report CSV
  const handleExportStaffWorkload = () => {
    const headers = [
      "Staff Member Name",
      "Report Date",
      "Assigned Bake Workload (Units)",
      "Assigned Decorate Workload (Units)",
      "Total Physical Workload (Units)",
      "Bake Task Count",
      "Decorate Task Count",
      "Total Distinct Orders",
      "Workload Guideline (Units)",
      "Guideline Utilization (%)",
      "Workload State",
      "Data Quality Issues",
    ];
    const rows = generateStaffWorkloadReportCsvRows(staffSummary.staffWorkloads, todayStr);
    exportToCsv(`staff-workload-report-${todayStr}.csv`, headers, rows);
    toast.success("Staff workload report exported to CSV");
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
                Comprehensive operational reporting, kitchen production capacity, staff allocation,
                and custom order insights.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              Last synced:{" "}
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalyticsData(true)}
            disabled={isRefreshing}
            className="rounded-full gap-1.5 border-border/80 shadow-xs cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDailyManagementModal(true)}
            className="rounded-full gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Daily Briefing (Print)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCapacityReport}
            className="rounded-full gap-1.5 border-border/80 shadow-xs cursor-pointer"
          >
            <Flame className="h-3.5 w-3.5 text-amber-600" />
            <span>Capacity CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStaffWorkload}
            className="rounded-full gap-1.5 border-border/80 shadow-xs cursor-pointer"
          >
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <span>Staff CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportAnalyticsSummary}
            className="rounded-full gap-1.5 bg-primary text-primary-foreground shadow-xs cursor-pointer hover:bg-primary/90"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Summary</span>
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

      {/* 2. KITCHEN OPERATIONS & EFFICIENCY SECTION (Phase 7G Core Enhancement) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-primary" /> Kitchen Operations & Production Efficiency
          </h2>
          <span className="text-xs text-muted-foreground">
            Workload throughput, turnaround duration & kitchen risk tracking
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Average Production Duration */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Average Production Duration
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <Timer className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-foreground">
                {kitchenKPIs.averageDuration.formattedAvgDuration}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kitchenKPIs.averageDuration.validOrdersCount > 0
                  ? `Across ${kitchenKPIs.averageDuration.validOrdersCount} completed order(s)`
                  : "Requires recorded start & completion timestamps"}
              </p>
            </div>
          </div>

          {/* Card 2: Production Completion Rate */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Production Completion Rate
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-emerald-700">
                {kitchenKPIs.completionRate.ratePercent}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kitchenKPIs.completionRate.completedCount} of{" "}
                {kitchenKPIs.completionRate.eligibleCount} eligible production orders
              </p>
            </div>
          </div>

          {/* Card 3: Overdue Orders */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Overdue Orders</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${kitchenKPIs.overdueOrdersCount > 0 ? "bg-rose-500/20 text-rose-700 font-bold animate-pulse" : "bg-zinc-500/10 text-muted-foreground"}`}
              >
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`text-2xl font-bold ${kitchenKPIs.overdueOrdersCount > 0 ? "text-rose-700" : "text-foreground"}`}
              >
                {kitchenKPIs.overdueOrdersCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kitchenKPIs.overdueOrdersCount > 0
                  ? `${kitchenKPIs.overdueProductionCount} in production • ${kitchenKPIs.overdueHandoverCount} in handover`
                  : "All active orders within schedule"}
              </p>
            </div>
          </div>

          {/* Card 4: Urgent Priority Orders */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Urgent Priority Orders
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-rose-600">
                {kitchenKPIs.urgentOrdersCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Active cakes flagged for expedited kitchen handling
              </p>
            </div>
          </div>

          {/* Card 5: At-Risk Orders */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">At-Risk Orders</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-amber-700">
                {kitchenKPIs.atRiskOrdersCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Imminent within 2 days with scheduling or deposit blockers
              </p>
            </div>
          </div>

          {/* Card 6: Ready for Production */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Ready for Production
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-emerald-700">
                {kitchenKPIs.readyForProductionCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Accepted orders with deposit cleared ready for oven
              </p>
            </div>
          </div>

          {/* Card 7: In Baking Station */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">In Baking Station</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <ChefHat className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-purple-700">{kitchenKPIs.inBakingCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Active cakes currently in oven or decorating station
              </p>
            </div>
          </div>

          {/* Card 8: Ready for Pickup */}
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Ready for Pickup</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                <PackageCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-teal-700">
                {kitchenKPIs.readyForPickupCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Finished pastry packaged awaiting customer collection
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 14-DAY PRODUCTION WORKLOAD VS CAPACITY HORIZON (Phase 7G Enhancement) */}
      <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-teal-600" /> 14-Day Kitchen Workload vs Capacity
              Horizon
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparison of Event Order Count vs Scheduled Production Workload (Complexity Units)
              against Configured Daily Kitchen Capacity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              Committed Statuses: Accepted, In Baking
            </span>
          </div>
        </div>

        {/* 14-Day Visual Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forecast14Days} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
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
              <YAxis allowDecimals={true} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                formatter={(
                  value: unknown,
                  name: unknown,
                  item: { payload?: DailyWorkloadForecastItem },
                ) => {
                  const p = item.payload;
                  if (!p) return [`${value}`, `${name}`];
                  if (name === "productionWorkloadUnits") {
                    return [
                      `${value}u (${p.bakeWorkloadUnits.toFixed(1)}u Bake, ${p.decorateWorkloadUnits.toFixed(1)}u Decorate) / ${p.configuredDailyCapacity.toFixed(1)}u max (${p.utilizationPercent}% load)`,
                      "Production Workload",
                    ];
                  }
                  return [`${value} event(s)`, "Event Orders"];
                }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="eventOrderCount"
                name="Event Orders"
                fill="#94a3b8"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="productionWorkloadUnits"
                name="Production Workload (Units)"
                radius={[6, 6, 0, 0]}
              >
                {forecast14Days.map((entry, index) => (
                  <Cell
                    key={`cap-bar-${index}`}
                    fill={
                      entry.isBlackout
                        ? "#71717a"
                        : entry.capacityState === "over_capacity"
                          ? "#f43f5e"
                          : entry.capacityState === "near_capacity"
                            ? "#f59e0b"
                            : "#10b981"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 14-Day Horizon Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse border border-border/60 rounded-xl overflow-hidden">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-foreground font-semibold">
                <th className="py-2.5 px-3">Date & Day</th>
                <th className="py-2.5 px-3">Event Orders</th>
                <th className="py-2.5 px-3">Bake Units</th>
                <th className="py-2.5 px-3">Decorate Units</th>
                <th className="py-2.5 px-3">Total Workload</th>
                <th className="py-2.5 px-3">Daily Capacity</th>
                <th className="py-2.5 px-3">Remaining</th>
                <th className="py-2.5 px-3">Utilization</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {forecast14Days.map((item) => (
                <tr key={item.dateStr} className="hover:bg-muted/10 font-sans">
                  <td className="py-2 px-3 font-semibold text-foreground">
                    {item.label}{" "}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({item.dateStr})
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono font-medium">{item.eventOrderCount}</td>
                  <td className="py-2 px-3 font-mono text-purple-700">
                    {item.bakeWorkloadUnits.toFixed(1)}u
                  </td>
                  <td className="py-2 px-3 font-mono text-pink-700">
                    {item.decorateWorkloadUnits.toFixed(1)}u
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-foreground">
                    {item.productionWorkloadUnits.toFixed(1)}u
                  </td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">
                    {item.isBlackout
                      ? "0.0u (Closed)"
                      : `${item.configuredDailyCapacity.toFixed(1)}u`}
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold">
                    {item.remainingCapacityUnits.toFixed(1)}u
                  </td>
                  <td className="py-2 px-3 font-mono font-bold">
                    {item.utilizationPercent.toFixed(0)}%
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${item.badgeClass}`}
                    >
                      {item.capacityStateLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. STAFF WORKLOAD & ROSTER DISTRIBUTION SUMMARY (Phase 7G Enhancement) */}
      <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Today's Staff Allocation & Workload
              Distribution
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigned physical cake workload across active bakery staff on {todayStr} (Soft
              Guideline: 6.0 units / person)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStaffWorkload}
            className="rounded-full gap-1.5 border-border/80 shadow-xs cursor-pointer text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Staff Workload</span>
          </Button>
        </div>

        {staffSummary.staffWorkloads.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No admin staff profiles found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-border/60 rounded-xl overflow-hidden">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-foreground font-semibold">
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Bake Tasks</th>
                  <th className="py-2.5 px-3">Decorate Tasks</th>
                  <th className="py-2.5 px-3">Total Physical Load</th>
                  <th className="py-2.5 px-3">Guideline Load (6.0u)</th>
                  <th className="py-2.5 px-3">Workload State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {staffSummary.staffWorkloads.map((w) => (
                  <tr key={w.staffId} className="hover:bg-muted/10 font-sans">
                    <td className="py-2 px-3 font-semibold text-foreground">{w.staffName}</td>
                    <td className="py-2 px-3 font-mono">
                      {w.bakeTaskCount} ({w.bakeUnits.toFixed(1)}u)
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {w.decorateTaskCount} ({w.decorateUnits.toFixed(1)}u)
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-foreground">
                      {w.totalPhysicalWorkloadUnits.toFixed(1)} units
                    </td>
                    <td className="py-2 px-3 font-mono font-medium">
                      {w.utilizationPercent.toFixed(0)}%
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${w.badgeClass}`}
                      >
                        {w.stateLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(staffSummary.unassignedBakersCount > 0 || staffSummary.unassignedDecoratorsCount > 0) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 font-medium flex items-center justify-between">
            <span>⚠️ Unassigned Kitchen Roles on {todayStr}:</span>
            <span className="font-bold">
              {staffSummary.unassignedBakersCount} Bake task(s) unassigned •{" "}
              {staffSummary.unassignedDecoratorsCount} Decorate task(s) unassigned
            </span>
          </div>
        )}
      </div>

      {/* 5. Multi-Domain Financial & Customer Indicators */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Key Financial & Customer Indicators
          </h2>
          <span className="text-xs text-muted-foreground">
            Custom order pipeline & customer directory metrics
          </span>
        </div>

        {/* Financial Highlights (4 Cards) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Custom Order Spend Collected
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-emerald-700">
                {formatLKR(kpis.totalCollectedLkr)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Verified deposits & full payments recorded
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Quoted Custom Pipeline
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-foreground">
                {formatLKR(kpis.totalQuotedLkr)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Total value of {kpis.quotedCount} quoted custom orders
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Active Outstanding Due
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-amber-700">
                {formatLKR(kpis.totalOutstandingLkr)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Uncollected balance across active orders
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Deposit Clearance</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <BadgePercent className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-purple-700">{kpis.depositClearanceRate}%</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.depositPaidCount + kpis.fullyPaidCount} orders cleared for kitchen
              </p>
            </div>
          </div>
        </div>

        {/* Customer & Inquiry Indicators (4 Cards) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-1">
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
                Ordering customers placing 2+ custom cake requests
              </p>
            </div>
          </div>

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
                  ? "Requires admin response in inbox"
                  : "All customer inquiries resolved"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Charts: Monthly Volume & Event Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 6A. Monthly Custom Order Volume */}
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

        {/* 6B. Event Type Distribution */}
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

      {/* 7. Charts: Status Pipeline Funnel & Payment Clearance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 7A. Status Pipeline Funnel */}
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

        {/* 7B. Payment Clearance & Readiness Pipeline */}
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/70 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600" /> Payment Clearance & Realization
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown of orders by structured payment status (Fully Paid, Deposit Paid, Unpaid)
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              {paymentStatusData.reduce((acc, p) => acc + p.count, 0)} Total
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 h-64">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`pay-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(
                      value: unknown,
                      _name: unknown,
                      item: { payload?: { name?: string; percentage?: string } },
                    ) => [
                      `${value} orders (${item.payload?.percentage ?? "0"}%)`,
                      item.payload?.name ?? "Status",
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

            {/* Payment Status Legend */}
            <div className="space-y-3">
              {paymentStatusData.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-foreground">{item.name}</span>
                    </div>
                    <span className="font-semibold text-foreground font-mono">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Collected Funds: {formatLKR(kpis.totalCollectedLkr)}</span>
            <span>Outstanding: {formatLKR(kpis.totalOutstandingLkr)}</span>
          </div>
        </div>
      </div>

      {/* 8. Daily Management Briefing Modal */}
      {showDailyManagementModal && (
        <DailyManagementSummaryModal
          orders={orders}
          selectedDate={todayStr}
          staffList={staff}
          capacitySettings={capacitySettings}
          blackoutDates={blackoutDates}
          onClose={() => setShowDailyManagementModal(false)}
        />
      )}
    </div>
  );
}
