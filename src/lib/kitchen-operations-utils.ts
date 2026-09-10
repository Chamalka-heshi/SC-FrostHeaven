/**
 * SC FrostHeaven — Kitchen Operations Integration Utilities
 * Phase 7F Implementation
 *
 * Pure, timezone-safe models and helpers for:
 * - Deterministic Overdue detection and classification (Overdue Production vs Overdue Handover)
 * - Deterministic At-Risk order identification with explicit blocker reasons
 * - Conceptual Workstation Routing (Baking Station, Decorating Station, Dispatch / Pickup)
 * - Production timestamps, elapsed timers, and turnaround duration formatting
 * - Deterministic Priority & Pickup Time sorting
 * - Timezone-safe local calendar helpers
 */

import { getProductionReadiness } from "@/lib/order-readiness";

export type KitchenWorkstation = "all" | "baking" | "decorating" | "dispatch";

export type KitchenOperationalFilter =
  | "all"
  | "baking"
  | "decorating"
  | "dispatch"
  | "ready_to_bake"
  | "in_baking"
  | "payment_blocked"
  | "urgent"
  | "overdue"
  | "at_risk"
  | "my_work"
  | "unassigned_staff";

export interface KitchenOrderInput {
  id: string;
  status: string;
  event_date: string; // YYYY-MM-DD
  event_type?: string | undefined;
  customer_name?: string | undefined;
  customer_email?: string | undefined;
  customer_phone?: string | null | undefined;
  cake_details?: string | undefined;
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | undefined;
  payment_status?: string | null | undefined;
  payment_method?: string | null | undefined;
  scheduled_bake_date?: string | null | undefined;
  scheduled_decorate_date?: string | null | undefined;
  target_pickup_time?: string | null | undefined;
  production_priority?: string | null | undefined;
  complexity_units?: number | null | undefined;
  assigned_baker_id?: string | null | undefined;
  assigned_decorator_id?: string | null | undefined;
  production_started_at?: string | null | undefined;
  production_completed_at?: string | null | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

export interface OverdueInfo {
  isOverdue: boolean;
  daysOverdue: number;
  category: "production" | "handover" | "general" | "none";
  label: string;
  badgeClass: string;
}

export interface AtRiskInfo {
  isAtRisk: boolean;
  reasons: string[];
  severity: "high" | "medium" | "none";
  label: string;
  badgeClass: string;
}

export interface ProductionDurationInfo {
  hasStarted: boolean;
  hasCompleted: boolean;
  elapsedMinutes: number | null;
  formattedDuration: string;
  formattedStartTime: string;
  formattedCompletedTime: string;
}

/**
 * Returns a timezone-safe local date string (YYYY-MM-DD).
 * Uses local calendar components (getFullYear, getMonth, getDate).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calculates local day difference (dateB - dateA) in days.
 * Pure YYYY-MM-DD parsing instantiated at noon to prevent daylight / UTC shifts.
 */
export function getDayDifference(ymdA: string, ymdB: string): number {
  if (!ymdA || !ymdB) return 0;
  const parseNoon = (str: string): Date => {
    const parts = str.split("-");
    const y = parseInt(parts[0] || "2026", 10);
    const m = parseInt(parts[1] || "1", 10) - 1;
    const d = parseInt(parts[2] || "1", 10);
    return new Date(y, m, d, 12, 0, 0);
  };
  const diffMs = parseNoon(ymdB).getTime() - parseNoon(ymdA).getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic Overdue Evaluation.
 * An order is overdue if its event_date is strictly prior to today's local date
 * AND its status is not a terminal state (completed, declined, cancelled).
 */
export function getOverdueInfo(
  order: KitchenOrderInput,
  todayStr: string = getLocalDateString(),
): OverdueInfo {
  const statusLower = (order.status || "").toLowerCase().trim();
  const terminal = ["completed", "declined", "cancelled"];

  if (terminal.includes(statusLower) || !order.event_date) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      category: "none",
      label: "",
      badgeClass: "",
    };
  }

  // Compare strictly on YYYY-MM-DD strings
  if (order.event_date < todayStr) {
    const days = Math.max(1, getDayDifference(order.event_date, todayStr));
    const dayLabel = days === 1 ? "1 day" : `${days} days`;

    if (statusLower === "ready") {
      return {
        isOverdue: true,
        daysOverdue: days,
        category: "handover",
        label: `Overdue Handover (${dayLabel})`,
        badgeClass: "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30",
      };
    }

    if (statusLower === "accepted" || statusLower === "in_baking") {
      return {
        isOverdue: true,
        daysOverdue: days,
        category: "production",
        label: `Overdue Production (${dayLabel})`,
        badgeClass: "bg-red-500/20 text-red-900 dark:text-red-200 border-red-500/40 font-bold",
      };
    }

    return {
      isOverdue: true,
      daysOverdue: days,
      category: "general",
      label: `Overdue Order (${dayLabel})`,
      badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    };
  }

  return {
    isOverdue: false,
    daysOverdue: 0,
    category: "none",
    label: "",
    badgeClass: "",
  };
}

/**
 * Deterministic At-Risk Order Evaluation.
 * An active order is at-risk if:
 * 1. event_date is today or tomorrow (or upcoming within next 2 days)
 * 2. Status is not completed/declined/cancelled
 * 3. One or more explicit operational blockers exist:
 *    - Missing scheduled bake date
 *    - Missing scheduled decorate date
 *    - Missing assigned baker
 *    - Missing assigned decorator
 *    - Payment blocked (deposit required but unpaid)
 *    - Capacity conflict or staff overload
 */
export interface AtRiskOptions {
  overloadedStaffIds?: Set<string> | undefined;
  blackoutDates?: Set<string> | undefined;
}

export function getAtRiskInfo(
  order: KitchenOrderInput,
  todayStr: string = getLocalDateString(),
  tomorrowStr?: string,
  options?: AtRiskOptions,
): AtRiskInfo {
  const statusLower = (order.status || "").toLowerCase().trim();
  const terminal = ["completed", "declined", "cancelled"];

  if (terminal.includes(statusLower) || !order.event_date) {
    return { isAtRisk: false, reasons: [], severity: "none", label: "", badgeClass: "" };
  }

  const calcTomorrowStr =
    tomorrowStr ||
    (() => {
      const parts = todayStr.split("-");
      const d = new Date(
        parseInt(parts[0] || "2026", 10),
        parseInt(parts[1] || "1", 10) - 1,
        parseInt(parts[2] || "1", 10) + 1,
        12,
        0,
        0,
      );
      return getLocalDateString(d);
    })();

  const daysToEvent = getDayDifference(todayStr, order.event_date);
  const isImminent = daysToEvent >= 0 && daysToEvent <= 2; // Today, tomorrow, or day after

  const reasons: string[] = [];

  // Check 1: Payment Blocked (Accepted order missing required deposit)
  const readiness = getProductionReadiness(order);
  const isPaymentBlocked = statusLower === "accepted" && readiness.key === "awaiting_deposit";
  if (isPaymentBlocked) {
    reasons.push("Payment Blocked (Deposit Pending)");
  }

  // If already ready, it is staged for pickup; only payment is a risk
  if (statusLower === "ready") {
    if (isPaymentBlocked) {
      return {
        isAtRisk: true,
        reasons,
        severity: "medium",
        label: "At Risk: Payment Blocked",
        badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
      };
    }
    return { isAtRisk: false, reasons: [], severity: "none", label: "", badgeClass: "" };
  }

  // Active unbaked/in-baking orders:
  if (isImminent) {
    if (!order.scheduled_bake_date) {
      reasons.push("Missing Bake Date");
    }
    if (!order.scheduled_decorate_date) {
      reasons.push("Missing Decorate Date");
    }
    if (!order.assigned_baker_id) {
      reasons.push("Unassigned Baker");
    }
    if (!order.assigned_decorator_id) {
      reasons.push("Unassigned Decorator");
    }
  }

  // Check 2: Blackout Conflict
  if (options?.blackoutDates) {
    if (order.scheduled_bake_date && options.blackoutDates.has(order.scheduled_bake_date)) {
      reasons.push("Bake Date on Bakery Blackout Closure");
    }
    if (order.scheduled_decorate_date && options.blackoutDates.has(order.scheduled_decorate_date)) {
      reasons.push("Decorate Date on Bakery Blackout Closure");
    }
  }

  // Check 3: Staff Overload Conflict
  if (options?.overloadedStaffIds) {
    if (order.assigned_baker_id && options.overloadedStaffIds.has(order.assigned_baker_id)) {
      reasons.push("Assigned Baker Overloaded");
    }
    if (
      order.assigned_decorator_id &&
      options.overloadedStaffIds.has(order.assigned_decorator_id)
    ) {
      reasons.push("Assigned Decorator Overloaded");
    }
  }

  if (reasons.length > 0) {
    const isHigh =
      isImminent &&
      (reasons.includes("Missing Bake Date") ||
        reasons.includes("Unassigned Baker") ||
        isPaymentBlocked);
    return {
      isAtRisk: true,
      reasons,
      severity: isHigh ? "high" : "medium",
      label: `At Risk (${reasons.length} ${reasons.length === 1 ? "blocker" : "blockers"})`,
      badgeClass: isHigh
        ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/40 font-semibold"
        : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20",
    };
  }

  return { isAtRisk: false, reasons: [], severity: "none", label: "", badgeClass: "" };
}

/**
 * Workstation Routing Rules (Purely Derived):
 *
 * 1. Baking Station:
 *    - scheduled_bake_date === selectedDate
 *    - OR status === 'in_baking' (active in oven/station)
 *    - Excludes terminal orders and ready orders.
 *
 * 2. Decorating Station:
 *    - scheduled_decorate_date === selectedDate
 *    - Excludes terminal orders and ready orders.
 *
 * 3. Dispatch / Pickup:
 *    - status === 'ready'
 *    - Especially where event_date === selectedDate or awaiting handover.
 */
export function isBakingTaskForDate(
  order: KitchenOrderInput,
  selectedDate: string = getLocalDateString(),
): boolean {
  const statusLower = (order.status || "").toLowerCase().trim();
  const terminal = ["completed", "declined", "cancelled", "ready"];
  if (terminal.includes(statusLower)) return false;

  if (order.scheduled_bake_date === selectedDate) return true;
  if (statusLower === "in_baking") return true;
  // Fallback if unscheduled: accepted with event_date <= selectedDate
  if (
    statusLower === "accepted" &&
    !order.scheduled_bake_date &&
    order.event_date &&
    order.event_date <= selectedDate
  ) {
    return true;
  }
  return false;
}

export function isDecoratingTaskForDate(
  order: KitchenOrderInput,
  selectedDate: string = getLocalDateString(),
): boolean {
  const statusLower = (order.status || "").toLowerCase().trim();
  const terminal = ["completed", "declined", "cancelled", "ready"];
  if (terminal.includes(statusLower)) return false;

  if (order.scheduled_decorate_date === selectedDate) return true;
  // Fallback if bake is done or scheduled today with decorate unspecified
  if (
    statusLower === "in_baking" &&
    !order.scheduled_decorate_date &&
    (order.scheduled_bake_date === selectedDate ||
      (!order.scheduled_bake_date && order.event_date <= selectedDate))
  ) {
    return true;
  }
  return false;
}

export function isDispatchTaskForDate(order: KitchenOrderInput, selectedDate?: string): boolean {
  const statusLower = (order.status || "").toLowerCase().trim();
  if (statusLower !== "ready") return false;
  if (!selectedDate) return true;
  return Boolean(
    order.event_date === selectedDate || (order.event_date && order.event_date <= selectedDate),
  );
}

/**
 * Production Timestamps & Elapsed Duration Calculations:
 */
export function formatProductionDuration(
  startedAt?: string | null | undefined,
  completedAt?: string | null | undefined,
  nowTimestamp: number = Date.now(),
): ProductionDurationInfo {
  if (!startedAt) {
    return {
      hasStarted: false,
      hasCompleted: false,
      elapsedMinutes: null,
      formattedDuration: "Duration unavailable",
      formattedStartTime: "—",
      formattedCompletedTime: "—",
    };
  }

  const startTime = new Date(startedAt).getTime();
  if (isNaN(startTime)) {
    return {
      hasStarted: false,
      hasCompleted: false,
      elapsedMinutes: null,
      formattedDuration: "Duration unavailable",
      formattedStartTime: "—",
      formattedCompletedTime: "—",
    };
  }

  const formattedStartTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startTime));

  let endTime = nowTimestamp;
  let hasCompleted = false;
  let formattedCompletedTime = "—";

  if (completedAt) {
    const compTime = new Date(completedAt).getTime();
    if (!isNaN(compTime) && compTime >= startTime) {
      endTime = compTime;
      hasCompleted = true;
      formattedCompletedTime = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(compTime));
    }
  }

  const diffMs = Math.max(0, endTime - startTime);
  const elapsedMinutes = Math.floor(diffMs / (1000 * 60));

  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;

  let formattedDuration = "";
  if (hours > 0) {
    formattedDuration = `${hours}h ${mins}m`;
  } else {
    formattedDuration = `${mins}m`;
  }

  return {
    hasStarted: true,
    hasCompleted,
    elapsedMinutes,
    formattedDuration,
    formattedStartTime,
    formattedCompletedTime,
  };
}

/**
 * Priority Rank:
 * urgent (3) > high (2) > normal (1) > other (0)
 */
export function getPriorityRank(priority?: string | null | undefined): number {
  const p = (priority || "").toLowerCase().trim();
  if (p === "urgent") return 3;
  if (p === "high") return 2;
  if (p === "normal") return 1;
  return 1;
}

/**
 * Deterministic Sorting for Kitchen Orders:
 * 1. Priority (urgent -> high -> normal)
 * 2. Target Pickup Time ascending (e.g. 09:00 before 14:00; missing times last)
 * 3. Event Date ascending
 * 4. Short Order ID deterministic tie-breaker
 */
export function sortKitchenOrders<T extends KitchenOrderInput>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    // 1. Priority rank descending
    const rankA = getPriorityRank(a.production_priority);
    const rankB = getPriorityRank(b.production_priority);
    if (rankA !== rankB) {
      return rankB - rankA;
    }

    // 2. Target pickup time ascending
    const timeA = (a.target_pickup_time || "").trim();
    const timeB = (b.target_pickup_time || "").trim();
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;

    // 3. Event date ascending
    const dateA = a.event_date || "";
    const dateB = b.event_date || "";
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // 4. Deterministic ID tie-breaker
    return (a.id || "").localeCompare(b.id || "");
  });
}
