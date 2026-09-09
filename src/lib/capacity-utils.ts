/**
 * SC FrostHeaven — Kitchen Capacity Calculation & Management Utilities
 * Phase 7D Implementation
 * 
 * Provides pure, timezone-safe mathematical models for:
 * - Activity-based station workload allocation (Same-day single count, multi-day distinct allocation)
 * - Committed production workload vs tentative pipeline segregation
 * - Configurable weekday capacity limits & blackout closure management
 * - Over-capacity soft warnings & capacity threshold state badges
 */

export interface KitchenCapacitySetting {
  id?: string;
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  max_capacity_units: number;
  updated_at?: string;
}

export interface BakeryBlackoutDate {
  id?: string;
  blackout_date: string; // YYYY-MM-DD
  reason: string;
  created_at?: string;
}

export interface CapacityOrderInput {
  id: string;
  status: string;
  scheduled_bake_date?: string | null | undefined;
  scheduled_decorate_date?: string | null | undefined;
  complexity_units?: number | null | undefined;
  production_priority?: string | null | undefined;
  customer_name?: string | undefined;
}

export type CapacityState =
  | "within_capacity"
  | "near_capacity"
  | "over_capacity"
  | "blackout";

export interface DailyCapacityResult {
  dateYMD: string;
  dayOfWeek: number;
  maxCapacityUnits: number;
  committedWorkloadUnits: number;
  committedOrderCount: number;
  bakeTaskCount: number;
  bakeWorkloadUnits: number;
  decorateTaskCount: number;
  decorateWorkloadUnits: number;
  tentativeWorkloadUnits: number;
  tentativeOrderCount: number;
  remainingUnits: number;
  utilizationPercent: number;
  isBlackout: boolean;
  blackoutReason?: string | undefined;
  hasBlackoutConflict: boolean;
  state: CapacityState;
  stateLabel: string;
  badgeClass: string;
  progressBarClass: string;
  hasInvalidComplexity: boolean;
  invalidComplexityOrderCount: number;
}

// Fallback constant if a weekday setting is missing
export const DEFAULT_WEEKDAY_CAPACITY_FALLBACK = 8.0;

/**
 * Parses YYYY-MM-DD to local day of week (0 = Sunday ... 6 = Saturday)
 * Uses local noon timestamp to guarantee zero UTC drift.
 */
export function getLocalDayOfWeek(ymd: string): number {
  const parts = ymd.split("-");
  const year = parseInt(parts[0] || "2026", 10);
  const month = parseInt(parts[1] || "1", 10) - 1;
  const day = parseInt(parts[2] || "1", 10);
  const date = new Date(year, month, day, 12, 0, 0);
  return date.getDay();
}

/**
 * Determines if an order status is counted toward COMMITTED production capacity.
 * Counted: 'accepted', 'in_baking'.
 * Not counted: 'ready' (already baked/finished), 'completed', 'declined', 'cancelled'.
 */
export function isCommittedProductionStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  return s === "accepted" || s === "in_baking";
}

/**
 * Determines if an order status is part of the TENTATIVE pipeline.
 * Tentative: 'submitted', 'under_review', 'quoted'.
 */
export function isTentativePipelineStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  return s === "submitted" || s === "under_review" || s === "quoted";
}

/**
 * Sanitizes complexity units to valid numeric range (0.5 to 10.0), or returns null if invalid.
 */
export function sanitizeComplexityUnits(units: number | null | undefined): number | null {
  if (units === null || units === undefined || isNaN(units)) return null;
  const num = Number(units);
  if (num < 0.5 || num > 10.0) return null;
  return num;
}

/**
 * Calculates complete daily capacity metrics for a specific calendar date (YYYY-MM-DD).
 * 
 * Rules enforced:
 * 1. Activity-Based Station Allocation:
 *    - Order with Bake Mon, Decorate Tue (2.0u) -> Mon: 2.0u Bake, Tue: 2.0u Decorate.
 * 2. Same-Day Rule:
 *    - Order with Bake Mon, Decorate Mon (2.0u) -> Mon: counts 2.0u ONCE (NOT 4.0u).
 * 3. Status Inclusion:
 *    - Only 'accepted' and 'in_baking' consume committed capacity.
 *    - 'submitted', 'under_review', 'quoted' tracked as separate tentative pipeline.
 *    - 'ready', 'completed', 'declined', 'cancelled' do not consume capacity.
 * 4. Partially Scheduled Orders:
 *    - Only bake date -> allocated to bake date.
 *    - Only decorate date -> allocated to decorate date.
 * 5. Blackout Dates:
 *    - Capacity = 0. If workload > 0, flags hasBlackoutConflict = true without fake percentages.
 */
export function calculateDailyCapacity(
  dateYMD: string,
  orders: CapacityOrderInput[],
  capacitySettings: KitchenCapacitySetting[],
  blackoutDates: BakeryBlackoutDate[]
): DailyCapacityResult {
  const dayOfWeek = getLocalDayOfWeek(dateYMD);

  // 1. Check if date is a blackout date
  const blackoutMatch = blackoutDates.find((b) => b.blackout_date === dateYMD);
  const isBlackout = !!blackoutMatch;
  const blackoutReason = blackoutMatch?.reason;

  // 2. Lookup configured capacity for this weekday
  let maxCapacityUnits = 0;
  if (!isBlackout) {
    const setting = capacitySettings.find((s) => s.day_of_week === dayOfWeek);
    maxCapacityUnits = setting && setting.max_capacity_units > 0
      ? Number(setting.max_capacity_units)
      : DEFAULT_WEEKDAY_CAPACITY_FALLBACK;
  }

  // 3. Process committed orders scheduled on this date
  const committedOrdersOnDate = new Map<string, { order: CapacityOrderInput; validComplexity: number | null }>();
  let bakeTaskCount = 0;
  let bakeWorkloadUnits = 0;
  let decorateTaskCount = 0;
  let decorateWorkloadUnits = 0;
  let invalidComplexityOrderCount = 0;

  // Separate tracking for tentative pipeline
  const tentativeOrdersOnDate = new Map<string, { order: CapacityOrderInput; validComplexity: number | null }>();

  for (const order of orders) {
    const isBakeOnDate = order.scheduled_bake_date === dateYMD;
    const isDecorateOnDate = order.scheduled_decorate_date === dateYMD;

    if (!isBakeOnDate && !isDecorateOnDate) {
      continue;
    }

    const validComplexity = sanitizeComplexityUnits(order.complexity_units);
    if (validComplexity === null) {
      invalidComplexityOrderCount++;
    }

    // A. Committed Orders
    if (isCommittedProductionStatus(order.status)) {
      if (isBakeOnDate) {
        bakeTaskCount++;
        if (validComplexity !== null) {
          bakeWorkloadUnits += validComplexity;
        }
      }
      if (isDecorateOnDate) {
        decorateTaskCount++;
        if (validComplexity !== null) {
          decorateWorkloadUnits += validComplexity;
        }
      }
      // Store distinct order to enforce Same-Day Single Count rule for total daily workload
      committedOrdersOnDate.set(order.id, { order, validComplexity });
    }
    // B. Tentative Pipeline Orders
    else if (isTentativePipelineStatus(order.status)) {
      tentativeOrdersOnDate.set(order.id, { order, validComplexity });
    }
  }

  // Calculate distinct committed daily workload (Same-day single count rule)
  let committedWorkloadUnits = 0;
  committedOrdersOnDate.forEach(({ validComplexity }) => {
    if (validComplexity !== null) {
      committedWorkloadUnits += validComplexity;
    }
  });

  // Calculate distinct tentative daily workload
  let tentativeWorkloadUnits = 0;
  tentativeOrdersOnDate.forEach(({ validComplexity }) => {
    if (validComplexity !== null) {
      tentativeWorkloadUnits += validComplexity;
    }
  });

  committedWorkloadUnits = Math.round(committedWorkloadUnits * 10) / 10;
  bakeWorkloadUnits = Math.round(bakeWorkloadUnits * 10) / 10;
  decorateWorkloadUnits = Math.round(decorateWorkloadUnits * 10) / 10;
  tentativeWorkloadUnits = Math.round(tentativeWorkloadUnits * 10) / 10;

  // 4. Calculate remaining units & utilization
  const committedOrderCount = committedOrdersOnDate.size;
  const tentativeOrderCount = tentativeOrdersOnDate.size;

  let remainingUnits = 0;
  let utilizationPercent = 0;
  let state: CapacityState = "within_capacity";
  let stateLabel = "Within Capacity";
  let badgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  let progressBarClass = "bg-emerald-500";
  const hasBlackoutConflict = isBlackout && committedWorkloadUnits > 0;

  if (isBlackout) {
    state = "blackout";
    remainingUnits = -committedWorkloadUnits;
    utilizationPercent = 0;
    if (hasBlackoutConflict) {
      stateLabel = `Closed — ${committedOrderCount} ${committedOrderCount === 1 ? "order" : "orders"} scheduled`;
      badgeClass = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold";
      progressBarClass = "bg-rose-500";
    } else {
      stateLabel = "Bakery Closed (Blackout)";
      badgeClass = "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30";
      progressBarClass = "bg-zinc-500";
    }
  } else {
    remainingUnits = Math.round((maxCapacityUnits - committedWorkloadUnits) * 10) / 10;
    utilizationPercent = maxCapacityUnits > 0
      ? (committedWorkloadUnits / maxCapacityUnits) * 100
      : 0;

    if (utilizationPercent > 100) {
      state = "over_capacity";
      stateLabel = "Over Capacity";
      badgeClass = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold";
      progressBarClass = "bg-rose-500";
    } else if (utilizationPercent > 80) {
      state = "near_capacity";
      stateLabel = "Near Capacity";
      badgeClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold";
      progressBarClass = "bg-amber-500";
    } else {
      state = "within_capacity";
      stateLabel = "Within Capacity";
      badgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
      progressBarClass = "bg-emerald-500";
    }
  }

  return {
    dateYMD,
    dayOfWeek,
    maxCapacityUnits,
    committedWorkloadUnits,
    committedOrderCount,
    bakeTaskCount,
    bakeWorkloadUnits,
    decorateTaskCount,
    decorateWorkloadUnits,
    tentativeWorkloadUnits,
    tentativeOrderCount,
    remainingUnits,
    utilizationPercent,
    isBlackout,
    blackoutReason,
    hasBlackoutConflict,
    state,
    stateLabel,
    badgeClass,
    progressBarClass,
    hasInvalidComplexity: invalidComplexityOrderCount > 0,
    invalidComplexityOrderCount,
  };
}

/**
 * Previews the capacity impact of scheduling or rescheduling an order on a target date.
 * Allows live before-and-after comparison and over-capacity / blackout warnings before saving.
 */
export function previewScheduleImpact(
  targetDateYMD: string,
  orderIdToSchedule: string,
  complexityUnits: number,
  allOrders: CapacityOrderInput[],
  capacitySettings: KitchenCapacitySetting[],
  blackoutDates: BakeryBlackoutDate[]
): {
  currentWorkload: number;
  newWorkload: number;
  maxCapacity: number;
  currentUtilization: number;
  newUtilization: number;
  isOverCapacity: boolean;
  overageUnits: number;
  isBlackout: boolean;
  blackoutReason?: string | undefined;
  warningMessage: string | null;
  requiresConfirmation: boolean;
} {
  const currentResult = calculateDailyCapacity(
    targetDateYMD,
    allOrders,
    capacitySettings,
    blackoutDates
  );

  const currentWorkload = currentResult.committedWorkloadUnits;
  const maxCapacity = currentResult.maxCapacityUnits;

  // Check if this order is already currently counted on this date
  const isAlreadyOnDate = allOrders.some(
    (o) =>
      o.id === orderIdToSchedule &&
      isCommittedProductionStatus(o.status) &&
      (o.scheduled_bake_date === targetDateYMD || o.scheduled_decorate_date === targetDateYMD)
  );

  const newWorkload = isAlreadyOnDate
    ? currentWorkload // workload unchanged or modified
    : currentWorkload + complexityUnits;

  const currentUtilization = currentResult.utilizationPercent;
  const newUtilization = maxCapacity > 0 ? (newWorkload / maxCapacity) * 100 : 0;
  const isOverCapacity = !currentResult.isBlackout && newWorkload > maxCapacity;
  const overageUnits = Math.max(0, newWorkload - maxCapacity);

  let warningMessage: string | null = null;
  let requiresConfirmation = false;

  if (currentResult.isBlackout) {
    requiresConfirmation = true;
    warningMessage = `Bakery is CLOSED on ${targetDateYMD}${
      currentResult.blackoutReason ? ` (${currentResult.blackoutReason})` : ""
    }. Scheduling on this date requires administrative override.`;
  } else if (isOverCapacity) {
    requiresConfirmation = true;
    warningMessage = `Workload Notice: Scheduling this order increases ${targetDateYMD} workload to ${newWorkload.toFixed(
      1
    )} / ${maxCapacity.toFixed(1)} units (${newUtilization.toFixed(
      1
    )}% utilization — ${overageUnits.toFixed(1)} units over capacity).`;
  }

  return {
    currentWorkload,
    newWorkload,
    maxCapacity,
    currentUtilization,
    newUtilization,
    isOverCapacity,
    overageUnits,
    isBlackout: currentResult.isBlackout,
    blackoutReason: currentResult.blackoutReason,
    warningMessage,
    requiresConfirmation,
  };
}
