import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  PackageCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Printer,
  Sparkles,
  User,
  Phone,
  FileText,
  ChevronRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Download,
  Filter,
  DollarSign,
  AlertTriangle,
  Receipt,
  CreditCard,
  Banknote,
  Flame,
  Layers,
  Timer,
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { DailyProductionSummaryModal } from "@/components/daily-production-summary-modal";
import {
  formatLKR,
  getProductionReadiness,
  getPaymentBadgeInfo,
  type ProductionReadinessKey,
} from "@/lib/order-readiness";
import { getStaffDisplayName, type StaffProfileInput } from "@/lib/staff-workload-utils";
import {
  calculateDailyCapacity,
  type KitchenCapacitySetting,
  type BakeryBlackoutDate,
  type DailyCapacityResult,
  DEFAULT_WEEKDAY_CAPACITY_FALLBACK,
} from "@/lib/capacity-utils";
import {
  getLocalDateString,
  getOverdueInfo,
  getAtRiskInfo,
  isBakingTaskForDate,
  isDecoratingTaskForDate,
  isDispatchTaskForDate,
  formatProductionDuration,
  getPriorityRank,
  sortKitchenOrders,
  type KitchenWorkstation,
  type KitchenOperationalFilter,
  type KitchenOrderInput,
} from "@/lib/kitchen-operations-utils";

export interface KitchenOrder extends KitchenOrderInput {
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

interface KitchenProductionViewProps {
  orders: KitchenOrder[];
  onUpdateStatus: (orderId: string, nextStatus: string) => Promise<void>;
  onOpenOrder: (order: KitchenOrder) => void;
  onPrintTicket: (order: KitchenOrder) => void;
  updatingOrderId: string | null;
  staffList?: StaffProfileInput[] | undefined;
  currentUserId?: string | undefined;
  capacitySettings?: KitchenCapacitySetting[] | undefined;
  blackoutDates?: BakeryBlackoutDate[] | undefined;
}

export function KitchenProductionView({
  orders,
  onUpdateStatus,
  onOpenOrder,
  onPrintTicket,
  updatingOrderId,
  staffList = [],
  currentUserId,
  capacitySettings = [],
  blackoutDates = [],
}: KitchenProductionViewProps) {
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<KitchenOperationalFilter>("all");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [nowTime, setNowTime] = useState<number>(Date.now());

  // Periodic timer for live production duration counters (every 30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffProfileInput>();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  }, []);

  // Calculate Today's Global Capacity Utilization
  const todayCapacity: DailyCapacityResult = useMemo(() => {
    return calculateDailyCapacity(todayStr, orders, capacitySettings, blackoutDates);
  }, [todayStr, orders, capacitySettings, blackoutDates]);

  // CSV Export with local date filename and operational metadata
  const handleExportKitchenSchedule = () => {
    const activeOrders = orders.filter((o) => {
      const s = o.status.toLowerCase();
      return s !== "completed" && s !== "declined" && s !== "cancelled";
    });

    const headers = [
      "Order ID",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Event Type",
      "Event Date",
      "Scheduled Bake Date",
      "Scheduled Decorate Date",
      "Target Pickup Time",
      "Priority",
      "Complexity (Units)",
      "Assigned Baker",
      "Assigned Decorator",
      "Workflow Status",
      "Production Readiness",
      "Quoted Price (LKR)",
      "Deposit Required (LKR)",
      "Amount Paid (LKR)",
      "Balance Due (LKR)",
      "Payment Status",
      "Payment Method",
      "Production Started At",
      "Production Completed At",
      "Production Duration",
      "Operational State",
      "Cake Specifications",
      "Bakery / Kitchen Notes",
      "Order Created At",
    ];

    const rows = activeOrders.map((o) => {
      const readiness = getProductionReadiness(o);
      const quoted = Number(o.quoted_price_lkr || 0);
      const deposit = Number(o.deposit_amount_lkr || 0);
      const paid = Number(o.amount_paid_lkr || 0);
      const balanceDue = quoted > 0 ? Math.max(0, quoted - paid) : 0;
      const paymentInfo = getPaymentBadgeInfo(o);
      const durationInfo = formatProductionDuration(o.production_started_at, o.production_completed_at, nowTime);
      const overdueInfo = getOverdueInfo(o, todayStr);
      const riskInfo = getAtRiskInfo(o, todayStr, tomorrowStr);

      let operationalFlag = "Normal";
      if (overdueInfo.isOverdue) operationalFlag = overdueInfo.label;
      else if (riskInfo.isAtRisk) operationalFlag = riskInfo.label;

      const bakerName = o.assigned_baker_id ? getStaffDisplayName(staffMap.get(o.assigned_baker_id)) : "Unassigned";
      const decoratorName = o.assigned_decorator_id ? getStaffDisplayName(staffMap.get(o.assigned_decorator_id)) : "Unassigned";

      return [
        o.id,
        o.customer_name,
        o.customer_email,
        o.customer_phone || "",
        o.event_type,
        o.event_date,
        o.scheduled_bake_date || "",
        o.scheduled_decorate_date || "",
        o.target_pickup_time || "",
        (o.production_priority || "normal").toUpperCase(),
        Number(o.complexity_units || 1.0).toFixed(1),
        bakerName,
        decoratorName,
        o.status,
        readiness.label,
        quoted > 0 ? quoted : "",
        deposit > 0 ? deposit : "",
        paid > 0 ? paid : 0,
        balanceDue,
        paymentInfo.label,
        o.payment_method || "",
        o.production_started_at || "",
        o.production_completed_at || "",
        durationInfo.formattedDuration,
        operationalFlag,
        o.cake_details,
        o.internal_notes || o.admin_notes || "",
        o.created_at,
      ];
    });

    const localDateFilename = `kitchen-schedule-${todayStr}.csv`;
    exportToCsv(localDateFilename, headers, rows);
  };

  // Categorize orders into kitchen sections, metrics, and queues
  const {
    bakingToday,
    readyToday,
    tomorrowOrders,
    upcomingThisWeek,
    metrics,
  } = useMemo(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = getLocalDateString(nextWeek);

    const activeBaking: KitchenOrder[] = [];
    const activeReady: KitchenOrder[] = [];
    const tomorrowList: KitchenOrder[] = [];
    const upcomingList: KitchenOrder[] = [];

    let awaitingDepositCount = 0;
    let readyForProdCount = 0;
    let fullyPaidCount = 0;
    let totalWorkloadUnits = 0;
    let myWorkCount = 0;
    let unassignedStaffCount = 0;
    let overdueCount = 0;
    let atRiskCount = 0;
    let urgentCount = 0;
    let bakingStationCount = 0;
    let decoratingStationCount = 0;
    let dispatchCount = 0;

    orders.forEach((order) => {
      const statusLower = order.status.toLowerCase();
      if (
        statusLower === "completed" ||
        statusLower === "declined" ||
        statusLower === "cancelled"
      ) {
        return; // Exclude terminal statuses from active kitchen production board
      }

      const readiness = getProductionReadiness(order);
      const isAwaitingDeposit = readiness.key === "awaiting_deposit" && statusLower === "accepted";
      const isReadyToBake = readiness.key === "ready_for_production";

      if (isAwaitingDeposit) awaitingDepositCount++;
      if (isReadyToBake) readyForProdCount++;

      const paymentInfo = getPaymentBadgeInfo(order);
      if (paymentInfo.isFullyPaid) fullyPaidCount++;

      if (statusLower === "accepted" || statusLower === "in_baking") {
        totalWorkloadUnits += Number(order.complexity_units || 1.0);
      }

      if (currentUserId && (order.assigned_baker_id === currentUserId || order.assigned_decorator_id === currentUserId)) {
        myWorkCount++;
      }

      const hasBaker = Boolean(order.assigned_baker_id && order.assigned_baker_id.trim());
      const hasDecorator = Boolean(order.assigned_decorator_id && order.assigned_decorator_id.trim());
      if (!hasBaker || !hasDecorator) {
        unassignedStaffCount++;
      }

      const overdueInfo = getOverdueInfo(order, todayStr);
      if (overdueInfo.isOverdue) overdueCount++;

      const riskInfo = getAtRiskInfo(order, todayStr, tomorrowStr);
      if (riskInfo.isAtRisk) atRiskCount++;

      if (order.production_priority === "urgent" || order.production_priority === "high") {
        urgentCount++;
      }

      if (isBakingTaskForDate(order, todayStr)) bakingStationCount++;
      if (isDecoratingTaskForDate(order, todayStr)) decoratingStationCount++;
      if (isDispatchTaskForDate(order)) dispatchCount++;

      const eventDate = order.event_date;
      const bakeDate = order.scheduled_bake_date;

      // 1. Baking Today: in_baking regardless of date, or bake scheduled today, or accepted with event <= today
      if (
        statusLower === "in_baking" ||
        bakeDate === todayStr ||
        (statusLower === "accepted" && (!bakeDate || bakeDate <= todayStr) && eventDate <= todayStr)
      ) {
        activeBaking.push(order);
      }
      // 2. Ready Today: ready for pickup / dispatch
      else if (statusLower === "ready" && eventDate <= todayStr) {
        activeReady.push(order);
      }
      // 3. Tomorrow's Orders
      else if (bakeDate === tomorrowStr || (!bakeDate && eventDate === tomorrowStr)) {
        tomorrowList.push(order);
      }
      // 4. Upcoming This Week (next 7 days)
      else if (
        (bakeDate && bakeDate > tomorrowStr && bakeDate <= nextWeekStr) ||
        (!bakeDate && eventDate > tomorrowStr && eventDate <= nextWeekStr)
      ) {
        upcomingList.push(order);
      }
      // Catch-all active orders
      else if (eventDate > nextWeekStr || (bakeDate && bakeDate > nextWeekStr)) {
        upcomingList.push(order);
      } else if (statusLower === "ready") {
        activeReady.push(order);
      }
    });

    return {
      bakingToday: sortKitchenOrders(activeBaking),
      readyToday: sortKitchenOrders(activeReady),
      tomorrowOrders: sortKitchenOrders(tomorrowList),
      upcomingThisWeek: sortKitchenOrders(upcomingList),
      metrics: {
        totalActive:
          activeBaking.length + activeReady.length + tomorrowList.length + upcomingList.length,
        bakingNow: activeBaking.length,
        readyNow: activeReady.length,
        upcoming: tomorrowList.length + upcomingList.length,
        awaitingDeposit: awaitingDepositCount,
        readyForProduction: readyForProdCount,
        fullyPaid: fullyPaidCount,
        totalWorkloadUnits: Math.round(totalWorkloadUnits * 10) / 10,
        myWorkCount,
        unassignedStaffCount,
        overdueCount,
        atRiskCount,
        urgentCount,
        bakingStationCount,
        decoratingStationCount,
        dispatchCount,
      },
    };
  }, [orders, currentUserId, todayStr, tomorrowStr]);

  // Operational Filter Matcher
  const filterOrder = (order: KitchenOrder): boolean => {
    // 1. Staff Filter (if specific staff member is selected)
    if (selectedStaffFilter !== "all") {
      if (selectedStaffFilter === "unassigned") {
        const hasBaker = Boolean(order.assigned_baker_id && order.assigned_baker_id.trim());
        const hasDecorator = Boolean(order.assigned_decorator_id && order.assigned_decorator_id.trim());
        if (hasBaker && hasDecorator) return false;
      } else if (selectedStaffFilter === "my_work") {
        if (!currentUserId) return false;
        if (order.assigned_baker_id !== currentUserId && order.assigned_decorator_id !== currentUserId) {
          return false;
        }
      } else {
        if (
          order.assigned_baker_id !== selectedStaffFilter &&
          order.assigned_decorator_id !== selectedStaffFilter
        ) {
          return false;
        }
      }
    }

    if (activeFilter === "all") return true;

    const statusLower = order.status.toLowerCase();
    const readiness = getProductionReadiness(order);

    if (activeFilter === "baking") {
      return isBakingTaskForDate(order, todayStr);
    }
    if (activeFilter === "decorating") {
      return isDecoratingTaskForDate(order, todayStr);
    }
    if (activeFilter === "dispatch") {
      return isDispatchTaskForDate(order);
    }
    if (activeFilter === "ready_to_bake") {
      return readiness.key === "ready_for_production";
    }
    if (activeFilter === "in_baking") {
      return statusLower === "in_baking";
    }
    if (activeFilter === "payment_blocked") {
      return statusLower === "accepted" && readiness.key === "awaiting_deposit";
    }
    if (activeFilter === "urgent") {
      return order.production_priority === "urgent" || order.production_priority === "high";
    }
    if (activeFilter === "overdue") {
      return getOverdueInfo(order, todayStr).isOverdue;
    }
    if (activeFilter === "at_risk") {
      return getAtRiskInfo(order, todayStr, tomorrowStr).isAtRisk;
    }
    if (activeFilter === "my_work") {
      return Boolean(
        currentUserId &&
          (order.assigned_baker_id === currentUserId || order.assigned_decorator_id === currentUserId)
      );
    }
    if (activeFilter === "unassigned_staff") {
      const hasBaker = Boolean(order.assigned_baker_id && order.assigned_baker_id.trim());
      const hasDecorator = Boolean(order.assigned_decorator_id && order.assigned_decorator_id.trim());
      return !hasBaker || !hasDecorator;
    }

    return true;
  };

  const filteredBakingToday = useMemo(() => bakingToday.filter(filterOrder), [bakingToday, activeFilter, selectedStaffFilter]);
  const filteredReadyToday = useMemo(() => readyToday.filter(filterOrder), [readyToday, activeFilter, selectedStaffFilter]);
  const filteredTomorrowOrders = useMemo(() => tomorrowOrders.filter(filterOrder), [tomorrowOrders, activeFilter, selectedStaffFilter]);
  const filteredUpcomingThisWeek = useMemo(() => upcomingThisWeek.filter(filterOrder), [upcomingThisWeek, activeFilter, selectedStaffFilter]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const parts = dateStr.split("-");
      const year = parseInt(parts[0] || "2026", 10);
      const month = parseInt(parts[1] || "1", 10) - 1;
      const day = parseInt(parts[2] || "1", 10);
      const date = new Date(year, month, day, 12, 0, 0);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const renderCard = (order: KitchenOrder) => {
    const isUpdating = updatingOrderId === order.id;
    const shortId = order.id.slice(0, 8).toUpperCase();
    const statusLower = order.status.toLowerCase();

    const readiness = getProductionReadiness(order);
    const paymentInfo = getPaymentBadgeInfo(order);
    const quoted = Number(order.quoted_price_lkr || 0);
    const deposit = Number(order.deposit_amount_lkr || 0);
    const paid = Number(order.amount_paid_lkr || 0);
    const balanceDue = quoted > 0 ? Math.max(0, quoted - paid) : 0;
    const isAwaitingDeposit = statusLower === "accepted" && deposit > 0 && paid < deposit;

    const overdueInfo = getOverdueInfo(order, todayStr);
    const riskInfo = getAtRiskInfo(order, todayStr, tomorrowStr);
    const durationInfo = formatProductionDuration(order.production_started_at, order.production_completed_at, nowTime);

    return (
      <div
        key={order.id}
        className={`flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border transition-all space-y-4 ${
          overdueInfo.isOverdue
            ? "border-red-500/80 bg-red-500/5 shadow-red-500/10"
            : riskInfo.isAtRisk
              ? "border-amber-500/70 bg-amber-500/5"
              : order.production_priority === "urgent"
                ? "border-rose-500/60"
                : "border-border/80 hover:border-primary/50"
        }`}
      >
        {/* Card Top: Short ID, Priority, Event Date */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-mono font-bold text-foreground">
                #{shortId}
              </span>
              {order.production_priority && order.production_priority !== "normal" && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] ${
                    order.production_priority === "urgent"
                      ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 animate-pulse"
                      : "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                  }`}
                >
                  <Flame className="h-3 w-3" />
                  {order.production_priority}
                </span>
              )}
            </div>

            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(order.event_date)}
            </span>
          </div>

          {/* Overdue Alert Banner */}
          {overdueInfo.isOverdue && (
            <div className={`rounded-2xl p-2.5 text-xs flex items-center justify-between gap-2 border ${overdueInfo.badgeClass}`}>
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                {overdueInfo.label}
              </span>
              <span className="text-[11px] font-mono font-semibold">Event: {order.event_date}</span>
            </div>
          )}

          {/* At-Risk Warning Box */}
          {!overdueInfo.isOverdue && riskInfo.isAtRisk && (
            <div className={`rounded-2xl p-2.5 text-xs space-y-1 border ${riskInfo.badgeClass}`}>
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{riskInfo.label}</span>
              </div>
              <ul className="text-[11px] list-disc list-inside space-y-0.5 pl-1 opacity-90">
                {riskInfo.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Operational Readiness & Payment Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${readiness.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${readiness.dotClass}`} />
              {readiness.label}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border ${paymentInfo.badgeClass}`}
            >
              <Receipt className="h-3 w-3" />
              {paymentInfo.label}
            </span>

            {order.complexity_units && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-500/30">
                ⚡ {Number(order.complexity_units).toFixed(1)} units
              </span>
            )}
          </div>

          <h4 className="text-lg font-medium text-foreground">{order.event_type} Celebration</h4>

          {/* Customer contact */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-primary" />
              {order.customer_name}
            </span>
            {order.customer_phone && (
              <span className="flex items-center gap-1 font-mono">
                <Phone className="h-3.5 w-3.5" />
                {order.customer_phone}
              </span>
            )}
          </div>

          {/* Production Schedule & Pickup Meta */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            {order.scheduled_bake_date && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-purple-500/15 px-2 py-0.5 font-medium text-purple-800 dark:text-purple-300 border border-purple-500/20">
                <ChefHat className="h-3 w-3" /> Bake: {order.scheduled_bake_date}
              </span>
            )}
            {order.scheduled_decorate_date && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/15 px-2 py-0.5 font-medium text-indigo-800 dark:text-indigo-300 border border-indigo-500/20">
                <Sparkles className="h-3 w-3" /> Decorate: {order.scheduled_decorate_date}
              </span>
            )}
            {order.target_pickup_time && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-teal-500/15 px-2 py-0.5 font-medium text-teal-800 dark:text-teal-300 border border-teal-500/20 font-mono">
                <Clock className="h-3 w-3" /> Pickup: {order.target_pickup_time.slice(0, 5)}
              </span>
            )}
          </div>

          {/* Staff Assignments Meta */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
            {order.assigned_baker_id ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-purple-500/10 px-2 py-0.5 font-medium text-purple-800 dark:text-purple-300 border border-purple-500/20">
                <ChefHat className="h-3 w-3" />
                Baker: {getStaffDisplayName(staffMap.get(order.assigned_baker_id))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300 border border-amber-500/20">
                <ChefHat className="h-3 w-3" />
                Baker: Unassigned
              </span>
            )}
            {order.assigned_decorator_id ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-pink-500/10 px-2 py-0.5 font-medium text-pink-800 dark:text-pink-300 border border-pink-500/20">
                <Sparkles className="h-3 w-3" />
                Decorator: {getStaffDisplayName(staffMap.get(order.assigned_decorator_id))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300 border border-amber-500/20">
                <Sparkles className="h-3 w-3" />
                Decorator: Unassigned
              </span>
            )}
          </div>

          {/* Live Production Timestamp / Elapsed Timer Banner */}
          {durationInfo.hasStarted && (
            <div className="rounded-2xl bg-muted/40 p-2.5 border border-border/70 text-[11px] flex items-center justify-between text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-primary" />
                <span>Started: {durationInfo.formattedStartTime}</span>
              </span>
              <span className="font-semibold text-foreground">
                {durationInfo.hasCompleted ? `Finished (${durationInfo.formattedDuration})` : `In Station: ${durationInfo.formattedDuration}`}
              </span>
            </div>
          )}
        </div>

        {/* Structured Financial Breakdown Snippet */}
        <div className="rounded-2xl bg-secondary/40 p-3 border border-border/70 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Quoted:</span>
            <span className="font-semibold text-foreground">{formatLKR(order.quoted_price_lkr)}</span>
          </div>
          {deposit > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Deposit Req.:</span>
              <span className="font-medium text-foreground">{formatLKR(deposit)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Paid to Date:</span>
            <span
              className={`font-semibold ${
                paid >= (quoted || deposit) && paid > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : paid > 0
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-rose-600"
              }`}
            >
              {formatLKR(paid)}
            </span>
          </div>
          {quoted > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] font-medium">
              <span className="text-muted-foreground">Outstanding Due:</span>
              <span className={balanceDue > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                {balanceDue > 0 ? formatLKR(balanceDue) : "Cleared (LKR 0)"}
              </span>
            </div>
          )}
        </div>

        {/* Cake Details */}
        <div className="rounded-2xl bg-secondary/30 p-3.5 border border-border/60 text-xs text-foreground/90 leading-relaxed font-medium">
          <p className="line-clamp-3">{order.cake_details}</p>
        </div>

        {/* Payment Blocked Caution Banner */}
        {isAwaitingDeposit && (
          <div className="rounded-2xl bg-amber-500/10 p-2.5 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Deposit Pending:</span> Customer confirmed, but required deposit ({formatLKR(deposit)}) has not cleared.
            </div>
          </div>
        )}

        {/* Kitchen / Bakery Notes */}
        {(order.internal_notes || order.admin_notes) && (
          <div className="rounded-2xl bg-amber-500/10 p-3 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300">
            <span className="font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Kitchen Note:
            </span>
            <p className="line-clamp-2 mt-0.5">{order.internal_notes || order.admin_notes}</p>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Quick Kitchen Progression Buttons */}
            {statusLower === "accepted" && (
              <Button
                size="sm"
                onClick={() => onUpdateStatus(order.id, "in_baking")}
                disabled={isUpdating}
                className="rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-3 gap-1 cursor-pointer"
                title={isAwaitingDeposit ? "Start baking (Deposit is still pending)" : "Start baking in kitchen"}
              >
                {isUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChefHat className="h-3.5 w-3.5" />
                )}
                <span>Start Baking</span>
              </Button>
            )}

            {statusLower === "in_baking" && (
              <Button
                size="sm"
                onClick={() => onUpdateStatus(order.id, "ready")}
                disabled={isUpdating}
                className="rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 px-3 gap-1 cursor-pointer"
              >
                {isUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PackageCheck className="h-3.5 w-3.5" />
                )}
                <span>Mark Ready</span>
              </Button>
            )}

            {statusLower === "ready" && (
              <Button
                size="sm"
                onClick={() => onUpdateStatus(order.id, "completed")}
                disabled={isUpdating}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 gap-1 cursor-pointer"
              >
                {isUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Mark Completed</span>
              </Button>
            )}

            {/* Print Ticket Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPrintTicket(order)}
              className="rounded-full text-xs h-8 px-2.5 gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Print Kitchen Ticket"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ticket</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenOrder(order)}
            className="rounded-full text-xs h-8 px-2.5 text-primary hover:bg-primary/10 cursor-pointer"
          >
            <span>Details / Assign</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Kitchen Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h2 className="text-xl font-bold text-foreground">Kitchen Operations Workspace</h2>
          <p className="text-xs text-muted-foreground">
            Live workstation queues, production timestamps, priority dispatch, and payment-aware readiness
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Staff Filter Selector */}
          <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-full px-3 py-1 text-xs">
            <User className="h-3.5 w-3.5 text-primary" />
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              aria-label="Filter kitchen orders by staff"
            >
              <option value="all">All Staff Members</option>
              {currentUserId && <option value="my_work">👤 My Assigned Work</option>}
              <option value="unassigned">⚠️ Unassigned Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {getStaffDisplayName(s)}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSummaryModal(true)}
            className="rounded-full text-xs h-9 px-4 gap-1.5 border-border/80 text-foreground hover:bg-secondary cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            <span>Print Daily Run Sheet</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportKitchenSchedule}
            className="rounded-full text-xs h-9 px-4 gap-1.5 border-border/80 text-foreground hover:bg-secondary cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export Schedule (CSV)</span>
          </Button>
        </div>
      </div>

      {/* Today's Global Capacity & Daily Production Status Banner */}
      <div className="rounded-3xl bg-secondary/30 p-4 sm:p-5 border border-border/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Today&apos;s Bakery Operations • {todayStr}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {todayCapacity.isBlackout
              ? `⚠️ Bakery Blackout Closure: ${todayCapacity.blackoutReason || "Closed"}`
              : `Bakery Capacity: ${todayCapacity.committedWorkloadUnits.toFixed(1)} / ${todayCapacity.maxCapacityUnits.toFixed(1)} units (${todayCapacity.utilizationPercent.toFixed(0)}% used • ${todayCapacity.remainingUnits.toFixed(1)}u remaining)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${todayCapacity.badgeClass}`}>
            {todayCapacity.stateLabel}
          </span>
          {metrics.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 text-red-800 dark:text-red-200 border border-red-500/40 px-3 py-1 text-xs font-bold animate-pulse">
              🚨 {metrics.overdueCount} Overdue
            </span>
          )}
          {metrics.atRiskCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 px-3 py-1 text-xs font-bold">
              ⚠️ {metrics.atRiskCount} At Risk
            </span>
          )}
        </div>
      </div>

      {/* Operational Metrics Header */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              In Kitchen
            </span>
            <ChefHat className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{metrics.totalActive}</p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider">
              Overdue
            </span>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1.5">
            {metrics.overdueCount}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              At Risk
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1.5">
            {metrics.atRiskCount}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
              Urgent
            </span>
            <Flame className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1.5">
            {metrics.urgentCount}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Ready to Bake
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1.5">
            {metrics.readyForProduction}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
              In Baking
            </span>
            <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1.5">
            {metrics.bakingNow}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider">
              Ready Pickup
            </span>
            <PackageCheck className="h-4 w-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-1.5">
            {metrics.readyNow}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Deposit Req.
            </span>
            <Receipt className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1.5">
            {metrics.awaitingDeposit}
          </p>
        </div>
      </div>

      {/* Workstation & Operational Filter Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/60">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeFilter === "all"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Active Queue ({metrics.totalActive})
        </button>

        {/* Workstation Filters */}
        <button
          type="button"
          onClick={() => setActiveFilter("baking")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "baking"
              ? "bg-purple-500/20 text-purple-900 dark:text-purple-200 shadow-xs border border-purple-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChefHat className="h-3.5 w-3.5 text-purple-600" />
          <span>Baking Station ({metrics.bakingStationCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("decorating")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "decorating"
              ? "bg-pink-500/20 text-pink-900 dark:text-pink-200 shadow-xs border border-pink-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-pink-600" />
          <span>Decorating Station ({metrics.decoratingStationCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("dispatch")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "dispatch"
              ? "bg-teal-500/20 text-teal-900 dark:text-teal-200 shadow-xs border border-teal-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <PackageCheck className="h-3.5 w-3.5 text-teal-600" />
          <span>Dispatch / Pickup ({metrics.dispatchCount})</span>
        </button>

        {/* Operational Status Filters */}
        <button
          type="button"
          onClick={() => setActiveFilter("ready_to_bake")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "ready_to_bake"
              ? "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 shadow-xs border border-emerald-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Ready to Bake ({metrics.readyForProduction})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("in_baking")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "in_baking"
              ? "bg-purple-500/20 text-purple-900 dark:text-purple-200 shadow-xs border border-purple-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          <span>In Baking ({metrics.bakingNow})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("payment_blocked")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "payment_blocked"
              ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-xs border border-amber-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Payment Blocked ({metrics.awaitingDeposit})</span>
        </button>

        {metrics.overdueCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("overdue")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === "overdue"
                ? "bg-red-500/20 text-red-900 dark:text-red-200 shadow-xs border border-red-500/40 font-bold"
                : "text-red-600 hover:text-red-700"
            }`}
          >
            <span>🚨 Overdue ({metrics.overdueCount})</span>
          </button>
        )}

        {metrics.atRiskCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter("at_risk")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === "at_risk"
                ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-xs border border-amber-500/40 font-bold"
                : "text-amber-700 hover:text-amber-800"
            }`}
          >
            <span>⚠️ At Risk ({metrics.atRiskCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveFilter("urgent")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "urgent"
              ? "bg-rose-500/20 text-rose-900 dark:text-rose-200 shadow-xs border border-rose-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="h-3 w-3 text-rose-500" />
          <span>Urgent ({metrics.urgentCount})</span>
        </button>

        {currentUserId && (
          <button
            type="button"
            onClick={() => setActiveFilter("my_work")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === "my_work"
                ? "bg-primary/20 text-primary shadow-xs border border-primary/30 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-3 w-3 text-primary" />
            <span>My Work ({metrics.myWorkCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveFilter("unassigned_staff")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "unassigned_staff"
              ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-xs border border-amber-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>⚠️ Unassigned Staff ({metrics.unassignedStaffCount})</span>
        </button>
      </div>

      {/* SECTION 1: BAKING TODAY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-purple-500 animate-ping" />
            <h3 className="text-lg font-medium text-foreground">
              Baking & Production Today ({filteredBakingToday.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Oven Baking & Active Stations</span>
        </div>

        {filteredBakingToday.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            {activeFilter === "all"
              ? "No cakes currently scheduled for baking today."
              : "No cakes match the current filter criteria for baking today."}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBakingToday.map(renderCard)}
          </div>
        )}
      </div>

      {/* SECTION 2: READY FOR PICKUP / DELIVERY TODAY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-teal-600" />
            <h3 className="text-lg font-medium text-foreground">
              Ready for Pickup / Delivery Today ({filteredReadyToday.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Packaged & Display Staged</span>
        </div>

        {filteredReadyToday.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            {activeFilter === "all"
              ? "No cakes currently staged for pickup/delivery today."
              : "No cakes match the current filter criteria for pickup/delivery today."}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredReadyToday.map(renderCard)}
          </div>
        )}
      </div>

      {/* SECTION 3: TOMORROW'S ORDERS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-medium text-foreground">
              Tomorrow&apos;s Celebration Orders ({filteredTomorrowOrders.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Sponge & Filling Preparation</span>
        </div>

        {filteredTomorrowOrders.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            {activeFilter === "all"
              ? "No celebration orders scheduled for tomorrow."
              : "No tomorrow orders match the current filter criteria."}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTomorrowOrders.map(renderCard)}
          </div>
        )}
      </div>

      {/* SECTION 4: UPCOMING THIS WEEK */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium text-foreground">
              Upcoming Celebrations This Week ({filteredUpcomingThisWeek.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Next 7 Days Schedule</span>
        </div>

        {filteredUpcomingThisWeek.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            {activeFilter === "all"
              ? "No additional upcoming orders scheduled for this week."
              : "No upcoming week orders match the current filter criteria."}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUpcomingThisWeek.map(renderCard)}
          </div>
        )}
      </div>

      {/* Daily Production Summary Modal (Printable Run Sheet) */}
      {showSummaryModal && (
        <DailyProductionSummaryModal
          orders={orders}
          staffList={staffList}
          capacitySettings={capacitySettings}
          blackoutDates={blackoutDates}
          onClose={() => setShowSummaryModal(false)}
        />
      )}
    </div>
  );
}
