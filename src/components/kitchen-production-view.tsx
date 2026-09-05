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
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { DailyProductionSummaryModal } from "@/components/daily-production-summary-modal";

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
  admin_notes: string | null;
  created_at: string;
  updated_at?: string;
}

interface KitchenProductionViewProps {
  orders: KitchenOrder[];
  onUpdateStatus: (orderId: string, nextStatus: string) => Promise<void>;
  onOpenOrder: (order: KitchenOrder) => void;
  onPrintTicket: (order: KitchenOrder) => void;
  updatingOrderId: string | null;
}

export function KitchenProductionView({
  orders,
  onUpdateStatus,
  onOpenOrder,
  onPrintTicket,
  updatingOrderId,
}: KitchenProductionViewProps) {
  const [showSummaryModal, setShowSummaryModal] = useState(false);

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
      "Status",
      "Cake Details",
      "Bakery Notes",
      "Order Date",
    ];
    const rows = activeOrders.map((o) => [
      o.id,
      o.customer_name,
      o.customer_email,
      o.customer_phone || "",
      o.event_type,
      o.event_date,
      o.status,
      o.cake_details,
      o.admin_notes || "",
      o.created_at,
    ]);
    const dateStamp = new Date().toISOString().split("T")[0];
    exportToCsv(`kitchen-schedule-${dateStamp}.csv`, headers, rows);
  };

  // Categorize orders into kitchen sections
  const { bakingToday, readyToday, tomorrowOrders, upcomingThisWeek, metrics } = useMemo(() => {
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

    orders.forEach((order) => {
      const statusLower = order.status.toLowerCase();
      if (
        statusLower === "completed" ||
        statusLower === "declined" ||
        statusLower === "cancelled"
      ) {
        return; // Exclude terminal statuses from active kitchen production board
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
      },
    };
  }, [orders]);

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

    return (
      <div
        key={order.id}
        className="flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/80 hover:border-primary/50 transition-all space-y-4"
      >
        {/* Card Top: Short ID, Event Date Badge, Celebration Type */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-mono font-bold text-foreground">
              #{shortId}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(order.event_date)}
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
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {order.customer_phone}
              </span>
            )}
          </div>
        </div>

        {/* Cake Details */}
        <div className="rounded-2xl bg-secondary/30 p-3.5 border border-border/60 text-xs text-foreground/90 leading-relaxed font-medium">
          <p className="line-clamp-3">{order.cake_details}</p>
        </div>

        {/* Bakery Notes (if any) */}
        {order.admin_notes && (
          <div className="rounded-2xl bg-amber-500/10 p-3 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300">
            <span className="font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Note:
            </span>
            <p className="line-clamp-2 mt-0.5">{order.admin_notes}</p>
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
            Live baking queue, decorating station, and daily delivery staging
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

      {/* Daily Production Metrics Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total in Kitchen
            </span>
            <ChefHat className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{metrics.totalActive}</p>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
              Baking Today
            </span>
            <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-2">
            {metrics.bakingNow}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider">
              Ready for Pickup
            </span>
            <PackageCheck className="h-4 w-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-2">
            {metrics.readyNow}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Upcoming (7 Days)
            </span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{metrics.upcoming}</p>
        </div>
      </div>

      {/* SECTION 1: BAKING TODAY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-purple-500 animate-ping" />
            <h3 className="text-lg font-medium text-foreground">
              Baking & Production Today ({bakingToday.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">In Oven & Decorating Station</span>
        </div>

        {bakingToday.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            No cakes currently scheduled for baking today.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bakingToday.map(renderCard)}
          </div>
        )}
      </div>

      {/* SECTION 2: READY FOR PICKUP / DELIVERY TODAY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-teal-600" />
            <h3 className="text-lg font-medium text-foreground">
              Ready for Pickup / Delivery Today ({readyToday.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Packaged in Bakery Display</span>
        </div>

        {readyToday.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            No cakes currently staged for pickup/delivery today.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {readyToday.map(renderCard)}
          </div>
        )}
      </div>

      {/* SECTION 3: TOMORROW'S ORDERS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-medium text-foreground">
              Tomorrow&apos;s Celebration Orders ({tomorrowOrders.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Prep Sponge & Frosting</span>
        </div>

        {tomorrowOrders.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            No celebration orders scheduled for tomorrow.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tomorrowOrders.map(renderCard)}
          </div>
        )}
      </div>

      {/* SECTION 4: UPCOMING THIS WEEK */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium text-foreground">
              Upcoming Celebrations This Week ({upcomingThisWeek.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Next 7 Days Schedule</span>
        </div>

        {upcomingThisWeek.length === 0 ? (
          <div className="rounded-3xl bg-secondary/20 p-8 text-center border border-dashed border-border text-xs text-muted-foreground">
            No additional upcoming orders scheduled for this week.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingThisWeek.map(renderCard)}
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
