import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { DailyProductionSummaryModal } from "@/components/daily-production-summary-modal";
import {
  formatLKR,
  getProductionReadiness,
  getPaymentBadgeInfo,
  type ProductionReadinessKey,
} from "@/lib/order-readiness";

export interface KitchenOrder {
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
  created_at: string;
  updated_at?: string | undefined;
}

interface KitchenProductionViewProps {
  orders: KitchenOrder[];
  onUpdateStatus: (orderId: string, nextStatus: string) => Promise<void>;
  onOpenOrder: (order: KitchenOrder) => void;
  onPrintTicket: (order: KitchenOrder) => void;
  updatingOrderId: string | null;
}

type KitchenFilterOption =
  | "all"
  | "awaiting_deposit"
  | "ready_for_production"
  | "in_baking"
  | "ready"
  | "fully_paid";

export function KitchenProductionView({
  orders,
  onUpdateStatus,
  onOpenOrder,
  onPrintTicket,
  updatingOrderId,
}: KitchenProductionViewProps) {
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<KitchenFilterOption>("all");

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
      "Workflow Status",
      "Production Readiness",
      "Quoted Price (LKR)",
      "Deposit Required (LKR)",
      "Amount Paid (LKR)",
      "Balance Due (LKR)",
      "Payment Status",
      "Payment Method",
      "Cake Specifications",
      "Bakery / Kitchen Notes",
      "Order Date",
    ];
    const rows = activeOrders.map((o) => {
      const readiness = getProductionReadiness(o);
      const quoted = Number(o.quoted_price_lkr || 0);
      const deposit = Number(o.deposit_amount_lkr || 0);
      const paid = Number(o.amount_paid_lkr || 0);
      const balanceDue = quoted > 0 ? Math.max(0, quoted - paid) : 0;
      const paymentInfo = getPaymentBadgeInfo(o);

      return [
        o.id,
        o.customer_name,
        o.customer_email,
        o.customer_phone || "",
        o.event_type,
        o.event_date,
        o.status,
        readiness.label,
        quoted > 0 ? quoted : "",
        deposit > 0 ? deposit : "",
        paid > 0 ? paid : 0,
        balanceDue,
        paymentInfo.label,
        o.payment_method || "",
        o.cake_details,
        o.internal_notes || o.admin_notes || "",
        o.created_at,
      ];
    });
    const dateStamp = new Date().toISOString().split("T")[0];
    exportToCsv(`kitchen-schedule-${dateStamp}.csv`, headers, rows);
  };

  // Categorize orders into kitchen sections and calculate readiness metrics
  const {
    bakingToday,
    readyToday,
    tomorrowOrders,
    upcomingThisWeek,
    metrics,
  } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] || "";

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0] || "";

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0] || "";

    const activeBaking: KitchenOrder[] = [];
    const activeReady: KitchenOrder[] = [];
    const tomorrowList: KitchenOrder[] = [];
    const upcomingList: KitchenOrder[] = [];

    let awaitingDepositCount = 0;
    let readyForProdCount = 0;
    let fullyPaidCount = 0;

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
      if (readiness.key === "awaiting_deposit" && statusLower === "accepted") {
        awaitingDepositCount++;
      } else if (readiness.key === "ready_for_production") {
        readyForProdCount++;
      }

      const paymentInfo = getPaymentBadgeInfo(order);
      if (paymentInfo.isFullyPaid) {
        fullyPaidCount++;
      }

      const eventDate = order.event_date;

      // 1. Baking Today: in_baking regardless of date or accepted with date <= today
      if (statusLower === "in_baking" || (statusLower === "accepted" && eventDate <= todayStr)) {
        activeBaking.push(order);
      }
      // 2. Ready Today: ready for pickup / dispatch
      else if (statusLower === "ready" && eventDate <= todayStr) {
        activeReady.push(order);
      }
      // 3. Tomorrow's Orders
      else if (eventDate === tomorrowStr) {
        tomorrowList.push(order);
      }
      // 4. Upcoming This Week (next 7 days)
      else if (eventDate > tomorrowStr && eventDate <= nextWeekStr) {
        upcomingList.push(order);
      }
      // Catch-all active orders: if accepted/quoted for upcoming dates
      else if (eventDate > nextWeekStr) {
        upcomingList.push(order);
      } else if (statusLower === "ready") {
        activeReady.push(order);
      }
    });

    return {
      bakingToday: activeBaking,
      readyToday: activeReady,
      tomorrowOrders: tomorrowList,
      upcomingThisWeek: upcomingList,
      metrics: {
        totalActive:
          activeBaking.length + activeReady.length + tomorrowList.length + upcomingList.length,
        bakingNow: activeBaking.length,
        readyNow: activeReady.length,
        upcoming: tomorrowList.length + upcomingList.length,
        awaitingDeposit: awaitingDepositCount,
        readyForProduction: readyForProdCount,
        fullyPaid: fullyPaidCount,
      },
    };
  }, [orders]);

  // Filter application helper
  const filterOrder = (order: KitchenOrder): boolean => {
    if (activeFilter === "all") return true;

    const statusLower = order.status.toLowerCase();
    const readiness = getProductionReadiness(order);
    const paymentInfo = getPaymentBadgeInfo(order);

    if (activeFilter === "awaiting_deposit") {
      return statusLower === "accepted" && readiness.key === "awaiting_deposit";
    }
    if (activeFilter === "ready_for_production") {
      return readiness.key === "ready_for_production";
    }
    if (activeFilter === "in_baking") {
      return statusLower === "in_baking";
    }
    if (activeFilter === "ready") {
      return statusLower === "ready";
    }
    if (activeFilter === "fully_paid") {
      return paymentInfo.isFullyPaid;
    }
    return true;
  };

  const filteredBakingToday = useMemo(() => bakingToday.filter(filterOrder), [bakingToday, activeFilter]);
  const filteredReadyToday = useMemo(() => readyToday.filter(filterOrder), [readyToday, activeFilter]);
  const filteredTomorrowOrders = useMemo(() => tomorrowOrders.filter(filterOrder), [tomorrowOrders, activeFilter]);
  const filteredUpcomingThisWeek = useMemo(() => upcomingThisWeek.filter(filterOrder), [upcomingThisWeek, activeFilter]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
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

    return (
      <div
        key={order.id}
        className="flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/80 hover:border-primary/50 transition-all space-y-4"
      >
        {/* Card Top: Short ID, Readiness Badge, Event Date */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-mono font-bold text-foreground">
              #{shortId}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(order.event_date)}
            </span>
          </div>

          {/* Production Readiness & Payment Badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {/* Operational Readiness Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${readiness.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${readiness.dotClass}`} />
              {readiness.label}
            </span>

            {/* Financial Payment Status Pill */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border ${paymentInfo.badgeClass}`}
            >
              <Receipt className="h-3 w-3" />
              {paymentInfo.label}
            </span>
          </div>

          <h4 className="text-lg font-medium text-foreground">{order.event_type} Celebration</h4>

          {/* Customer info */}
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

        {/* Awaiting Deposit Caution Banner */}
        {isAwaitingDeposit && (
          <div className="rounded-2xl bg-amber-500/10 p-2.5 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Deposit Pending:</span> Order accepted by customer, but deposit ({formatLKR(deposit)}) is not recorded yet.
            </div>
          </div>
        )}

        {/* Kitchen / Bakery Notes (if any) */}
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
            <span>Details</span>
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
          <h2 className="text-xl font-bold text-foreground">Kitchen Production Board</h2>
          <p className="text-xs text-muted-foreground">
            Live baking queue, decorating station, and payment-aware production readiness
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Daily Production & Payment Readiness Metrics Header */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Awaiting Deposit
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1.5">
            {metrics.awaitingDeposit}
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
              Baking Today
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
              Ready for Pickup
            </span>
            <PackageCheck className="h-4 w-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-1.5">
            {metrics.readyNow}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Upcoming (7D)
            </span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{metrics.upcoming}</p>
        </div>
      </div>

      {/* Readiness Filter Navigation Tabs */}
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

        <button
          type="button"
          onClick={() => setActiveFilter("awaiting_deposit")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "awaiting_deposit"
              ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-xs border border-amber-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Awaiting Deposit ({metrics.awaitingDeposit})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("ready_for_production")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "ready_for_production"
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
          onClick={() => setActiveFilter("ready")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "ready"
              ? "bg-teal-500/20 text-teal-900 dark:text-teal-200 shadow-xs border border-teal-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-teal-500" />
          <span>Ready for Pickup ({metrics.readyNow})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("fully_paid")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === "fully_paid"
              ? "bg-blue-500/20 text-blue-900 dark:text-blue-200 shadow-xs border border-blue-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="h-3 w-3" />
          <span>Fully Paid ({metrics.fullyPaid})</span>
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
          <span className="text-xs text-muted-foreground">In Oven & Decorating Station</span>
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
          <span className="text-xs text-muted-foreground">Packaged in Bakery Display</span>
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
          <span className="text-xs text-muted-foreground">Prep Sponge & Frosting</span>
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
        <DailyProductionSummaryModal orders={orders} onClose={() => setShowSummaryModal(false)} />
      )}
    </div>
  );
}

