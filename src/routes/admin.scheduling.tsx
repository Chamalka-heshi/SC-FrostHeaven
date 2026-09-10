import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CalendarDays,
  Calendar,
  Clock,
  ChefHat,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Mail,
  FileText,
  X,
  Loader2,
  Layers,
  Flame,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
  Plus,
  ArrowRight,
  Ban,
  Check,
  Info,
  Settings2,
  TrendingUp,
  Trash2,
  Printer,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  formatLKR,
  getProductionReadiness,
  getPaymentBadgeInfo,
  normalizePhoneForWhatsApp,
  getWhatsAppUrl,
  getEmailMailtoUrl,
} from "@/lib/order-readiness";
import {
  calculateDailyCapacity,
  previewScheduleImpact,
  type KitchenCapacitySetting,
  type BakeryBlackoutDate,
  type DailyCapacityResult,
  DEFAULT_WEEKDAY_CAPACITY_FALLBACK,
} from "@/lib/capacity-utils";
import {
  getStaffDisplayName,
  getAssignmentState,
  calculateStaffDailyWorkload,
  getStaffWorkloadSummary,
  previewStaffAssignmentImpact,
  DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE,
  type StaffDailyWorkloadResult,
  type AssignmentState,
} from "@/lib/staff-workload-utils";
import { exportToCsv, getLocalDateString } from "@/lib/csv-export";
import { DailyManagementSummaryModal } from "@/components/daily-management-summary-modal";
import {
  generateCapacityReportCsvRows,
  generateStaffWorkloadReportCsvRows,
  calculate14DayWorkloadCapacityForecast,
} from "@/lib/analytics-utils";

export const Route = createFileRoute("/admin/scheduling")({
  head: () => ({
    meta: [
      { title: "Kitchen Scheduling & Capacity — SC Frost Heaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSchedulingPage,
});

export interface SchedulingOrder {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_type: string;
  event_date: string;
  cake_details: string;
  status: string;
  customer_message?: string | null;
  internal_notes?: string | null;
  admin_notes?: string | null;
  quoted_price_lkr?: number | null;
  deposit_amount_lkr?: number | null;
  amount_paid_lkr?: number;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_notes?: string | null;
  scheduled_bake_date?: string | null;
  scheduled_decorate_date?: string | null;
  target_pickup_time?: string | null;
  production_priority?: string;
  complexity_units?: number;
  assigned_baker_id?: string | null;
  assigned_decorator_id?: string | null;
  production_started_at?: string | null;
  production_completed_at?: string | null;
  quote_issued_at?: string | null;
  deposit_paid_at?: string | null;
  fully_paid_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ==============================================================================
// TIMEZONE-SAFE DATE UTILITIES (Local Calendar Date Logic)
// ==============================================================================

export function formatLocalDateToYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseYMDToLocalDate(ymd: string): Date {
  const parts = ymd.split("-");
  const year = parseInt(parts[0] || "2026", 10);
  const month = parseInt(parts[1] || "1", 10) - 1;
  const day = parseInt(parts[2] || "1", 10);
  return new Date(year, month, day, 12, 0, 0); // Noon local time avoids any edge drift
}

export function getLocalTodayYMD(): string {
  return formatLocalDateToYMD(new Date());
}

export function addDaysToYMD(ymd: string, days: number): string {
  const date = parseYMDToLocalDate(ymd);
  date.setDate(date.getDate() + days);
  return formatLocalDateToYMD(date);
}

export function getMondayOfWeek(ymd: string): string {
  const date = parseYMDToLocalDate(ymd);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  date.setDate(date.getDate() + diff);
  return formatLocalDateToYMD(date);
}

export function formatDisplayDate(
  ymd: string | null | undefined,
  style: "short" | "medium" | "long" = "medium",
): string {
  if (!ymd) return "—";
  try {
    const d = parseYMDToLocalDate(ymd);
    if (isNaN(d.getTime())) return ymd;
    if (style === "short") {
      return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
    }
    if (style === "long") {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);
    }
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return ymd;
  }
}

export function formatTimeDisplay(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

export function getPriorityBadge(priority: string | null | undefined) {
  const p = (priority || "normal").toLowerCase();
  if (p === "urgent") {
    return {
      label: "Urgent",
      badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      dotClass: "bg-rose-500 animate-ping",
    };
  }
  if (p === "high") {
    return {
      label: "High",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      dotClass: "bg-amber-500",
    };
  }
  return {
    label: "Normal",
    badgeClass: "bg-muted text-muted-foreground border-border/70",
    dotClass: "bg-muted-foreground",
  };
}

// ==============================================================================
// MAIN ADMIN SCHEDULING & CAPACITY COMPONENT
// ==============================================================================

function AdminSchedulingPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<SchedulingOrder[]>([]);
  const [capacitySettings, setCapacitySettings] = useState<KitchenCapacitySetting[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BakeryBlackoutDate[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calendar Navigation State
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [selectedDateYMD, setSelectedDateYMD] = useState<string>(getLocalTodayYMD());

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all_active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [schedulingFilter, setSchedulingFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);

  // Memoized staff map for instant ID -> Staff lookup
  const staffMap = useMemo(() => {
    const map = new Map<string, StaffProfile>();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  // Side Drawer / Modal States
  const [showUnscheduledDrawer, setShowUnscheduledDrawer] = useState(false);
  const [showCapacitySettingsModal, setShowCapacitySettingsModal] = useState(false);
  const [showDailyManagementModal, setShowDailyManagementModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SchedulingOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<SchedulingOrder | null>(null);

  // Phase 7G CSV Export Handlers
  const handleExportCapacityReport = () => {
    const today = getLocalDateString(new Date());
    const forecast = calculate14DayWorkloadCapacityForecast(
      orders as any,
      capacitySettings,
      blackoutDates,
      today,
    );
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
    const rows = generateCapacityReportCsvRows(forecast);
    exportToCsv(`kitchen-capacity-report-${today}.csv`, headers, rows);
    toast.success("14-day capacity report exported to CSV");
  };

  const handleExportStaffWorkload = () => {
    const today = getLocalDateString(new Date());
    const targetDate = selectedDateYMD || today;
    const summary = getStaffWorkloadSummary(targetDate, staffList as any, orders as any);
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
    const rows = generateStaffWorkloadReportCsvRows(summary.staffWorkloads, targetDate);
    exportToCsv(`staff-workload-report-${targetDate}.csv`, headers, rows);
    toast.success(`Staff workload report for ${targetDate} exported to CSV`);
  };

  // Scheduling Form State
  const [formBakeDate, setFormBakeDate] = useState("");
  const [formDecorateDate, setFormDecorateDate] = useState("");
  const [formPickupTime, setFormPickupTime] = useState("");
  const [formPriority, setFormPriority] = useState("normal");
  const [formComplexity, setFormComplexity] = useState(1.0);
  const [formBakerId, setFormBakerId] = useState("");
  const [formDecoratorId, setFormDecoratorId] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Capacity Settings Form State
  const [capacityForm, setCapacityForm] = useState<Record<number, number>>({
    0: 8.0,
    1: 8.0,
    2: 8.0,
    3: 8.0,
    4: 8.0,
    5: 8.0,
    6: 8.0,
  });
  const [newBlackoutDate, setNewBlackoutDate] = useState("");
  const [newBlackoutReason, setNewBlackoutReason] = useState("");
  const [isSavingCapacitySettings, setIsSavingCapacitySettings] = useState(false);
  const [isAddingBlackout, setIsAddingBlackout] = useState(false);
  const [deletingBlackoutId, setDeletingBlackoutId] = useState<string | null>(null);

  // Strict Admin Authorization Guard
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

  // Fetch all scheduling-relevant data
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      // 1. Fetch custom orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("custom_orders")
        .select(
          `
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
          internal_notes,
          admin_notes,
          quoted_price_lkr,
          deposit_amount_lkr,
          amount_paid_lkr,
          payment_status,
          payment_method,
          payment_reference,
          payment_notes,
          scheduled_bake_date,
          scheduled_decorate_date,
          target_pickup_time,
          production_priority,
          complexity_units,
          assigned_baker_id,
          assigned_decorator_id,
          production_started_at,
          production_completed_at,
          quote_issued_at,
          deposit_paid_at,
          fully_paid_at,
          created_at,
          updated_at
        `,
        )
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders((ordersData as SchedulingOrder[]) || []);

      // 2. Fetch capacity settings (7 weekday rows)
      const { data: capData, error: capError } = await supabase
        .from("kitchen_capacity_settings")
        .select("id, day_of_week, max_capacity_units, updated_at")
        .order("day_of_week", { ascending: true });

      if (!capError && capData) {
        setCapacitySettings(capData as KitchenCapacitySetting[]);
        const capMap: Record<number, number> = {};
        capData.forEach((row: any) => {
          capMap[row.day_of_week] = Number(row.max_capacity_units);
        });
        setCapacityForm((prev) => ({ ...prev, ...capMap }));
      }

      // 3. Fetch blackout dates
      const { data: blackoutData, error: blackoutError } = await supabase
        .from("bakery_blackout_dates")
        .select("id, blackout_date, reason, created_at")
        .order("blackout_date", { ascending: true });

      if (!blackoutError && blackoutData) {
        setBlackoutDates(blackoutData as BakeryBlackoutDate[]);
      }

      // 4. Fetch admin profiles for staff assignment candidates
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "admin");

      if (!profilesError && profilesData) {
        setStaffList(profilesData as StaffProfile[]);
      }
    } catch (err: any) {
      console.error("Error loading scheduling data:", err);
      toast.error(`Failed to load scheduling calendar: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Edit Schedule Modal
  const handleOpenScheduleEditor = (order: SchedulingOrder) => {
    setEditingOrder(order);
    setFormBakeDate(order.scheduled_bake_date || "");
    setFormDecorateDate(order.scheduled_decorate_date || "");
    setFormPickupTime(order.target_pickup_time ? order.target_pickup_time.slice(0, 5) : "");
    setFormPriority(order.production_priority || "normal");
    setFormComplexity(
      order.complexity_units !== undefined && order.complexity_units !== null
        ? Number(order.complexity_units)
        : 1.0,
    );
    setFormBakerId(order.assigned_baker_id || "");
    setFormDecoratorId(order.assigned_decorator_id || "");
  };

  // Close Edit Schedule Modal
  const handleCloseScheduleEditor = () => {
    setEditingOrder(null);
  };

  // Save Schedule Handler
  const handleSaveSchedule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingOrder) return;

    // Validation 1: Decorate date cannot be before bake date
    if (formBakeDate && formDecorateDate && formDecorateDate < formBakeDate) {
      toast.error("Invalid Schedule: Decorate date cannot be earlier than the bake date.");
      return;
    }

    // Validation 2: Complexity units range 0.5 to 10.0
    const complexityNum = Number(formComplexity);
    if (isNaN(complexityNum) || complexityNum < 0.5 || complexityNum > 10.0) {
      toast.error("Invalid Complexity: Workload units must be between 0.5 and 10.0.");
      return;
    }

    // Validation 3: Priority constraint
    const priorityVal = formPriority.toLowerCase();
    if (!["normal", "high", "urgent"].includes(priorityVal)) {
      toast.error("Invalid Priority: Must be normal, high, or urgent.");
      return;
    }

    try {
      setIsSavingSchedule(true);

      const updatePayload: Record<string, any> = {
        scheduled_bake_date: formBakeDate.trim() ? formBakeDate.trim() : null,
        scheduled_decorate_date: formDecorateDate.trim() ? formDecorateDate.trim() : null,
        target_pickup_time: formPickupTime.trim() ? `${formPickupTime.trim()}:00` : null,
        production_priority: priorityVal,
        complexity_units: complexityNum,
        assigned_baker_id: formBakerId.trim() ? formBakerId.trim() : null,
        assigned_decorator_id: formDecoratorId.trim() ? formDecoratorId.trim() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("custom_orders")
        .update(updatePayload)
        .eq("id", editingOrder.id);

      if (error) throw error;

      toast.success(
        `Production schedule updated for #${editingOrder.id.slice(0, 8).toUpperCase()}`,
      );
      handleCloseScheduleEditor();
      await fetchData(true);
    } catch (err: any) {
      console.error("Failed to save schedule:", err);
      toast.error(`Error saving schedule: ${err.message || "Unknown database error"}`);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Save Weekday Capacity Settings
  const handleSaveCapacitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingCapacitySettings(true);

      // Upsert each weekday record
      for (let d = 0; d <= 6; d++) {
        const val = Number(capacityForm[d] || DEFAULT_WEEKDAY_CAPACITY_FALLBACK);
        if (isNaN(val) || val <= 0) {
          toast.error(`Invalid capacity for ${WEEKDAY_NAMES[d]}: Must be greater than 0.`);
          setIsSavingCapacitySettings(false);
          return;
        }

        const existing = capacitySettings.find((s) => s.day_of_week === d);
        if (existing?.id) {
          const { error } = await supabase
            .from("kitchen_capacity_settings")
            .update({ max_capacity_units: val, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("kitchen_capacity_settings")
            .insert({ day_of_week: d, max_capacity_units: val });
          if (error) throw error;
        }
      }

      toast.success("Kitchen capacity settings updated successfully.");
      setShowCapacitySettingsModal(false);
      await fetchData(true);
    } catch (err: any) {
      console.error("Failed to update capacity settings:", err);
      toast.error(`Error saving capacity settings: ${err.message || "Unknown error"}`);
    } finally {
      setIsSavingCapacitySettings(false);
    }
  };

  // Add Blackout Date Handler
  const handleAddBlackoutDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlackoutDate.trim()) {
      toast.error("Please select a calendar date for the blackout.");
      return;
    }
    if (!newBlackoutReason.trim()) {
      toast.error("Please enter a reason for the bakery closure.");
      return;
    }

    try {
      setIsAddingBlackout(true);
      const { error } = await supabase.from("bakery_blackout_dates").insert({
        blackout_date: newBlackoutDate.trim(),
        reason: newBlackoutReason.trim(),
      });

      if (error) {
        if (error.code === "23505" || error.message.includes("unique")) {
          toast.error("This calendar date is already recorded as a blackout date.");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Blackout date added for ${newBlackoutDate}.`);
      setNewBlackoutDate("");
      setNewBlackoutReason("");
      await fetchData(true);
    } catch (err: any) {
      console.error("Failed to add blackout date:", err);
      toast.error(`Error adding blackout: ${err.message || "Unknown error"}`);
    } finally {
      setIsAddingBlackout(false);
    }
  };

  // Delete Blackout Date Handler
  const handleDeleteBlackoutDate = async (id: string, dateStr: string) => {
    try {
      setDeletingBlackoutId(id);
      const { error } = await supabase.from("bakery_blackout_dates").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Removed blackout date for ${dateStr}.`);
      await fetchData(true);
    } catch (err: any) {
      console.error("Failed to remove blackout date:", err);
      toast.error(`Error removing blackout date: ${err.message || "Unknown error"}`);
    } finally {
      setDeletingBlackoutId(null);
    }
  };

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusLower = (order.status || "").toLowerCase();

      // 1. Completion filter
      if (!showCompleted) {
        if (
          statusLower === "completed" ||
          statusLower === "declined" ||
          statusLower === "cancelled"
        ) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== "all_active") {
        if (statusFilter === "accepted" && statusLower !== "accepted") return false;
        if (statusFilter === "in_baking" && statusLower !== "in_baking") return false;
        if (statusFilter === "ready" && statusLower !== "ready") return false;
        if (statusFilter === "quoted" && statusLower !== "quoted") return false;
        if (statusFilter === "under_review" && statusLower !== "under_review") return false;
        if (statusFilter === "submitted" && statusLower !== "submitted") return false;
        if (statusFilter === "completed" && statusLower !== "completed") return false;
      }

      // 3. Priority filter
      if (priorityFilter !== "all") {
        const p = (order.production_priority || "normal").toLowerCase();
        if (p !== priorityFilter) return false;
      }

      // 4. Scheduling state filter
      if (schedulingFilter === "fully_scheduled") {
        if (!order.scheduled_bake_date || !order.scheduled_decorate_date) return false;
      } else if (schedulingFilter === "partially_scheduled") {
        const hasOne =
          (order.scheduled_bake_date && !order.scheduled_decorate_date) ||
          (!order.scheduled_bake_date && order.scheduled_decorate_date);
        if (!hasOne) return false;
      } else if (schedulingFilter === "unscheduled") {
        if (order.scheduled_bake_date || order.scheduled_decorate_date) return false;
      }

      // 5. Staff filter
      if (staffFilter !== "all") {
        if (staffFilter === "unassigned") {
          const hasBaker = Boolean(order.assigned_baker_id && order.assigned_baker_id.trim());
          const hasDecorator = Boolean(
            order.assigned_decorator_id && order.assigned_decorator_id.trim(),
          );
          if (hasBaker && hasDecorator) return false;
        } else if (staffFilter === "my_work") {
          const isMine =
            order.assigned_baker_id === user?.id || order.assigned_decorator_id === user?.id;
          if (!isMine) return false;
        } else {
          // Specific staff UUID
          const matchesStaff =
            order.assigned_baker_id === staffFilter || order.assigned_decorator_id === staffFilter;
          if (!matchesStaff) return false;
        }
      }

      // 6. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const shortId = order.id.slice(0, 8).toLowerCase();
        const name = (order.customer_name || "").toLowerCase();
        const email = (order.customer_email || "").toLowerCase();
        const phone = (order.customer_phone || "").toLowerCase();
        const cake = (order.cake_details || "").toLowerCase();

        if (
          !shortId.includes(q) &&
          !name.includes(q) &&
          !email.includes(q) &&
          !phone.includes(q) &&
          !cake.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    showCompleted,
    statusFilter,
    priorityFilter,
    schedulingFilter,
    staffFilter,
    searchQuery,
    user?.id,
  ]);

  // Unscheduled Orders List (Active orders with missing bake or decorate date)
  const unscheduledOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      if (s === "completed" || s === "declined" || s === "cancelled") return false;
      return !o.scheduled_bake_date || !o.scheduled_decorate_date;
    });
  }, [orders]);

  // Tentative Pipeline Summary (Orders in submitted, under_review, quoted)
  const tentativePipelineSummary = useMemo(() => {
    const tentative = orders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "submitted" || s === "under_review" || s === "quoted";
    });
    const totalUnits = tentative.reduce((acc, o) => acc + (Number(o.complexity_units) || 1.0), 0);
    return {
      count: tentative.length,
      units: totalUnits,
    };
  }, [orders]);

  // Generate Week Days Array for Week View (7 days starting from Monday of selectedDate)
  const weekDays = useMemo(() => {
    const mondayYMD = getMondayOfWeek(selectedDateYMD);
    const days: { ymd: string; dayName: string; dateDisplay: string; isToday: boolean }[] = [];
    const todayYMD = getLocalTodayYMD();

    for (let i = 0; i < 7; i++) {
      const dayYMD = addDaysToYMD(mondayYMD, i);
      const d = parseYMDToLocalDate(dayYMD);
      const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
      const dateDisplay = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(d);
      days.push({
        ymd: dayYMD,
        dayName,
        dateDisplay,
        isToday: dayYMD === todayYMD,
      });
    }
    return days;
  }, [selectedDateYMD]);

  // Daily Capacity Map for the visible week
  const weekCapacityMap = useMemo(() => {
    const map = new Map<string, DailyCapacityResult>();
    weekDays.forEach((day) => {
      const result = calculateDailyCapacity(day.ymd, orders, capacitySettings, blackoutDates);
      map.set(day.ymd, result);
    });
    return map;
  }, [weekDays, orders, capacitySettings, blackoutDates]);

  // Single Day Capacity Result for Day View
  const selectedDayCapacity = useMemo(() => {
    return calculateDailyCapacity(selectedDateYMD, orders, capacitySettings, blackoutDates);
  }, [selectedDateYMD, orders, capacitySettings, blackoutDates]);

  // Live Capacity Impact Preview for Editing Order
  const scheduleImpact = useMemo(() => {
    if (!editingOrder) return null;
    const targetDate = formBakeDate || formDecorateDate || editingOrder.event_date;
    if (!targetDate) return null;

    return previewScheduleImpact(
      targetDate,
      editingOrder.id,
      Number(formComplexity || 1.0),
      orders,
      capacitySettings,
      blackoutDates,
    );
  }, [
    editingOrder,
    formBakeDate,
    formDecorateDate,
    formComplexity,
    orders,
    capacitySettings,
    blackoutDates,
  ]);

  // Baker Staff Workload Live Preview
  const bakerStaffPreview = useMemo(() => {
    if (!formBakerId || !formBakeDate || !editingOrder) return null;
    const staff = staffMap.get(formBakerId);
    const staffName = getStaffDisplayName(staff);
    return previewStaffAssignmentImpact(
      formBakeDate,
      formBakerId,
      staffName,
      editingOrder.id,
      formComplexity,
      "baker",
      orders,
    );
  }, [formBakerId, formBakeDate, formComplexity, editingOrder, orders, staffMap]);

  // Decorator Staff Workload Live Preview
  const decoratorStaffPreview = useMemo(() => {
    if (!formDecoratorId || !formDecorateDate || !editingOrder) return null;
    const staff = staffMap.get(formDecoratorId);
    const staffName = getStaffDisplayName(staff);
    return previewStaffAssignmentImpact(
      formDecorateDate,
      formDecoratorId,
      staffName,
      editingOrder.id,
      formComplexity,
      "decorator",
      orders,
    );
  }, [formDecoratorId, formDecorateDate, formComplexity, editingOrder, orders, staffMap]);

  // Date Range Heading String
  const dateRangeHeading = useMemo(() => {
    if (viewMode === "day") {
      return formatDisplayDate(selectedDateYMD, "long");
    }
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (!firstDay || !lastDay) return "";
    return `${formatDisplayDate(firstDay.ymd, "medium")} — ${formatDisplayDate(lastDay.ymd, "medium")}`;
  }, [viewMode, selectedDateYMD, weekDays]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "week") {
      setSelectedDateYMD(addDaysToYMD(selectedDateYMD, -7));
    } else {
      setSelectedDateYMD(addDaysToYMD(selectedDateYMD, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      setSelectedDateYMD(addDaysToYMD(selectedDateYMD, 7));
    } else {
      setSelectedDateYMD(addDaysToYMD(selectedDateYMD, 1));
    }
  };

  const handleToday = () => {
    setSelectedDateYMD(getLocalTodayYMD());
  };

  // Staff Name Lookup Helper
  const getStaffName = (staffId: string | null | undefined): string => {
    if (!staffId) return "";
    const member = staffList.find((s) => s.id === staffId);
    return member?.full_name || member?.email?.split("@")[0] || "Staff";
  };

  // Quick Scheduling Date Preset Helpers
  const handleSetBakePreset = (daysBeforeEvent: number) => {
    if (!editingOrder?.event_date) return;
    const targetDate = addDaysToYMD(editingOrder.event_date, -daysBeforeEvent);
    setFormBakeDate(targetDate);
    if (!formDecorateDate || formDecorateDate < targetDate) {
      setFormDecorateDate(targetDate);
    }
  };

  const handleSetDecoratePreset = (daysBeforeEvent: number) => {
    if (!editingOrder?.event_date) return;
    const targetDate = addDaysToYMD(editingOrder.event_date, -daysBeforeEvent);
    setFormDecorateDate(targetDate);
  };

  // Loading skeleton state
  if (loading && !orders.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 space-y-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays className="h-7 w-7" />
          <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            Loading Kitchen Production Schedule & Capacity...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fetching custom orders, capacity limits & artisan calendars
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & WORKFLOW SUMMARY */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Kitchen Scheduling & Capacity
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Phase 7D
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Artisan cake milestones, daily capacity utilization & workload management
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tentative Pipeline Indicator */}
          {tentativePipelineSummary.count > 0 && (
            <div
              className="hidden lg:flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-xs text-sky-700 dark:text-sky-300 font-medium"
              title="Unconfirmed orders in submitted, under_review, or quoted status"
            >
              <Info className="h-3.5 w-3.5" />
              <span>
                Pipeline: {tentativePipelineSummary.count} orders (
                {tentativePipelineSummary.units.toFixed(1)}u)
              </span>
            </div>
          )}

          {/* Capacity Settings Button */}
          <Button
            onClick={() => setShowCapacitySettingsModal(true)}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 bg-card shadow-xs hover:bg-secondary cursor-pointer"
          >
            <Settings2 className="h-4 w-4 text-primary" />
            <span>Capacity Settings</span>
          </Button>

          {/* Unscheduled Orders Button */}
          <Button
            onClick={() => setShowUnscheduledDrawer(true)}
            variant="outline"
            size="sm"
            className="rounded-full gap-2 relative bg-card shadow-xs hover:bg-secondary cursor-pointer"
          >
            <ChefHat className="h-4 w-4 text-primary" />
            <span>Unscheduled</span>
            {unscheduledOrders.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold px-1.5 shadow-xs">
                {unscheduledOrders.length}
              </span>
            )}
          </Button>

          {/* Daily Management Briefing Print Button */}
          <Button
            onClick={() => setShowDailyManagementModal(true)}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-xs cursor-pointer"
            title="Open printable executive kitchen briefing"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Daily Briefing</span>
          </Button>

          {/* Capacity CSV Export */}
          <Button
            onClick={handleExportCapacityReport}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 bg-card shadow-xs hover:bg-secondary cursor-pointer"
            title="Export 14-day capacity report (CSV)"
          >
            <Flame className="h-4 w-4 text-amber-600" />
            <span className="hidden md:inline">Capacity CSV</span>
          </Button>

          {/* Staff Workload CSV Export */}
          <Button
            onClick={handleExportStaffWorkload}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 bg-card shadow-xs hover:bg-secondary cursor-pointer"
            title="Export staff workload report for selected date (CSV)"
          >
            <Users className="h-4 w-4 text-blue-600" />
            <span className="hidden md:inline">Staff CSV</span>
          </Button>

          <Button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 shadow-xs cursor-pointer"
            title="Refresh scheduling and capacity data"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. CALENDAR CONTROLS & NAVIGATION BAR */}
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-4 sm:p-5 border border-border/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: View Mode Toggle & Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-full bg-muted/60 p-1 border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "week"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Week View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "day"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Day View
              </button>
            </div>

            <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />

            {/* Previous / Today / Next */}
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handlePrev}
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-xs cursor-pointer"
                title={viewMode === "week" ? "Previous Week" : "Previous Day"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleToday}
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-semibold shadow-xs cursor-pointer"
              >
                Today
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-xs cursor-pointer"
                title={viewMode === "week" ? "Next Week" : "Next Day"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Center / Heading */}
          <div className="text-center md:text-left">
            <h2 className="text-base sm:text-lg font-bold text-foreground">{dateRangeHeading}</h2>
            <p className="text-[11px] text-muted-foreground">
              {viewMode === "week" ? "7-Day Capacity Horizon" : "Daily Production Capacity"}
            </p>
          </div>

          {/* Right: Date Picker Jump */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="calendar-jump-date"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Jump to:
            </label>
            <Input
              id="calendar-jump-date"
              type="date"
              value={selectedDateYMD}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDateYMD(e.target.value);
                }
              }}
              className="h-8 text-xs rounded-xl w-36 bg-background"
            />
          </div>
        </div>

        {/* 3. HORIZON CAPACITY SUMMARY STRIP (WEEK VIEW ONLY) */}
        {viewMode === "week" && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                7-Day Capacity Horizon
              </span>
              <span className="text-[10px] text-muted-foreground">
                Committed production units vs configured limits
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const cap = weekCapacityMap.get(day.ymd);
                if (!cap) return null;

                const progressWidth = cap.isBlackout
                  ? 0
                  : Math.min(100, Math.max(0, cap.utilizationPercent));

                return (
                  <div
                    key={`horizon-${day.ymd}`}
                    onClick={() => {
                      setSelectedDateYMD(day.ymd);
                      setViewMode("day");
                    }}
                    className={`rounded-2xl border p-2.5 transition-all cursor-pointer hover:border-primary/50 ${
                      day.isToday
                        ? "bg-primary/[0.04] border-primary/40 ring-1 ring-primary/30"
                        : cap.isBlackout
                          ? "bg-zinc-500/[0.04] border-border"
                          : "bg-muted/30 border-border/70"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">
                        {day.dayName} {day.dateDisplay.split(" ")[1]}
                      </span>
                      <span
                        className={`text-[10px] font-bold rounded-md px-1.5 py-0.2 border ${cap.badgeClass}`}
                      >
                        {cap.isBlackout ? "Closed" : `${Math.round(cap.utilizationPercent)}%`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${cap.progressBarClass}`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>

                    {/* Workload metric */}
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {cap.isBlackout
                          ? "Blackout"
                          : `${cap.committedWorkloadUnits.toFixed(1)}/${cap.maxCapacityUnits.toFixed(1)}u`}
                      </span>
                      <span className="truncate max-w-[65px]">
                        {cap.committedOrderCount} {cap.committedOrderCount === 1 ? "cake" : "cakes"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. FILTERS & SEARCH ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-border/50">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search customer, ID, flavor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all_active">All Active Statuses</option>
            <option value="accepted">Accepted (Confirmed)</option>
            <option value="in_baking">In Baking</option>
            <option value="ready">Ready for Pickup</option>
            <option value="quoted">Quoted</option>
            <option value="under_review">Under Review</option>
            <option value="submitted">Submitted</option>
            {showCompleted && <option value="completed">Completed</option>}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent Only</option>
            <option value="high">High Priority</option>
            <option value="normal">Normal Priority</option>
          </select>

          {/* Staff Assignment Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="h-8 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Staff</option>
            <option value="unassigned">⚠️ Unassigned Staff</option>
            {user?.id && <option value="my_work">👤 My Assigned Work</option>}
            {staffList.length > 0 && (
              <optgroup label="Staff Members">
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getStaffDisplayName(s)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Scheduling State Filter */}
          <div className="flex items-center gap-2">
            <select
              value={schedulingFilter}
              onChange={(e) => setSchedulingFilter(e.target.value)}
              className="flex-1 h-8 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Schedules</option>
              <option value="fully_scheduled">Fully Scheduled</option>
              <option value="partially_scheduled">Partially Scheduled</option>
              <option value="unscheduled">Unscheduled</option>
            </select>

            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                showCompleted
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle inclusion of completed orders"
            >
              {showCompleted ? "Hide Done" : "+ Done"}
            </button>
          </div>
        </div>
      </div>

      {/* 5. MAIN CALENDAR BOARD */}
      {viewMode === "week" ? (
        /* WEEK VIEW (7 COLUMNS WITH CAPACITY METERS) */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3.5">
          {weekDays.map((day) => {
            const cap = weekCapacityMap.get(day.ymd);
            const isBlackout = cap?.isBlackout || false;
            const staffSummary = getStaffWorkloadSummary(day.ymd, staffList, orders);

            // Find orders with bake activity on this day
            const bakeOrders = filteredOrders.filter((o) => o.scheduled_bake_date === day.ymd);

            // Find orders with decorate activity on this day
            const decorateOrders = filteredOrders.filter(
              (o) => o.scheduled_decorate_date === day.ymd,
            );

            const progressWidth = isBlackout
              ? 0
              : Math.min(100, Math.max(0, cap?.utilizationPercent || 0));

            return (
              <div
                key={day.ymd}
                className={`flex flex-col rounded-3xl border bg-card/90 shadow-xs transition-all min-h-[460px] ${
                  day.isToday
                    ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
                    : cap?.state === "over_capacity"
                      ? "border-rose-500/40 bg-rose-500/[0.01]"
                      : cap?.state === "near_capacity"
                        ? "border-amber-500/40 bg-amber-500/[0.01]"
                        : isBlackout
                          ? "border-zinc-500/40 bg-zinc-500/[0.02]"
                          : "border-border/80"
                }`}
              >
                {/* Column Header with Capacity Meter */}
                <div
                  className={`p-3.5 border-b rounded-t-3xl ${
                    day.isToday
                      ? "bg-primary/10 border-primary/20"
                      : isBlackout
                        ? "bg-zinc-500/10 border-zinc-500/20"
                        : cap?.state === "over_capacity"
                          ? "bg-rose-500/10 border-rose-500/20"
                          : cap?.state === "near_capacity"
                            ? "bg-amber-500/10 border-amber-500/20"
                            : "bg-muted/30 border-border/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {day.dayName}
                      </span>
                      <h3 className="text-sm font-bold text-foreground">{day.dateDisplay}</h3>
                    </div>
                    {day.isToday ? (
                      <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold">
                        Today
                      </span>
                    ) : (
                      cap && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${cap.badgeClass}`}
                        >
                          {cap.isBlackout
                            ? "Closed"
                            : cap.state === "over_capacity"
                              ? "Over"
                              : cap.state === "near_capacity"
                                ? "Near"
                                : "OK"}
                        </span>
                      )
                    )}
                  </div>

                  {/* Blackout Warning Banner */}
                  {isBlackout && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-zinc-800/10 dark:bg-zinc-800 border border-zinc-500/30 p-1.5 text-[11px] font-medium text-foreground">
                      <Ban className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                      <span className="truncate font-semibold" title={cap?.blackoutReason}>
                        {cap?.blackoutReason || "Bakery Closed"}
                      </span>
                    </div>
                  )}

                  {/* Daily Capacity Progress Bar */}
                  {!isBlackout && cap && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-foreground">
                          {cap.committedWorkloadUnits.toFixed(1)} /{" "}
                          {cap.maxCapacityUnits.toFixed(1)} u
                        </span>
                        <span className="font-bold text-muted-foreground">
                          {Math.round(cap.utilizationPercent)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${cap.progressBarClass}`}
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Station Task Breakdown */}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-1.5 border-t border-border/40">
                    <span className="text-purple-700 dark:text-purple-300 font-semibold">
                      🥣 {bakeOrders.length} Bakes
                    </span>
                    <span className="text-pink-700 dark:text-pink-300 font-semibold">
                      ✨ {decorateOrders.length} Decor
                    </span>
                  </div>

                  {/* Staff Assignment & Workload Summary Indicator */}
                  {(staffSummary.unassignedBakersCount > 0 ||
                    staffSummary.unassignedDecoratorsCount > 0 ||
                    staffSummary.overloadedStaffCount > 0) && (
                    <div className="mt-1.5 flex items-center justify-between text-[9px] font-medium pt-1 border-t border-border/30">
                      {staffSummary.overloadedStaffCount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          🔥 {staffSummary.overloadedStaffCount} overload
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Staff Load OK</span>
                      )}
                      {(staffSummary.unassignedBakersCount > 0 ||
                        staffSummary.unassignedDecoratorsCount > 0) && (
                        <span
                          className="text-amber-600 dark:text-amber-400 font-semibold"
                          title="Unassigned baker or decorator roles on this date"
                        >
                          ⚠️{" "}
                          {staffSummary.unassignedBakersCount +
                            staffSummary.unassignedDecoratorsCount}{" "}
                          unassigned
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Tasks Body */}
                <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[620px]">
                  {bakeOrders.length === 0 && decorateOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/60">
                      <Calendar className="h-6 w-6 stroke-1 mb-1" />
                      <p className="text-[11px]">No tasks scheduled</p>
                    </div>
                  ) : (
                    <>
                      {/* 1. BAKE ACTIVITY CARDS */}
                      {bakeOrders.map((order) => (
                        <OrderCalendarCard
                          key={`bake-${order.id}`}
                          order={order}
                          activity="bake"
                          onEditSchedule={() => handleOpenScheduleEditor(order)}
                          onViewDetails={() => setViewingOrder(order)}
                          bakerName={getStaffName(order.assigned_baker_id)}
                          decoratorName={getStaffName(order.assigned_decorator_id)}
                        />
                      ))}

                      {/* 2. DECORATE ACTIVITY CARDS (Only if decorate date is separate from bake date) */}
                      {decorateOrders
                        .filter((o) => o.scheduled_bake_date !== day.ymd)
                        .map((order) => (
                          <OrderCalendarCard
                            key={`decorate-${order.id}`}
                            order={order}
                            activity="decorate"
                            onEditSchedule={() => handleOpenScheduleEditor(order)}
                            onViewDetails={() => setViewingOrder(order)}
                            bakerName={getStaffName(order.assigned_baker_id)}
                            decoratorName={getStaffName(order.assigned_decorator_id)}
                          />
                        ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DAY VIEW (DEEP-DIVE CAPACITY RUN SHEET) */
        <div className="space-y-6">
          {/* Day View Summary Card */}
          {(() => {
            const cap = selectedDayCapacity;
            const isBlackout = cap.isBlackout;
            const bakeOrders = filteredOrders.filter(
              (o) => o.scheduled_bake_date === selectedDateYMD,
            );
            const decorateOrders = filteredOrders.filter(
              (o) => o.scheduled_decorate_date === selectedDateYMD,
            );
            const progressWidth = isBlackout
              ? 0
              : Math.min(100, Math.max(0, cap.utilizationPercent));

            return (
              <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Daily Production & Capacity Breakdown
                    </span>
                    <h2 className="text-xl font-bold text-foreground">
                      {formatDisplayDate(selectedDateYMD, "long")}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="rounded-2xl bg-secondary/60 border border-border px-3.5 py-1.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Committed Cakes
                      </p>
                      <p className="text-sm font-bold text-foreground">{cap.committedOrderCount}</p>
                    </div>

                    <div className="rounded-2xl bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-center">
                      <p className="text-[10px] text-primary uppercase font-bold">Workload</p>
                      <p className="text-sm font-bold text-primary">
                        {cap.committedWorkloadUnits.toFixed(1)} / {cap.maxCapacityUnits.toFixed(1)}{" "}
                        u
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl border px-3.5 py-1.5 text-center ${cap.badgeClass}`}
                    >
                      <p className="text-[10px] uppercase font-bold">Capacity State</p>
                      <p className="text-sm font-bold">{cap.stateLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Capacity Progress Bar for Day */}
                {!isBlackout && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Capacity Utilization</span>
                      <span className="font-bold text-foreground">
                        {cap.committedWorkloadUnits.toFixed(1)} / {cap.maxCapacityUnits.toFixed(1)}{" "}
                        units ({Math.round(cap.utilizationPercent)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${cap.progressBarClass}`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                    {cap.state === "over_capacity" && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        ⚠️ Notice: This day is currently {Math.abs(cap.remainingUnits).toFixed(1)}{" "}
                        units over configured capacity.
                      </p>
                    )}
                  </div>
                )}

                {isBlackout && (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                    <Ban className="h-4 w-4 flex-shrink-0" />
                    <div>
                      <span className="font-bold">Bakery Blackout / Closure Notice: </span>
                      {cap.blackoutReason}
                      {cap.hasBlackoutConflict && (
                        <span className="block mt-0.5 text-rose-700 dark:text-rose-400 font-bold">
                          ⚠️ {cap.committedOrderCount} orders are currently scheduled on this closed
                          date.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Two Swimlanes: Baking Station vs Decorating Station */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Station 1: Baking & Preparation */}
                  <div className="rounded-2xl bg-purple-500/[0.03] border border-purple-500/20 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-700">
                          <ChefHat className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">Baking Station</h3>
                      </div>
                      <span className="text-xs font-semibold text-purple-700 bg-purple-500/15 px-2.5 py-0.5 rounded-full">
                        {bakeOrders.length} Bakes ({cap.bakeWorkloadUnits.toFixed(1)}u)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {bakeOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No cake baking scheduled for this date.
                        </p>
                      ) : (
                        bakeOrders.map((order) => (
                          <OrderCalendarCard
                            key={`day-bake-${order.id}`}
                            order={order}
                            activity="bake"
                            onEditSchedule={() => handleOpenScheduleEditor(order)}
                            onViewDetails={() => setViewingOrder(order)}
                            bakerName={getStaffName(order.assigned_baker_id)}
                            decoratorName={getStaffName(order.assigned_decorator_id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Station 2: Assembly & Decorating */}
                  <div className="rounded-2xl bg-pink-500/[0.03] border border-pink-500/20 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-pink-500/20">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 text-pink-700">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">Decorating Station</h3>
                      </div>
                      <span className="text-xs font-semibold text-pink-700 bg-pink-500/15 px-2.5 py-0.5 rounded-full">
                        {decorateOrders.length} Decorating ({cap.decorateWorkloadUnits.toFixed(1)}u)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {decorateOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No cake decorating scheduled for this date.
                        </p>
                      ) : (
                        decorateOrders.map((order) => (
                          <OrderCalendarCard
                            key={`day-decorate-${order.id}`}
                            order={order}
                            activity="decorate"
                            onEditSchedule={() => handleOpenScheduleEditor(order)}
                            onViewDetails={() => setViewingOrder(order)}
                            bakerName={getStaffName(order.assigned_baker_id)}
                            decoratorName={getStaffName(order.assigned_decorator_id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Staff Workload & Assignment Distribution (Phase 7E) */}
                {(() => {
                  const staffSummary = getStaffWorkloadSummary(selectedDateYMD, staffList, orders);
                  return (
                    <div className="rounded-2xl bg-card border border-border/80 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">
                              Staff Workload Distribution
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                              Daily guideline: {DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE.toFixed(1)}{" "}
                              units/person • {staffSummary.activeStaffCount} active staff
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          {staffSummary.overloadedStaffCount > 0 && (
                            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 font-bold">
                              ⚠️ {staffSummary.overloadedStaffCount} Overloaded
                            </span>
                          )}
                          {(staffSummary.unassignedBakersCount > 0 ||
                            staffSummary.unassignedDecoratorsCount > 0) && (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 font-medium">
                              ⚠️{" "}
                              {staffSummary.unassignedBakersCount +
                                staffSummary.unassignedDecoratorsCount}{" "}
                              Unassigned Role(s)
                            </span>
                          )}
                        </div>
                      </div>

                      {staffList.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No admin staff profiles found.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {staffSummary.staffWorkloads.map((sw) => (
                            <div
                              key={sw.staffId}
                              className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${
                                sw.state === "overloaded"
                                  ? "bg-rose-500/[0.04] border-rose-500/40"
                                  : sw.state === "near_guideline"
                                    ? "bg-amber-500/[0.04] border-amber-500/40"
                                    : "bg-muted/20 border-border/70"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className="font-bold text-xs text-foreground truncate max-w-[140px]"
                                  title={sw.staffName}
                                >
                                  👤 {sw.staffName}
                                </span>
                                <span
                                  className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 border ${sw.badgeClass}`}
                                >
                                  {sw.stateLabel}
                                </span>
                              </div>

                              {/* Progress bar vs 6.0u guideline */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-semibold text-foreground">
                                    {sw.totalPhysicalWorkloadUnits.toFixed(1)} /{" "}
                                    {sw.guidelineUnits.toFixed(1)} u
                                  </span>
                                  <span className="font-bold text-muted-foreground">
                                    {Math.round(sw.utilizationPercent)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${sw.progressBarClass}`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, sw.utilizationPercent))}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Task count breakdown */}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                <span className="text-purple-700 dark:text-purple-300 font-medium">
                                  🥣 {sw.bakeTaskCount} Bake
                                </span>
                                <span className="text-pink-700 dark:text-pink-300 font-medium">
                                  ✨ {sw.decorateTaskCount} Decor
                                </span>
                                <span className="font-semibold text-foreground">
                                  {sw.totalDistinctOrdersCount}{" "}
                                  {sw.totalDistinctOrdersCount === 1 ? "cake" : "cakes"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. CAPACITY & BLACKOUT SETTINGS MODAL */}
      {showCapacitySettingsModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowCapacitySettingsModal(false)}
            aria-hidden="true"
          />
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl border border-border overflow-hidden my-auto z-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Kitchen Capacity & Blackout Management
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure daily cake unit limits & manage bakery blackout dates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCapacitySettingsModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Section 1: Weekday Capacity Limits Form */}
              <form onSubmit={handleSaveCapacitySettings} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    Daily Workload Capacity Limits (Units / Day)
                  </h4>
                  <span className="text-[10px] text-muted-foreground">Default: 8.0 units/day</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {WEEKDAY_NAMES.map((name, index) => (
                    <div
                      key={`weekday-${index}`}
                      className="rounded-2xl bg-muted/20 border border-border p-2.5 space-y-1"
                    >
                      <label className="text-[11px] font-semibold text-foreground block">
                        {name}
                      </label>
                      <Input
                        type="number"
                        step="0.5"
                        min="1.0"
                        max="50.0"
                        value={capacityForm[index] ?? 8.0}
                        onChange={(e) =>
                          setCapacityForm((prev) => ({
                            ...prev,
                            [index]: parseFloat(e.target.value) || 8.0,
                          }))
                        }
                        className="h-8 text-xs font-bold bg-background"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isSavingCapacitySettings}
                    size="sm"
                    className="rounded-full gap-1.5 text-xs bg-primary text-primary-foreground shadow-xs cursor-pointer"
                  >
                    {isSavingCapacitySettings ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Capacity...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Save Weekday Limits</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Section 2: Bakery Blackout Dates Manager */}
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Ban className="h-3.5 w-3.5 text-rose-500" />
                    Bakery Blackout & Closure Dates
                  </h4>
                  <span className="text-[10px] text-muted-foreground">
                    {blackoutDates.length} Blackouts Configured
                  </span>
                </div>

                {/* Add Blackout Form */}
                <form onSubmit={handleAddBlackoutDate} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="date"
                    value={newBlackoutDate}
                    onChange={(e) => setNewBlackoutDate(e.target.value)}
                    className="h-8 text-xs rounded-xl sm:w-40 bg-background"
                    placeholder="Date"
                  />
                  <Input
                    type="text"
                    value={newBlackoutReason}
                    onChange={(e) => setNewBlackoutReason(e.target.value)}
                    placeholder="Reason (e.g., Poya Holiday, Deep Clean)"
                    className="h-8 text-xs rounded-xl flex-1 bg-background"
                  />
                  <Button
                    type="submit"
                    disabled={isAddingBlackout}
                    size="sm"
                    className="h-8 rounded-xl gap-1 text-xs bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
                  >
                    {isAddingBlackout ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Add Blackout</span>
                  </Button>
                </form>

                {/* Existing Blackouts List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {blackoutDates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 italic">
                      No blackout dates currently registered.
                    </p>
                  ) : (
                    blackoutDates.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-xl bg-muted/30 border border-border px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Ban className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                          <span className="font-bold text-foreground whitespace-nowrap">
                            {formatDisplayDate(b.blackout_date, "medium")}
                          </span>
                          <span className="text-muted-foreground truncate">— {b.reason}</span>
                        </div>
                        <Button
                          onClick={() => b.id && handleDeleteBlackoutDate(b.id, b.blackout_date)}
                          disabled={deletingBlackoutId === b.id}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Remove Blackout Date"
                        >
                          {deletingBlackoutId === b.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. UNSCHEDULED ORDERS DRAWER / SIDE SHEET */}
      {showUnscheduledDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowUnscheduledDrawer(false)}
            aria-hidden="true"
          />
          <div className="relative flex w-full max-w-md flex-col bg-card border-l border-border shadow-2xl z-50 p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                  <ChefHat className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Unscheduled Orders</h3>
                  <p className="text-xs text-muted-foreground">
                    {unscheduledOrders.length} active orders need dates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnscheduledDrawer(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 flex-1">
              {unscheduledOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-foreground">All Orders Scheduled!</p>
                  <p className="text-xs mt-1">
                    Every active custom cake has baking & decorating dates.
                  </p>
                </div>
              ) : (
                unscheduledOrders.map((order) => {
                  const hasBake = !!order.scheduled_bake_date;
                  const hasDecorate = !!order.scheduled_decorate_date;
                  const readiness = getProductionReadiness(order);

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-primary">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                              {order.customer_name}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Event:{" "}
                            <span className="font-medium text-foreground">
                              {formatDisplayDate(order.event_date, "short")}
                            </span>{" "}
                            ({order.event_type})
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${readiness.badgeClass}`}
                        >
                          {readiness.label}
                        </span>
                      </div>

                      {/* Missing Indicators */}
                      <div className="flex items-center gap-2 text-[11px]">
                        {!hasBake && !hasDecorate ? (
                          <span className="rounded-md bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2 py-0.5 font-medium">
                            Missing Bake & Decorate Dates
                          </span>
                        ) : !hasBake ? (
                          <span className="rounded-md bg-purple-500/10 text-purple-700 border border-purple-500/20 px-2 py-0.5 font-medium">
                            Missing Bake Date
                          </span>
                        ) : (
                          <span className="rounded-md bg-pink-500/10 text-pink-700 border border-pink-500/20 px-2 py-0.5 font-medium">
                            Missing Decorate Date
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        "{order.cake_details}"
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                        <Button
                          onClick={() => {
                            setShowUnscheduledDrawer(false);
                            handleOpenScheduleEditor(order);
                          }}
                          size="sm"
                          className="rounded-full gap-1 text-xs bg-primary text-primary-foreground shadow-xs cursor-pointer"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Schedule Order</span>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. SCHEDULING EDITOR MODAL WITH LIVE CAPACITY PREVIEW */}
      {editingOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={handleCloseScheduleEditor} aria-hidden="true" />
          <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-card shadow-2xl border border-border overflow-hidden my-auto z-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Schedule Order #{editingOrder.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editingOrder.customer_name} • Event Date:{" "}
                    {formatDisplayDate(editingOrder.event_date, "medium")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseScheduleEditor}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveSchedule} className="p-6 space-y-5 overflow-y-auto">
              {/* Event Reference Card */}
              <div className="rounded-2xl bg-secondary/40 border border-border/80 p-3.5 space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Customer Event: {editingOrder.event_type}</span>
                  <span className="text-primary font-bold">
                    {formatDisplayDate(editingOrder.event_date, "long")}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2">
                  Specs: {editingOrder.cake_details}
                </p>
              </div>

              {/* 1. Scheduled Bake Date */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ChefHat className="h-3.5 w-3.5 text-purple-600" />
                    Scheduled Bake Date (Sponge Preparation)
                  </label>
                  {formBakeDate && (
                    <button
                      type="button"
                      onClick={() => setFormBakeDate("")}
                      className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Input
                  type="date"
                  value={formBakeDate}
                  onChange={(e) => setFormBakeDate(e.target.value)}
                  className="rounded-xl text-xs bg-background"
                />
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-muted-foreground">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleSetBakePreset(2)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-foreground cursor-pointer"
                  >
                    2 Days Prior
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetBakePreset(1)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-foreground cursor-pointer"
                  >
                    1 Day Prior
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetBakePreset(0)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-foreground cursor-pointer"
                  >
                    Event Day
                  </button>
                </div>
              </div>

              {/* 2. Scheduled Decorate Date */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-pink-600" />
                    Scheduled Decorate Date (Assembly & Icing)
                  </label>
                  {formDecorateDate && (
                    <button
                      type="button"
                      onClick={() => setFormDecorateDate("")}
                      className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Input
                  type="date"
                  value={formDecorateDate}
                  onChange={(e) => setFormDecorateDate(e.target.value)}
                  className="rounded-xl text-xs bg-background"
                />
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-muted-foreground">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleSetDecoratePreset(1)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-foreground cursor-pointer"
                  >
                    1 Day Prior
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDecoratePreset(0)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-foreground cursor-pointer"
                  >
                    Event Day
                  </button>
                  {formBakeDate && (
                    <button
                      type="button"
                      onClick={() => setFormDecorateDate(formBakeDate)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-foreground cursor-pointer"
                    >
                      Same as Bake Date
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Target Pickup Time & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Pickup Time */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Target Pickup Time
                    </label>
                    {formPickupTime && (
                      <button
                        type="button"
                        onClick={() => setFormPickupTime("")}
                        className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Input
                    type="time"
                    value={formPickupTime}
                    onChange={(e) => setFormPickupTime(e.target.value)}
                    className="rounded-xl text-xs bg-background"
                  />
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setFormPickupTime("10:00")}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                    >
                      10:00 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPickupTime("14:00")}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                    >
                      2:00 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPickupTime("17:00")}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                    >
                      5:00 PM
                    </button>
                  </div>
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-600" />
                    Production Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* 4. Complexity Units */}
              <div className="space-y-2 rounded-2xl bg-muted/20 border border-border p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Complexity / Workload Units:{" "}
                    <span className="text-primary font-bold">
                      {Number(formComplexity).toFixed(1)} Units
                    </span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">Range: 0.5 – 10.0</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10.0"
                  step="0.5"
                  value={formComplexity}
                  onChange={(e) => setFormComplexity(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                  <button
                    type="button"
                    onClick={() => setFormComplexity(1.0)}
                    className="hover:text-primary cursor-pointer"
                  >
                    1.0u (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormComplexity(2.0)}
                    className="hover:text-primary cursor-pointer"
                  >
                    2.0u (2-Tier)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormComplexity(4.0)}
                    className="hover:text-primary cursor-pointer"
                  >
                    4.0u (3+ Tiers)
                  </button>
                </div>
              </div>

              {/* 5. Staff Assignees (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-purple-600" />
                    Assigned Baker (Optional)
                  </label>
                  <select
                    value={formBakerId}
                    onChange={(e) => setFormBakerId(e.target.value)}
                    className="w-full h-8 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-pink-600" />
                    Assigned Decorator (Optional)
                  </label>
                  <select
                    value={formDecoratorId}
                    onChange={(e) => setFormDecoratorId(e.target.value)}
                    className="w-full h-8 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5b. Live Staff Workload Impact Previews & Overload Notices (Phase 7E) */}
              {(bakerStaffPreview || decoratorStaffPreview) && (
                <div className="space-y-2">
                  {bakerStaffPreview && (
                    <div
                      className={`rounded-2xl border p-3 space-y-1.5 text-xs ${
                        bakerStaffPreview.isOverloaded
                          ? "bg-rose-500/[0.04] border-rose-500/40"
                          : "bg-purple-500/[0.04] border-purple-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <ChefHat className="h-3.5 w-3.5" />
                          Baker Workload: {bakerStaffPreview.currentWorkload.toFixed(1)}u →{" "}
                          {bakerStaffPreview.newWorkload.toFixed(1)} /{" "}
                          {bakerStaffPreview.guideline.toFixed(1)} u
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            bakerStaffPreview.isOverloaded
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          }`}
                        >
                          {Math.round(bakerStaffPreview.newUtilization)}% Load
                        </span>
                      </div>
                      {bakerStaffPreview.warningMessage && (
                        <div
                          className={`flex items-start gap-1.5 rounded-xl p-2 text-[11px] ${
                            bakerStaffPreview.isOverloaded
                              ? "bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20"
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                          <span>{bakerStaffPreview.warningMessage}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {decoratorStaffPreview && (
                    <div
                      className={`rounded-2xl border p-3 space-y-1.5 text-xs ${
                        decoratorStaffPreview.isOverloaded
                          ? "bg-rose-500/[0.04] border-rose-500/40"
                          : "bg-pink-500/[0.04] border-pink-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-pink-700 dark:text-pink-300 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Decorator Workload: {decoratorStaffPreview.currentWorkload.toFixed(1)}u →{" "}
                          {decoratorStaffPreview.newWorkload.toFixed(1)} /{" "}
                          {decoratorStaffPreview.guideline.toFixed(1)} u
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            decoratorStaffPreview.isOverloaded
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          }`}
                        >
                          {Math.round(decoratorStaffPreview.newUtilization)}% Load
                        </span>
                      </div>
                      {decoratorStaffPreview.warningMessage && (
                        <div
                          className={`flex items-start gap-1.5 rounded-xl p-2 text-[11px] ${
                            decoratorStaffPreview.isOverloaded
                              ? "bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20"
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                          <span>{decoratorStaffPreview.warningMessage}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 6. LIVE CAPACITY IMPACT & OVER-CAPACITY / BLACKOUT NOTICE */}
              {scheduleImpact && (
                <div className="rounded-2xl border p-3.5 space-y-2 text-xs transition-all">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-muted-foreground">Capacity Impact Preview:</span>
                    <span className="text-foreground">
                      {scheduleImpact.currentWorkload.toFixed(1)}u →{" "}
                      <span
                        className={
                          scheduleImpact.isOverCapacity
                            ? "text-rose-600 font-bold"
                            : "text-primary font-bold"
                        }
                      >
                        {scheduleImpact.newWorkload.toFixed(1)} /{" "}
                        {scheduleImpact.maxCapacity.toFixed(1)} u
                      </span>{" "}
                      ({Math.round(scheduleImpact.newUtilization)}%)
                    </span>
                  </div>

                  {scheduleImpact.warningMessage && (
                    <div
                      className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
                        scheduleImpact.isBlackout
                          ? "bg-zinc-800 text-white dark:bg-zinc-800"
                          : "bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <span className="font-bold">
                          {scheduleImpact.isBlackout
                            ? "Bakery Closed Warning: "
                            : "Workload Notice: "}
                        </span>
                        <span>{scheduleImpact.warningMessage}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Validation Alerts */}
              {formBakeDate && formDecorateDate && formDecorateDate < formBakeDate && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Validation Error: Decorate date cannot be before bake date.</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <Button
                  type="button"
                  onClick={() => {
                    handleCloseScheduleEditor();
                    setViewingOrder(editingOrder);
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  <span>Order Specs</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleCloseScheduleEditor}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSavingSchedule ||
                      Boolean(formBakeDate && formDecorateDate && formDecorateDate < formBakeDate)
                    }
                    size="sm"
                    className={`rounded-full gap-1.5 text-xs shadow-xs cursor-pointer ${
                      scheduleImpact?.requiresConfirmation
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {isSavingSchedule ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : scheduleImpact?.requiresConfirmation ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Save Anyway (Override)</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Save Schedule</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. FULL ORDER DETAILS VIEW MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setViewingOrder(null)} aria-hidden="true" />
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl border border-border overflow-hidden my-auto z-10">
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Order Details #{viewingOrder.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p className="text-xs text-muted-foreground">{viewingOrder.customer_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Customer Contact & Status Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-muted/20 border border-border p-4 text-xs">
                <div>
                  <p className="text-muted-foreground font-medium">Customer</p>
                  <p className="font-bold text-foreground text-sm">{viewingOrder.customer_name}</p>
                  <p className="text-muted-foreground">{viewingOrder.customer_email}</p>
                  {viewingOrder.customer_phone && (
                    <div className="flex items-center gap-2 mt-2">
                      <a
                        href={getWhatsAppUrl(viewingOrder.customer_phone) || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" /> WhatsApp
                      </a>
                      <a
                        href={getEmailMailtoUrl(viewingOrder.customer_email)}
                        className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" /> Email
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground font-medium">Event & Status</p>
                  <p className="font-bold text-foreground">{viewingOrder.event_type}</p>
                  <p className="text-muted-foreground">
                    Event Date:{" "}
                    <span className="font-semibold text-foreground">
                      {formatDisplayDate(viewingOrder.event_date, "long")}
                    </span>
                  </p>
                  <div className="pt-1 flex items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                      {viewingOrder.status}
                    </span>
                    <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {getPriorityBadge(viewingOrder.production_priority).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cake Details */}
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-foreground">Cake Specifications & Design</h4>
                <div className="rounded-2xl bg-secondary/30 border border-border/80 p-3.5 text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {viewingOrder.cake_details}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-xl bg-card border border-border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Quoted Price
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatLKR(viewingOrder.quoted_price_lkr)}
                  </p>
                </div>
                <div className="rounded-xl bg-card border border-border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Deposit Req.
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatLKR(viewingOrder.deposit_amount_lkr)}
                  </p>
                </div>
                <div className="rounded-xl bg-card border border-border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Amount Paid
                  </p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatLKR(viewingOrder.amount_paid_lkr)}
                  </p>
                </div>
              </div>

              {/* Current Schedule Breakdown */}
              <div className="rounded-2xl bg-primary/[0.03] border border-primary/20 p-4 space-y-2 text-xs">
                <h4 className="font-bold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Current Kitchen Schedule & Workload
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
                  <div>
                    <span className="font-medium">Scheduled Bake: </span>
                    <span className="font-semibold text-foreground">
                      {formatDisplayDate(viewingOrder.scheduled_bake_date, "medium")}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Scheduled Decorate: </span>
                    <span className="font-semibold text-foreground">
                      {formatDisplayDate(viewingOrder.scheduled_decorate_date, "medium")}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Target Pickup: </span>
                    <span className="font-semibold text-foreground">
                      {formatTimeDisplay(viewingOrder.target_pickup_time) || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Workload Units: </span>
                    <span className="font-semibold text-foreground">
                      {Number(viewingOrder.complexity_units || 1.0).toFixed(1)} u
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  onClick={() => {
                    setViewingOrder(null);
                    handleOpenScheduleEditor(viewingOrder);
                  }}
                  size="sm"
                  className="rounded-full gap-1 text-xs bg-primary text-primary-foreground shadow-xs cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Edit Schedule</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. DAILY MANAGEMENT PRINT BRIEFING MODAL */}
      {showDailyManagementModal && (
        <DailyManagementSummaryModal
          orders={orders as any}
          selectedDate={selectedDateYMD}
          staffList={staffList}
          capacitySettings={capacitySettings}
          blackoutDates={blackoutDates}
          onClose={() => setShowDailyManagementModal(false)}
        />
      )}
    </div>
  );
}

// ==============================================================================
// SUB-COMPONENT: ORDER CALENDAR CARD
// ==============================================================================

interface OrderCalendarCardProps {
  order: SchedulingOrder;
  activity: "bake" | "decorate";
  onEditSchedule: () => void;
  onViewDetails: () => void;
  bakerName: string;
  decoratorName: string;
}

function OrderCalendarCard({
  order,
  activity,
  onEditSchedule,
  onViewDetails,
  bakerName,
  decoratorName,
}: OrderCalendarCardProps) {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const priorityBadge = getPriorityBadge(order.production_priority);
  const readiness = getProductionReadiness(order);
  const paymentInfo = getPaymentBadgeInfo(order);

  const isBake = activity === "bake";

  return (
    <div
      onClick={onEditSchedule}
      className={`group relative rounded-2xl border p-3 transition-all shadow-2xs hover:shadow-md cursor-pointer ${
        isBake
          ? "border-purple-500/30 bg-card hover:border-purple-500 hover:bg-purple-500/[0.02]"
          : "border-pink-500/30 bg-card hover:border-pink-500 hover:bg-pink-500/[0.02]"
      }`}
    >
      {/* Card Header: Activity Badge & Order ID */}
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
            isBake
              ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
              : "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30"
          }`}
        >
          {isBake ? <ChefHat className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {isBake ? "BAKE" : "DECORATE"}
        </span>

        <span className="font-mono text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
          #{shortId}
        </span>
      </div>

      {/* Customer Name & Event */}
      <div className="mt-2">
        <h4 className="text-xs font-bold text-foreground truncate" title={order.customer_name}>
          {order.customer_name}
        </h4>
        <p className="text-[11px] text-muted-foreground truncate">
          {order.event_type} • Due:{" "}
          <span className="font-medium text-foreground">
            {formatDisplayDate(order.event_date, "short")}
          </span>
        </p>
      </div>

      {/* Target Time / Staff Assignee */}
      {(order.target_pickup_time || (isBake ? bakerName : decoratorName)) && (
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          {order.target_pickup_time && (
            <span className="flex items-center gap-1 font-semibold text-primary">
              <Clock className="h-2.5 w-2.5" />
              {formatTimeDisplay(order.target_pickup_time)}
            </span>
          )}
          {(isBake ? bakerName : decoratorName) && (
            <span
              className="truncate max-w-[90px] font-medium"
              title={isBake ? bakerName : decoratorName}
            >
              👤 {isBake ? bakerName : decoratorName}
            </span>
          )}
        </div>
      )}

      {/* Badges Footer */}
      <div className="mt-2 flex items-center justify-between gap-1 pt-1.5 border-t border-border/40 text-[10px]">
        {/* Priority & Complexity */}
        <div className="flex items-center gap-1">
          {order.production_priority && order.production_priority !== "normal" && (
            <span
              className={`rounded-md px-1.5 py-0.2 font-bold border ${priorityBadge.badgeClass}`}
            >
              {priorityBadge.label}
            </span>
          )}
          <span className="rounded-md bg-secondary/80 text-foreground px-1.5 py-0.2 font-medium">
            {Number(order.complexity_units || 1.0).toFixed(1)}u
          </span>
        </div>

        {/* Readiness indicator dot */}
        <div
          className="flex items-center gap-1"
          title={`${readiness.label} (${paymentInfo.label})`}
        >
          <span className={`h-2 w-2 rounded-full ${readiness.dotClass}`} />
          <span className="text-[10px] text-muted-foreground capitalize truncate max-w-[70px]">
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>
    </div>
  );
}
