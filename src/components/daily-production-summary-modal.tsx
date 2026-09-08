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
  User,
  Sparkles,
  Flame,
  AlertCircle,
} from "lucide-react";
import type { KitchenOrder } from "@/components/kitchen-production-view";
import { formatLKR, getProductionReadiness, getPaymentBadgeInfo } from "@/lib/order-readiness";
import { getStaffDisplayName, type StaffProfileInput } from "@/lib/staff-workload-utils";
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
  type KitchenWorkstation,
} from "@/lib/kitchen-operations-utils";

interface DailyProductionSummaryModalProps {
  orders: KitchenOrder[];
  selectedDate?: string | undefined;
  staffList?: StaffProfileInput[] | undefined;
  capacitySettings?: KitchenCapacitySetting[] | undefined;
  blackoutDates?: BakeryBlackoutDate[] | undefined;
  onClose: () => void;
}

export function DailyProductionSummaryModal({
  orders,
  selectedDate,
  staffList = [],
  capacitySettings = [],
  blackoutDates = [],
  onClose,
}: DailyProductionSummaryModalProps) {
  const [workstationFilter, setWorkstationFilter] = useState<KitchenWorkstation>("all");

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffProfileInput>();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  const displayDate = selectedDate || getLocalDateString(new Date());

  const formattedDate = useMemo(() => {
    try {
      const parts = displayDate.split("-");
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
      return displayDate;
    }
  }, [displayDate]);

  // Capacity calculation for the selected date
  const capacityResult: DailyCapacityResult = useMemo(() => {
    return calculateDailyCapacity(displayDate, orders, capacitySettings, blackoutDates);
  }, [displayDate, orders, capacitySettings, blackoutDates]);

  // Filter orders relevant for this date or active in kitchen
  const allDayOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = o.status.toLowerCase();
      if (s === "completed" || s === "declined" || s === "cancelled") return false;
      return (
        o.scheduled_bake_date === displayDate ||
        o.scheduled_decorate_date === displayDate ||
        o.event_date === displayDate ||
        s === "in_baking" ||
        (s === "accepted" && (!o.scheduled_bake_date || o.scheduled_bake_date <= displayDate) && o.event_date <= displayDate)
      );
    });
  }, [orders, displayDate]);

  // Workstation filtered orders
  const dayOrders = useMemo(() => {
    if (workstationFilter === "all") return allDayOrders;
    if (workstationFilter === "baking") {
      return allDayOrders.filter((o) => isBakingTaskForDate(o, displayDate));
    }
    if (workstationFilter === "decorating") {
      return allDayOrders.filter((o) => isDecoratingTaskForDate(o, displayDate));
    }
    if (workstationFilter === "dispatch") {
      return allDayOrders.filter((o) => isDispatchTaskForDate(o, displayDate));
    }
    return allDayOrders;
  }, [allDayOrders, workstationFilter, displayDate]);

  const inBakingCount = allDayOrders.filter((o) => o.status.toLowerCase() === "in_baking").length;
  const readyCount = allDayOrders.filter((o) => o.status.toLowerCase() === "ready").length;
  const readyToBakeCount = allDayOrders.filter((o) => {
    const r = getProductionReadiness(o);
    return r.key === "ready_for_production";
  }).length;
  const totalCount = allDayOrders.length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-card shadow-2xl border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none">
        {/* Header - Screen only controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 px-6 py-4 bg-muted/40 sticky top-0 z-20 backdrop-blur-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Daily Kitchen Production Run Sheet
              </h3>
              <p className="text-xs text-muted-foreground">
                Printable operational summary with workstation filters & capacity tracking
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Workstation Filter Toggle */}
            <div className="flex items-center gap-1 bg-card border border-border/80 rounded-full p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setWorkstationFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  workstationFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({allDayOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setWorkstationFilter("baking")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  workstationFilter === "baking"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Baking
              </button>
              <button
                type="button"
                onClick={() => setWorkstationFilter("decorating")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  workstationFilter === "decorating"
                    ? "bg-pink-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Decorating
              </button>
              <button
                type="button"
                onClick={() => setWorkstationFilter("dispatch")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  workstationFilter === "dispatch"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dispatch
              </button>
            </div>

            <Button
              onClick={handlePrint}
              size="sm"
              className="rounded-full gap-1.5 bg-primary text-primary-foreground shadow-xs cursor-pointer hover:bg-primary/90"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Run Sheet</span>
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

        {/* Printable Production Sheet Body */}
        <div
          id="daily-summary-printable"
          className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-0 print:overflow-visible text-foreground"
        >
          {/* Bakery Header & Branding */}
          <div className="border-b-2 border-primary/40 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-xs font-bold tracking-widest uppercase text-primary font-mono">
                SC FROST HEAVEN BAKERY
              </span>
              <h1 className="text-2xl font-bold text-foreground">
                Daily Kitchen Production Run Sheet
              </h1>
            </div>
            <div className="text-left sm:text-right text-xs text-muted-foreground font-mono">
              <div className="font-semibold text-foreground flex items-center sm:justify-end gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{formattedDate}</span>
              </div>
              <p className="mt-0.5">
                Generated:{" "}
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Daily Capacity & Workload Summary Banner */}
          <div className="rounded-2xl border border-border p-3.5 bg-secondary/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Bakery Daily Capacity:
              </span>
              <p className="text-muted-foreground">
                {capacityResult.isBlackout
                  ? `Blackout Closure: ${capacityResult.blackoutReason || "Closed"}`
                  : `${capacityResult.committedWorkloadUnits.toFixed(1)} / ${capacityResult.maxCapacityUnits.toFixed(1)} units (${capacityResult.utilizationPercent.toFixed(0)}% used • ${capacityResult.remainingUnits.toFixed(1)}u remaining)`}
              </p>
            </div>
            <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold border ${capacityResult.badgeClass}`}>
              {capacityResult.stateLabel}
            </span>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border p-3.5 bg-secondary/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Scheduled
              </span>
              <div className="text-2xl font-bold text-foreground mt-0.5">{totalCount}</div>
            </div>

            <div className="rounded-2xl border border-purple-500/30 p-3.5 bg-purple-500/5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                In Baking
              </span>
              <div className="text-2xl font-bold text-purple-700 mt-0.5">{inBakingCount}</div>
            </div>

            <div className="rounded-2xl border border-teal-500/30 p-3.5 bg-teal-500/5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                Ready for Pickup
              </span>
              <div className="text-2xl font-bold text-teal-700 mt-0.5">{readyCount}</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 p-3.5 bg-emerald-500/5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Ready to Bake
              </span>
              <div className="text-2xl font-bold text-emerald-700 mt-0.5">{readyToBakeCount}</div>
            </div>
          </div>

          {/* Operational Orders Table */}
          {dayOrders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
              No active cake orders match the current workstation filter for {formattedDate}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/40 text-foreground font-semibold">
                    <th className="py-3 px-3">#ID & Priority</th>
                    <th className="py-3 px-3">Customer & Contact</th>
                    <th className="py-3 px-3">Celebration</th>
                    <th className="py-3 px-3">Schedule & Pickup</th>
                    <th className="py-3 px-3 w-1/3">Cake Details & Specs</th>
                    <th className="py-3 px-3">Assigned Staff</th>
                    <th className="py-3 px-3">Payment & Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {dayOrders.map((order) => {
                    const shortId = order.id.slice(0, 8).toUpperCase();
                    const readiness = getProductionReadiness(order);
                    const paymentInfo = getPaymentBadgeInfo(order);
                    const overdueInfo = getOverdueInfo(order, displayDate);
                    const riskInfo = getAtRiskInfo(order, displayDate);

                    return (
                      <tr key={order.id} className="hover:bg-muted/20">
                        <td className="py-3 px-3 font-mono font-bold align-top">
                          <div className="text-primary">#{shortId}</div>
                          {order.production_priority && order.production_priority !== "normal" && (
                            <span
                              className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                order.production_priority === "urgent"
                                  ? "bg-rose-500/20 text-rose-800"
                                  : "bg-blue-500/20 text-blue-800"
                              }`}
                            >
                              {order.production_priority}
                            </span>
                          )}
                          {order.complexity_units && (
                            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 mt-0.5">
                              ⚡ {Number(order.complexity_units).toFixed(1)}u
                            </div>
                          )}
                          {overdueInfo.isOverdue && (
                            <div className="mt-1 inline-block rounded bg-red-500/20 text-red-900 px-1.5 py-0.5 text-[9px] font-bold">
                              🚨 Overdue
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top font-medium">
                          <div className="text-foreground font-semibold">{order.customer_name}</div>
                          {order.customer_phone && (
                            <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
                              {order.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top font-medium text-foreground">
                          {order.event_type}
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Event: {order.event_date}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top font-mono text-muted-foreground whitespace-nowrap space-y-0.5 text-[11px]">
                          {order.scheduled_bake_date && <div>Bake: {order.scheduled_bake_date}</div>}
                          {order.scheduled_decorate_date && <div>Decor: {order.scheduled_decorate_date}</div>}
                          {order.target_pickup_time && (
                            <div className="font-bold text-foreground">
                              Pickup: {order.target_pickup_time.slice(0, 5)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <p className="text-foreground leading-relaxed">{order.cake_details}</p>
                          {(order.internal_notes || order.admin_notes) && (
                            <div className="mt-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                              <span className="font-bold">Kitchen Note:</span>{" "}
                              {order.internal_notes || order.admin_notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap text-[11px] space-y-1">
                          <div>
                            <span className="text-purple-700 font-semibold">🥣 Baker:</span>{" "}
                            <span className="text-foreground font-medium">
                              {order.assigned_baker_id
                                ? getStaffDisplayName(staffMap.get(order.assigned_baker_id))
                                : "Unassigned"}
                            </span>
                          </div>
                          <div>
                            <span className="text-pink-700 font-semibold">✨ Decor:</span>{" "}
                            <span className="text-foreground font-medium">
                              {order.assigned_decorator_id
                                ? getStaffDisplayName(staffMap.get(order.assigned_decorator_id))
                                : "Unassigned"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap space-y-1">
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${readiness.badgeClass}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${readiness.dotClass}`} />
                              {readiness.label}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${paymentInfo.badgeClass}`}
                            >
                              {paymentInfo.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase">
                            Status: {order.status}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Note */}
          <div className="border-t border-border pt-4 text-[10px] text-muted-foreground flex justify-between items-center">
            <span>SC Frost Heaven Pastry Operations — Confidential Kitchen Schedule</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
