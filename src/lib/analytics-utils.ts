/**
 * SC FrostHeaven — Business & Kitchen Analytics Utilities
 * Phase 7G Implementation
 * 
 * Provides pure, timezone-safe mathematical models and aggregations for:
 * - Kitchen operations & throughput KPIs (Average production duration, completion rate, overdue/urgent/risk counts)
 * - 14-day production workload vs capacity horizon integration
 * - Staff workload distribution analytics
 * - CSV export serialization helpers
 * 
 * Reuses single-source-of-truth utilities:
 * - capacity-utils.ts
 * - staff-workload-utils.ts
 * - kitchen-operations-utils.ts
 * - order-readiness.ts
 */

import {
  calculateDailyCapacity,
  type DailyCapacityResult,
  type KitchenCapacitySetting,
  type BakeryBlackoutDate,
  type CapacityOrderInput,
} from "@/lib/capacity-utils";
import {
  type StaffDailyWorkloadResult,
  calculateStaffWorkloads,
  getStaffWorkloadSummary,
  DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE,
} from "@/lib/staff-workload-utils";
import {
  getLocalDateString,
  getOverdueInfo,
  getAtRiskInfo,
  type KitchenOrderInput,
} from "@/lib/kitchen-operations-utils";
import { getProductionReadiness } from "@/lib/order-readiness";

export interface ProductionDurationMetric {
  validOrdersCount: number;
  avgMinutes: number | null;
  formattedAvgDuration: string;
}

export interface ProductionCompletionRateMetric {
  completedCount: number;
  eligibleCount: number;
  ratePercent: number;
  formattedRate: string;
}

export interface KitchenOperationsKPIs {
  averageDuration: ProductionDurationMetric;
  completionRate: ProductionCompletionRateMetric;
  overdueOrdersCount: number;
  overdueProductionCount: number;
  overdueHandoverCount: number;
  urgentOrdersCount: number;
  atRiskOrdersCount: number;
  readyForProductionCount: number;
  inBakingCount: number;
  readyForPickupCount: number;
  paymentBlockedCount: number;
  activeOrdersCount: number;
}

export interface DailyWorkloadForecastItem {
  dateStr: string;
  label: string;
  dayOfWeek: number;
  dayName: string;
  eventOrderCount: number;
  bakeWorkloadUnits: number;
  decorateWorkloadUnits: number;
  productionWorkloadUnits: number;
  configuredDailyCapacity: number;
  remainingCapacityUnits: number;
  utilizationPercent: number;
  capacityState: string;
  capacityStateLabel: string;
  badgeClass: string;
  progressBarClass: string;
  isBlackout: boolean;
  blackoutReason?: string | undefined;
  hasBlackoutConflict: boolean;
  hasInvalidComplexity: boolean;
  invalidComplexityCount: number;
  rawCapacityResult: DailyCapacityResult;
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Calculates historical average production duration (production_started_at -> production_completed_at).
 * Only includes orders where both timestamps are valid ISO strings and completedAt >= startedAt.
 */
export function calculateAverageProductionDuration(
  orders: Array<{
    production_started_at?: string | null | undefined;
    production_completed_at?: string | null | undefined;
  }>
): ProductionDurationMetric {
  let validOrdersCount = 0;
  let totalMinutes = 0;

  for (const order of orders) {
    if (!order.production_started_at || !order.production_completed_at) {
      continue;
    }

    const startTime = new Date(order.production_started_at).getTime();
    const endTime = new Date(order.production_completed_at).getTime();

    if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) {
      continue;
    }

    const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));
    totalMinutes += durationMinutes;
    validOrdersCount++;
  }

  if (validOrdersCount === 0) {
    return {
      validOrdersCount: 0,
      avgMinutes: null,
      formattedAvgDuration: "—",
    };
  }

  const avgMinutes = Math.round(totalMinutes / validOrdersCount);
  const hours = Math.floor(avgMinutes / 60);
  const mins = avgMinutes % 60;

  let formattedAvgDuration = "";
  if (hours > 0) {
    formattedAvgDuration = `${hours}h ${mins}m`;
  } else {
    formattedAvgDuration = `${mins}m`;
  }

  return {
    validOrdersCount,
    avgMinutes,
    formattedAvgDuration,
  };
}

/**
 * Calculates deterministic production completion rate.
 * Numerator: completed orders
 * Denominator: orders eligible for production analysis (accepted, in_baking, ready, completed)
 * Excludes pre-quote/unaccepted orders and terminal declined/cancelled orders.
 */
export function calculateProductionCompletionRate(
  orders: Array<{ status: string }>
): ProductionCompletionRateMetric {
  const ELIGIBLE_PRODUCTION_STATUSES = ["accepted", "in_baking", "ready", "completed"];

  let completedCount = 0;
  let eligibleCount = 0;

  for (const order of orders) {
    const status = (order.status || "").toLowerCase().trim();
    if (status === "completed") {
      completedCount++;
      eligibleCount++;
    } else if (ELIGIBLE_PRODUCTION_STATUSES.includes(status)) {
      eligibleCount++;
    }
  }

  const ratePercent =
    eligibleCount > 0 ? Math.round((completedCount / eligibleCount) * 100) : 0;

  return {
    completedCount,
    eligibleCount,
    ratePercent,
    formattedRate: `${ratePercent}% (${completedCount}/${eligibleCount})`,
  };
}

/**
 * Aggregates all kitchen operational and efficiency KPIs for /admin/analytics.
 */
export function calculateKitchenOperationsKPIs(
  orders: KitchenOrderInput[],
  todayStr: string = getLocalDateString(),
  blackoutDates: BakeryBlackoutDate[] = [],
  overloadedStaffIds?: Set<string>
): KitchenOperationsKPIs {
  const averageDuration = calculateAverageProductionDuration(orders);
  const completionRate = calculateProductionCompletionRate(orders);

  const blackoutSet = new Set(blackoutDates.map((b) => b.blackout_date));
  const tomorrowDate = (() => {
    const parts = todayStr.split("-");
    const d = new Date(
      parseInt(parts[0] || "2026", 10),
      parseInt(parts[1] || "1", 10) - 1,
      parseInt(parts[2] || "1", 10) + 1,
      12,
      0,
      0
    );
    return getLocalDateString(d);
  })();

  let overdueOrdersCount = 0;
  let overdueProductionCount = 0;
  let overdueHandoverCount = 0;
  let urgentOrdersCount = 0;
  let atRiskOrdersCount = 0;
  let readyForProductionCount = 0;
  let inBakingCount = 0;
  let readyForPickupCount = 0;
  let paymentBlockedCount = 0;
  let activeOrdersCount = 0;

  for (const order of orders) {
    const statusLower = (order.status || "").toLowerCase().trim();
    const isTerminal = ["completed", "declined", "cancelled"].includes(statusLower);

    if (!isTerminal) {
      activeOrdersCount++;

      // Overdue check
      const overdueInfo = getOverdueInfo(order, todayStr);
      if (overdueInfo.isOverdue) {
        overdueOrdersCount++;
        if (overdueInfo.category === "production") overdueProductionCount++;
        else if (overdueInfo.category === "handover") overdueHandoverCount++;
      }

      // Urgent priority check
      if ((order.production_priority || "").toLowerCase().trim() === "urgent") {
        urgentOrdersCount++;
      }

      // At risk check
      const riskInfo = getAtRiskInfo(order, todayStr, tomorrowDate, {
        blackoutDates: blackoutSet,
        overloadedStaffIds,
      });
      if (riskInfo.isAtRisk) {
        atRiskOrdersCount++;
      }

      // Readiness checks
      const readiness = getProductionReadiness(order);
      if (readiness.key === "ready_for_production") {
        readyForProductionCount++;
      }

      if (statusLower === "in_baking") {
        inBakingCount++;
      } else if (statusLower === "ready") {
        readyForPickupCount++;
      }

      if (statusLower === "accepted" && readiness.key === "awaiting_deposit") {
        paymentBlockedCount++;
      }
    }
  }

  return {
    averageDuration,
    completionRate,
    overdueOrdersCount,
    overdueProductionCount,
    overdueHandoverCount,
    urgentOrdersCount,
    atRiskOrdersCount,
    readyForProductionCount,
    inBakingCount,
    readyForPickupCount,
    paymentBlockedCount,
    activeOrdersCount,
  };
}

/**
 * Computes a 14-day forward horizon separating Event Volume from Production Workload vs Capacity.
 */
export function calculate14DayWorkloadCapacityForecast(
  orders: (CapacityOrderInput & { event_date?: string | null })[],
  capacitySettings: KitchenCapacitySetting[],
  blackoutDates: BakeryBlackoutDate[],
  startDateYMD: string = getLocalDateString()
): DailyWorkloadForecastItem[] {
  const result: DailyWorkloadForecastItem[] = [];

  const parts = startDateYMD.split("-");
  const baseYear = parseInt(parts[0] || "2026", 10);
  const baseMonth = parseInt(parts[1] || "1", 10) - 1;
  const baseDay = parseInt(parts[2] || "1", 10);

  for (let i = 0; i < 14; i++) {
    const targetDate = new Date(baseYear, baseMonth, baseDay + i, 12, 0, 0);
    const dateStr = getLocalDateString(targetDate);
    const dayOfWeek = targetDate.getDay();
    const dayName = SHORT_WEEKDAYS[dayOfWeek] || "";

    let label = targetDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tomorrow";

    // 1. Event Order Count (Orders with celebration on this date)
    const eventOrders = orders.filter((o) => {
      if (!o.event_date) return false;
      const statusLower = (o.status || "").toLowerCase();
      if (["completed", "declined", "cancelled"].includes(statusLower)) return false;
      return o.event_date === dateStr;
    });

    // 2. Production Capacity & Workload on this date
    const capacityResult = calculateDailyCapacity(
      dateStr,
      orders,
      capacitySettings,
      blackoutDates
    );

    result.push({
      dateStr,
      label,
      dayOfWeek,
      dayName,
      eventOrderCount: eventOrders.length,
      bakeWorkloadUnits: capacityResult.bakeWorkloadUnits,
      decorateWorkloadUnits: capacityResult.decorateWorkloadUnits,
      productionWorkloadUnits: capacityResult.committedWorkloadUnits,
      configuredDailyCapacity: capacityResult.maxCapacityUnits,
      remainingCapacityUnits: capacityResult.remainingUnits,
      utilizationPercent: Math.round(capacityResult.utilizationPercent * 10) / 10,
      capacityState: capacityResult.state,
      capacityStateLabel: capacityResult.stateLabel,
      badgeClass: capacityResult.badgeClass,
      progressBarClass: capacityResult.progressBarClass,
      isBlackout: capacityResult.isBlackout,
      blackoutReason: capacityResult.blackoutReason,
      hasBlackoutConflict: capacityResult.hasBlackoutConflict,
      hasInvalidComplexity: Boolean(capacityResult.hasInvalidComplexity),
      invalidComplexityCount: capacityResult.invalidComplexityOrderCount || 0,
      rawCapacityResult: capacityResult,
    });
  }

  return result;
}

/**
 * Builds standard CSV rows for the Kitchen Capacity Report.
 */
export function generateCapacityReportCsvRows(
  forecastItems: DailyWorkloadForecastItem[]
): (string | number)[][] {
  return forecastItems.map((item) => {
    return [
      item.dateStr,
      item.dayName,
      item.configuredDailyCapacity.toFixed(1),
      item.bakeWorkloadUnits.toFixed(1),
      item.decorateWorkloadUnits.toFixed(1),
      item.productionWorkloadUnits.toFixed(1),
      item.remainingCapacityUnits.toFixed(1),
      `${item.utilizationPercent.toFixed(1)}%`,
      item.capacityStateLabel,
      item.isBlackout ? "Yes" : "No",
      item.blackoutReason || "",
      item.hasInvalidComplexity ? `${item.invalidComplexityCount} unrated orders` : "None",
    ];
  });
}

/**
 * Builds standard CSV rows for the Staff Workload Report.
 */
export function generateStaffWorkloadReportCsvRows(
  staffWorkloads: StaffDailyWorkloadResult[],
  dateStr: string
): (string | number)[][] {
  return staffWorkloads.map((w) => {
    return [
      w.staffName,
      dateStr,
      w.bakeUnits.toFixed(1),
      w.decorateUnits.toFixed(1),
      w.totalPhysicalWorkloadUnits.toFixed(1),
      w.bakeTaskCount,
      w.decorateTaskCount,
      w.totalDistinctOrdersCount,
      w.guidelineUnits.toFixed(1),
      `${w.utilizationPercent.toFixed(1)}%`,
      w.stateLabel,
      w.hasInvalidComplexity ? `${w.invalidComplexityOrderCount} orders missing complexity` : "Clean",
    ];
  });
}
