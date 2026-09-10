import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Printer,
  X,
  Calendar,
  ChefHat,
  PackageCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Receipt,
  AlertTriangle,
  Users,
  Flame,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import type { KitchenOrder } from "@/components/kitchen-production-view";
import { formatLKR, getProductionReadiness, getPaymentBadgeInfo } from "@/lib/order-readiness";
import {
  getStaffDisplayName,
  calculateStaffWorkloads,
  getStaffWorkloadSummary,
  type StaffProfileInput,
} from "@/lib/staff-workload-utils";
import {
  calculateDailyCapacity,
  type KitchenCapacitySetting,
  type BakeryBlackoutDate,
  type DailyCapacityResult,
} from "@/lib/capacity-utils";
import {
  getLocalDateString,
  getOverdueInfo,
  getAtRiskInfo,
  isBakingTaskForDate,
  isDecoratingTaskForDate,
  isDispatchTaskForDate,
} from "@/lib/kitchen-operations-utils";

interface DailyManagementSummaryModalProps {
  orders: KitchenOrder[];
  selectedDate?: string | undefined;
  staffList?: StaffProfileInput[] | undefined;
  capacitySettings?: KitchenCapacitySetting[] | undefined;
  blackoutDates?: BakeryBlackoutDate[] | undefined;
  onClose: () => void;
}

export function DailyManagementSummaryModal({
  orders,
  selectedDate,
  staffList = [],
  capacitySettings = [],
  blackoutDates = [],
  onClose,
}: DailyManagementSummaryModalProps) {
  const [currentDateYMD, setCurrentDateYMD] = useState<string>(
    selectedDate || getLocalDateString(new Date()),
  );

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffProfileInput>();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  const formattedDate = useMemo(() => {
    try {
      const parts = currentDateYMD.split("-");
      const year = parseInt(parts[0] || "2026", 10);
      const month = parseInt(parts[1] || "1", 10) - 1;
      const day = parseInt(parts[2] || "1", 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch {
      return currentDateYMD;
    }
  }, [currentDateYMD]);

  const handlePrevDay = () => {
    const parts = currentDateYMD.split("-");
    const d = new Date(
      parseInt(parts[0] || "2026", 10),
      parseInt(parts[1] || "1", 10) - 1,
      parseInt(parts[2] || "1", 10) - 1,
      12,
      0,
      0,
    );
    setCurrentDateYMD(getLocalDateString(d));
  };

  const handleNextDay = () => {
    const parts = currentDateYMD.split("-");
    const d = new Date(
      parseInt(parts[0] || "2026", 10),
      parseInt(parts[1] || "1", 10) - 1,
      parseInt(parts[2] || "1", 10) + 1,
      12,
      0,
      0,
    );
    setCurrentDateYMD(getLocalDateString(d));
  };

  const handleToday = () => {
    setCurrentDateYMD(getLocalDateString(new Date()));
  };

  // 1. Capacity Calculations for Date
  const capacityResult: DailyCapacityResult = useMemo(() => {
    return calculateDailyCapacity(currentDateYMD, orders, capacitySettings, blackoutDates);
  }, [currentDateYMD, orders, capacitySettings, blackoutDates]);

  // 2. Staff Workload Summary for Date
  const staffSummary = useMemo(() => {
    return getStaffWorkloadSummary(currentDateYMD, staffList, orders);
  }, [currentDateYMD, staffList, orders]);

  // 3. Filter orders relevant for this date
  const dayBakingTasks = useMemo(() => {
    return orders.filter((o) => isBakingTaskForDate(o, currentDateYMD));
  }, [orders, currentDateYMD]);

  const dayDecoratingTasks = useMemo(() => {
    return orders.filter((o) => isDecoratingTaskForDate(o, currentDateYMD));
  }, [orders, currentDateYMD]);

  const dayDispatchTasks = useMemo(() => {
    return orders.filter((o) => isDispatchTaskForDate(o, currentDateYMD));
  }, [orders, currentDateYMD]);

  // 4. Kitchen Operations Status Counts
  const readyToBakeCount = useMemo(() => {
    return orders.filter((o) => {
      if (["completed", "declined", "cancelled"].includes(o.status.toLowerCase())) return false;
      return getProductionReadiness(o).key === "ready_for_production";
    }).length;
  }, [orders]);

  const inBakingCount = useMemo(() => {
    return orders.filter((o) => o.status.toLowerCase() === "in_baking").length;
  }, [orders]);

  const readyForPickupCount = useMemo(() => {
    return orders.filter((o) => o.status.toLowerCase() === "ready").length;
  }, [orders]);

  const overdueOrders = useMemo(() => {
    return orders.filter((o) => getOverdueInfo(o, currentDateYMD).isOverdue);
  }, [orders, currentDateYMD]);

  const urgentOrders = useMemo(() => {
    return orders.filter((o) => {
      const statusLower = o.status.toLowerCase();
      if (["completed", "declined", "cancelled"].includes(statusLower)) return false;
      return (o.production_priority || "").toLowerCase().trim() === "urgent";
    });
  }, [orders]);

  const atRiskOrders = useMemo(() => {
    const blackoutSet = new Set(blackoutDates.map((b) => b.blackout_date));
    return orders.filter(
      (o) => getAtRiskInfo(o, currentDateYMD, undefined, { blackoutDates: blackoutSet }).isAtRisk,
    );
  }, [orders, currentDateYMD, blackoutDates]);

  const paymentBlockedOrders = useMemo(() => {
    return orders.filter((o) => {
      const statusLower = o.status.toLowerCase();
      return statusLower === "accepted" && getProductionReadiness(o).key === "awaiting_deposit";
    });
  }, [orders]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-3xl bg-card shadow-2xl border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none">
        {/* Modal Controls Header (Screen Only) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 px-6 py-4 bg-muted/40 sticky top-0 z-20 backdrop-blur-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Daily Executive Kitchen & Capacity Briefing
              </h3>
              <p className="text-xs text-muted-foreground">
                Administrative summary of workload, station capacity, staff allocation & risk alerts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Switcher */}
            <div className="flex items-center gap-1 bg-card border border-border/80 rounded-full p-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevDay}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-7 px-2.5 rounded-full text-xs font-semibold text-foreground cursor-pointer"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextDay}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handlePrint}
              size="sm"
              className="rounded-full gap-1.5 bg-primary text-primary-foreground shadow-xs cursor-pointer hover:bg-primary/90"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Briefing</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE BRIEFING CONTENT */}
        <div
          id="daily-management-printable"
          className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-6 print:overflow-visible print:space-y-4 text-foreground print:text-black"
        >
          {/* 1. Executive Header */}
          <div className="border-b-2 border-primary/40 print:border-black pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-xs font-bold tracking-widest uppercase text-primary print:text-black font-mono">
                SC FROST HEAVEN BAKERY OPERATIONS
              </span>
              <h1 className="text-2xl font-bold text-foreground print:text-black mt-0.5">
                Daily Management Production Briefing
              </h1>
              <p className="text-xs text-muted-foreground print:text-black/80">
                Confidential Executive Snapshot — Workload, Capacity, Staffing & Risk Matrix
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-muted-foreground print:text-black font-mono">
              <div className="font-semibold text-foreground print:text-black flex items-center sm:justify-end gap-1.5 text-sm">
                <Calendar className="h-4 w-4 text-primary print:text-black" />
                <span>{formattedDate}</span>
              </div>
              <p className="mt-0.5">
                Generated:{" "}
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* 2. Capacity & Workload Summary Card */}
          <div className="rounded-2xl border border-border print:border-black p-4 bg-secondary/20 print:bg-neutral-50 space-y-3 break-inside-avoid page-break-inside-avoid">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-primary print:text-black" />
                Kitchen Capacity Utilization
              </h4>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border ${capacityResult.badgeClass} print:border-black print:text-black`}
              >
                {capacityResult.stateLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-border/60 print:border-black/40 p-2.5 bg-card print:bg-white">
                <span className="text-muted-foreground print:text-black font-medium">
                  Configured Capacity:
                </span>
                <p className="text-base font-bold text-foreground print:text-black mt-0.5">
                  {capacityResult.isBlackout
                    ? "0.0 units (Closed)"
                    : `${capacityResult.maxCapacityUnits.toFixed(1)} units`}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 print:border-black/40 p-2.5 bg-card print:bg-white">
                <span className="text-muted-foreground print:text-black font-medium">
                  Committed Workload:
                </span>
                <p className="text-base font-bold text-foreground print:text-black mt-0.5">
                  {capacityResult.committedWorkloadUnits.toFixed(1)} units
                </p>
              </div>
              <div className="rounded-xl border border-border/60 print:border-black/40 p-2.5 bg-card print:bg-white">
                <span className="text-muted-foreground print:text-black font-medium">
                  Remaining Capacity:
                </span>
                <p className="text-base font-bold text-foreground print:text-black mt-0.5">
                  {capacityResult.remainingUnits.toFixed(1)} units
                </p>
              </div>
              <div className="rounded-xl border border-border/60 print:border-black/40 p-2.5 bg-card print:bg-white">
                <span className="text-muted-foreground print:text-black font-medium">
                  Capacity Utilization:
                </span>
                <p className="text-base font-bold text-foreground print:text-black mt-0.5">
                  {capacityResult.utilizationPercent.toFixed(1)}%
                </p>
              </div>
            </div>

            {capacityResult.hasInvalidComplexity && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 print:text-black font-medium">
                ⚠️ Notice: {capacityResult.invalidComplexityOrderCount} scheduled order(s) have
                unrated complexity units and are excluded from numerical load.
              </p>
            )}
          </div>

          {/* 3. Kitchen Operations Status Matrix */}
          <div className="space-y-2 break-inside-avoid page-break-inside-avoid">
            <h4 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5">
              <ChefHat className="h-4 w-4 text-primary print:text-black" />
              Kitchen Operational Status
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  Ready to Bake
                </span>
                <p className="text-xl font-bold text-emerald-700 print:text-black mt-0.5">
                  {readyToBakeCount}
                </p>
              </div>
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  In Baking
                </span>
                <p className="text-xl font-bold text-purple-700 print:text-black mt-0.5">
                  {inBakingCount}
                </p>
              </div>
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  Ready for Pickup
                </span>
                <p className="text-xl font-bold text-teal-700 print:text-black mt-0.5">
                  {readyForPickupCount}
                </p>
              </div>
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  Overdue
                </span>
                <p
                  className={`text-xl font-bold mt-0.5 ${overdueOrders.length > 0 ? "text-rose-700 print:text-black font-extrabold" : "text-foreground print:text-black"}`}
                >
                  {overdueOrders.length}
                </p>
              </div>
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  Urgent Priority
                </span>
                <p className="text-xl font-bold text-rose-700 print:text-black mt-0.5">
                  {urgentOrders.length}
                </p>
              </div>
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  At Risk
                </span>
                <p className="text-xl font-bold text-amber-700 print:text-black mt-0.5">
                  {atRiskOrders.length}
                </p>
              </div>
              <div className="rounded-xl border border-border print:border-black p-3 bg-secondary/10 print:bg-white">
                <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">
                  Deposit Pending
                </span>
                <p className="text-xl font-bold text-amber-700 print:text-black mt-0.5">
                  {paymentBlockedOrders.length}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Staff Workload Roster */}
          <div className="space-y-2 break-inside-avoid page-break-inside-avoid">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary print:text-black" />
                Staff Workload & Task Allocations ({formattedDate})
              </h4>
              <span className="text-[11px] text-muted-foreground print:text-black font-medium">
                Daily Guideline: 6.0 units / staff member
              </span>
            </div>

            {staffSummary.staffWorkloads.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No staff profiles registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-border print:border-black">
                  <thead>
                    <tr className="border-b border-border print:border-black bg-muted/40 print:bg-neutral-100 text-foreground print:text-black font-semibold">
                      <th className="py-2 px-3">Staff Member</th>
                      <th className="py-2 px-3">Bake Tasks</th>
                      <th className="py-2 px-3">Decorate Tasks</th>
                      <th className="py-2 px-3">Total Physical Load</th>
                      <th className="py-2 px-3">Guideline Utilization</th>
                      <th className="py-2 px-3">Workload State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 print:divide-black/40">
                    {staffSummary.staffWorkloads.map((w) => (
                      <tr key={w.staffId} className="hover:bg-muted/10">
                        <td className="py-2 px-3 font-semibold text-foreground print:text-black">
                          {w.staffName}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {w.bakeTaskCount} ({w.bakeUnits.toFixed(1)}u)
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {w.decorateTaskCount} ({w.decorateUnits.toFixed(1)}u)
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-foreground print:text-black">
                          {w.totalPhysicalWorkloadUnits.toFixed(1)} units
                        </td>
                        <td className="py-2 px-3 font-mono font-medium">
                          {w.utilizationPercent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${w.badgeClass} print:border-black print:text-black`}
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

            {(staffSummary.unassignedBakersCount > 0 ||
              staffSummary.unassignedDecoratorsCount > 0) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 print:bg-neutral-50 print:border-black p-2.5 text-xs text-amber-900 dark:text-amber-200 print:text-black font-medium flex items-center justify-between">
                <span>⚠️ Unassigned Kitchen Roles on {currentDateYMD}:</span>
                <span className="font-bold">
                  {staffSummary.unassignedBakersCount} Bake task(s) unassigned •{" "}
                  {staffSummary.unassignedDecoratorsCount} Decorate task(s) unassigned
                </span>
              </div>
            )}
          </div>

          {/* 5. Station Workload Queues */}
          <div className="space-y-4 pt-2">
            {/* Baking Station Queue */}
            <div className="space-y-2 break-inside-avoid page-break-inside-avoid">
              <h5 className="text-xs uppercase tracking-wider font-bold text-purple-700 print:text-black flex items-center gap-1.5 border-b border-purple-500/30 print:border-black pb-1.5">
                🥣 Baking Station Tasks ({dayBakingTasks.length})
              </h5>
              {dayBakingTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No baking tasks scheduled for this date.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 print:border-black text-muted-foreground print:text-black font-medium">
                        <th className="py-1.5 px-2">#ID</th>
                        <th className="py-1.5 px-2">Customer</th>
                        <th className="py-1.5 px-2">Priority</th>
                        <th className="py-1.5 px-2">Complexity</th>
                        <th className="py-1.5 px-2">Assigned Baker</th>
                        <th className="py-1.5 px-2">Readiness</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 print:divide-black/30 font-mono">
                      {dayBakingTasks.map((o) => {
                        const readiness = getProductionReadiness(o);
                        const baker = o.assigned_baker_id
                          ? getStaffDisplayName(staffMap.get(o.assigned_baker_id))
                          : "Unassigned";
                        return (
                          <tr key={o.id}>
                            <td className="py-1.5 px-2 font-bold text-primary print:text-black">
                              #{o.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="py-1.5 px-2 font-sans font-medium text-foreground print:text-black">
                              {o.customer_name}
                            </td>
                            <td className="py-1.5 px-2 uppercase font-bold">
                              {o.production_priority || "NORMAL"}
                            </td>
                            <td className="py-1.5 px-2">
                              {o.complexity_units
                                ? `${Number(o.complexity_units).toFixed(1)}u`
                                : "—"}
                            </td>
                            <td className="py-1.5 px-2 font-sans">{baker}</td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border ${readiness.badgeClass} print:border-black print:text-black`}
                              >
                                {readiness.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Decorating Station Queue */}
            <div className="space-y-2 break-inside-avoid page-break-inside-avoid">
              <h5 className="text-xs uppercase tracking-wider font-bold text-pink-700 print:text-black flex items-center gap-1.5 border-b border-pink-500/30 print:border-black pb-1.5">
                ✨ Decorating Station Tasks ({dayDecoratingTasks.length})
              </h5>
              {dayDecoratingTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No decorating tasks scheduled for this date.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 print:border-black text-muted-foreground print:text-black font-medium">
                        <th className="py-1.5 px-2">#ID</th>
                        <th className="py-1.5 px-2">Customer</th>
                        <th className="py-1.5 px-2">Priority</th>
                        <th className="py-1.5 px-2">Complexity</th>
                        <th className="py-1.5 px-2">Assigned Decorator</th>
                        <th className="py-1.5 px-2">Readiness</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 print:divide-black/30 font-mono">
                      {dayDecoratingTasks.map((o) => {
                        const readiness = getProductionReadiness(o);
                        const decorator = o.assigned_decorator_id
                          ? getStaffDisplayName(staffMap.get(o.assigned_decorator_id))
                          : "Unassigned";
                        return (
                          <tr key={o.id}>
                            <td className="py-1.5 px-2 font-bold text-primary print:text-black">
                              #{o.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="py-1.5 px-2 font-sans font-medium text-foreground print:text-black">
                              {o.customer_name}
                            </td>
                            <td className="py-1.5 px-2 uppercase font-bold">
                              {o.production_priority || "NORMAL"}
                            </td>
                            <td className="py-1.5 px-2">
                              {o.complexity_units
                                ? `${Number(o.complexity_units).toFixed(1)}u`
                                : "—"}
                            </td>
                            <td className="py-1.5 px-2 font-sans">{decorator}</td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border ${readiness.badgeClass} print:border-black print:text-black`}
                              >
                                {readiness.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dispatch / Pickup Queue */}
            <div className="space-y-2 break-inside-avoid page-break-inside-avoid">
              <h5 className="text-xs uppercase tracking-wider font-bold text-teal-700 print:text-black flex items-center gap-1.5 border-b border-teal-500/30 print:border-black pb-1.5">
                📦 Dispatch / Pickup Queue ({dayDispatchTasks.length})
              </h5>
              {dayDispatchTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No orders staged for pickup on this date.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 print:border-black text-muted-foreground print:text-black font-medium">
                        <th className="py-1.5 px-2">#ID</th>
                        <th className="py-1.5 px-2">Customer</th>
                        <th className="py-1.5 px-2">Target Pickup</th>
                        <th className="py-1.5 px-2">Payment Status</th>
                        <th className="py-1.5 px-2">Balance Due</th>
                        <th className="py-1.5 px-2">Readiness</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 print:divide-black/30 font-mono">
                      {dayDispatchTasks.map((o) => {
                        const readiness = getProductionReadiness(o);
                        const paymentInfo = getPaymentBadgeInfo(o);
                        const quoted = Number(o.quoted_price_lkr || 0);
                        const paid = Number(o.amount_paid_lkr || 0);
                        const balanceDue = quoted > 0 ? Math.max(0, quoted - paid) : 0;
                        return (
                          <tr key={o.id}>
                            <td className="py-1.5 px-2 font-bold text-primary print:text-black">
                              #{o.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="py-1.5 px-2 font-sans font-medium text-foreground print:text-black">
                              {o.customer_name}
                            </td>
                            <td className="py-1.5 px-2 font-bold">
                              {o.target_pickup_time ? o.target_pickup_time.slice(0, 5) : "Flexible"}
                            </td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${paymentInfo.badgeClass} print:border-black print:text-black`}
                              >
                                {paymentInfo.label}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-sans font-bold">
                              {balanceDue > 0 ? formatLKR(balanceDue) : "Cleared (LKR 0)"}
                            </td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border ${readiness.badgeClass} print:border-black print:text-black`}
                              >
                                {readiness.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 6. Executive Shift Sign-off Footer */}
          <div className="pt-6 border-t-2 border-dashed border-black/50 grid grid-cols-2 gap-8 text-xs break-inside-avoid page-break-inside-avoid">
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">
                Kitchen Manager Sign-off:
              </span>
              <p className="text-[11px] text-muted-foreground print:text-black mt-0.5">
                Shift Operations & Capacity Verified
              </p>
              <div className="mt-6 border-b border-black w-48" />
            </div>
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">
                Head Baker / Production Lead:
              </span>
              <p className="text-[11px] text-muted-foreground print:text-black mt-0.5">
                Station Task Allocations Confirmed
              </p>
              <div className="mt-6 border-b border-black w-48" />
            </div>
          </div>

          <div className="border-t border-border/40 print:border-black/30 pt-3 text-[10px] text-muted-foreground print:text-black flex justify-between items-center">
            <span>SC Frost Heaven Pastry Operations — Confidential Administrative Briefing</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
