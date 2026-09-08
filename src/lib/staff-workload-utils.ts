/**
 * SC FrostHeaven — Staff Assignment & Workload Management Utilities
 * Phase 7E Implementation
 * 
 * Pure, timezone-safe mathematical models and helpers for:
 * - Baker & Decorator role assignment states
 * - Activity-based staff workload calculation (Same-day single count, multi-day distinct allocation)
 * - Committed production status gating ('accepted', 'in_baking')
 * - Soft daily staff workload guideline (6.0u) & threshold states
 * - Assignment impact preview & soft overload warnings
 * - Staff-based order filtering & unassigned queue management
 */

export const DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE = 6.0;

export interface StaffProfileInput {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: string | undefined;
}

export interface StaffOrderInput {
  id: string;
  status: string;
  customer_name?: string | undefined;
  event_date?: string | null | undefined;
  scheduled_bake_date?: string | null | undefined;
  scheduled_decorate_date?: string | null | undefined;
  complexity_units?: number | null | undefined;
  assigned_baker_id?: string | null | undefined;
  assigned_decorator_id?: string | null | undefined;
  production_priority?: string | null | undefined;
}

export type AssignmentState =
  | "fully_assigned"
  | "baker_only"
  | "decorator_only"
  | "unassigned";

export type StaffWorkloadState =
  | "within_guideline"
  | "near_guideline"
  | "overloaded";

export interface StaffDailyWorkloadResult {
  staffId: string;
  staffName: string;
  dateYMD: string;
  guidelineUnits: number;
  totalPhysicalWorkloadUnits: number;
  bakeUnits: number;
  decorateUnits: number;
  bakeTaskCount: number;
  decorateTaskCount: number;
  totalDistinctOrdersCount: number;
  utilizationPercent: number;
  state: StaffWorkloadState;
  stateLabel: string;
  badgeClass: string;
  progressBarClass: string;
  hasInvalidComplexity: boolean;
  invalidComplexityOrderCount: number;
}

export interface StaffWorkloadSummaryResult {
  dateYMD: string;
  totalStaffCount: number;
  activeStaffCount: number;
  totalAssignedWorkloadUnits: number;
  overloadedStaffCount: number;
  unassignedBakersCount: number;
  unassignedDecoratorsCount: number;
  staffWorkloads: StaffDailyWorkloadResult[];
}

/**
 * Determines if an order status is counted toward COMMITTED staff workload.
 * Counted: 'accepted', 'in_baking'.
 * Excluded: 'submitted', 'under_review', 'quoted' (tentative pipeline),
 *           'ready' (already completed in kitchen), 'completed', 'declined', 'cancelled'.
 */
export function isStaffWorkloadStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  return s === "accepted" || s === "in_baking";
}

/**
 * Derives a clean human-readable display name for a staff member.
 * Prefers full_name, falls back to email username before '@', or 'Staff Member'.
 */
export function getStaffDisplayName(staff: StaffProfileInput | null | undefined): string {
  if (!staff) return "Unassigned";
  if (staff.full_name && staff.full_name.trim().length > 0) {
    return staff.full_name.trim();
  }
  if (staff.email && staff.email.includes("@")) {
    const username = staff.email.split("@")[0]?.trim();
    if (username && username.length > 0) {
      return username.charAt(0).toUpperCase() + username.slice(1);
    }
  }
  return "Staff Member";
}

/**
 * Categorizes an order's staff assignment completeness.
 */
export function getAssignmentState(order: StaffOrderInput): AssignmentState {
  const hasBaker = Boolean(order.assigned_baker_id && order.assigned_baker_id.trim().length > 0);
  const hasDecorator = Boolean(order.assigned_decorator_id && order.assigned_decorator_id.trim().length > 0);

  if (hasBaker && hasDecorator) return "fully_assigned";
  if (hasBaker && !hasDecorator) return "baker_only";
  if (!hasBaker && hasDecorator) return "decorator_only";
  return "unassigned";
}

/**
 * Validates complexity units defensively.
 * Valid range: 0.5 <= units <= 10.0.
 * Returns valid numeric value or null if invalid/missing.
 * DOES NOT silently invent 1.0 so data-quality issues are transparently exposed.
 */
export function validateComplexityUnits(units: number | null | undefined): number | null {
  if (units === null || units === undefined || isNaN(units)) return null;
  const num = Number(units);
  if (num < 0.5 || num > 10.0) return null;
  return num;
}

/**
 * Maps a utilization percentage against the soft guideline to a workload state.
 */
export function getStaffWorkloadState(utilizationPercent: number): {
  state: StaffWorkloadState;
  stateLabel: string;
  badgeClass: string;
  progressBarClass: string;
} {
  if (utilizationPercent > 100) {
    return {
      state: "overloaded",
      stateLabel: "Overloaded",
      badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold",
      progressBarClass: "bg-rose-500",
    };
  }
  if (utilizationPercent > 80) {
    return {
      state: "near_guideline",
      stateLabel: "Near Guideline",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold",
      progressBarClass: "bg-amber-500",
    };
  }
  return {
    state: "within_guideline",
    stateLabel: "Within Guideline",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    progressBarClass: "bg-emerald-500",
  };
}

/**
 * Calculates daily workload for a single staff member on a specific date (YYYY-MM-DD).
 * 
 * Rules enforced:
 * 1. Activity-Based Station Allocation:
 *    - Baker workload assigned on scheduled_bake_date
 *    - Decorator workload assigned on scheduled_decorate_date
 * 2. Same-Day Single Count Rule:
 *    - If staff is both Baker & Decorator on the SAME day for an order,
 *      physical cake workload is counted ONCE for that day, but both tasks are tracked.
 * 3. Multi-Day Rule:
 *    - If Bake is Mon and Decorate is Tue, Monday receives bake load and Tuesday receives decorate load.
 * 4. Status Gating:
 *    - Only 'accepted' and 'in_baking' orders consume staff capacity.
 * 5. Data Quality:
 *    - Invalid/null complexity units are excluded from numerical totals and flagged.
 */
export function calculateStaffDailyWorkload(
  dateYMD: string,
  staffId: string,
  staffName: string,
  orders: StaffOrderInput[],
  guidelineUnits: number = DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE
): StaffDailyWorkloadResult {
  let bakeUnits = 0;
  let decorateUnits = 0;
  let bakeTaskCount = 0;
  let decorateTaskCount = 0;
  let invalidComplexityOrderCount = 0;

  // Map to enforce Same-Day Single Count for physical cake workload
  const distinctOrdersOnDate = new Map<string, { order: StaffOrderInput; validComplexity: number | null }>();

  for (const order of orders) {
    if (!isStaffWorkloadStatus(order.status)) {
      continue;
    }

    const isBakerOnDate = order.assigned_baker_id === staffId && order.scheduled_bake_date === dateYMD;
    const isDecoratorOnDate = order.assigned_decorator_id === staffId && order.scheduled_decorate_date === dateYMD;

    if (!isBakerOnDate && !isDecoratorOnDate) {
      continue;
    }

    const validComplexity = validateComplexityUnits(order.complexity_units);
    if (validComplexity === null) {
      invalidComplexityOrderCount++;
    }

    if (isBakerOnDate) {
      bakeTaskCount++;
      if (validComplexity !== null) {
        bakeUnits += validComplexity;
      }
    }

    if (isDecoratorOnDate) {
      decorateTaskCount++;
      if (validComplexity !== null) {
        decorateUnits += validComplexity;
      }
    }

    distinctOrdersOnDate.set(order.id, { order, validComplexity });
  }

  // Calculate distinct physical cake workload (Same-day single count)
  let totalPhysicalWorkloadUnits = 0;
  distinctOrdersOnDate.forEach(({ validComplexity }) => {
    if (validComplexity !== null) {
      totalPhysicalWorkloadUnits += validComplexity;
    }
  });

  totalPhysicalWorkloadUnits = Math.round(totalPhysicalWorkloadUnits * 10) / 10;
  bakeUnits = Math.round(bakeUnits * 10) / 10;
  decorateUnits = Math.round(decorateUnits * 10) / 10;

  const totalDistinctOrdersCount = distinctOrdersOnDate.size;
  const utilizationPercent = guidelineUnits > 0
    ? (totalPhysicalWorkloadUnits / guidelineUnits) * 100
    : 0;

  const stateInfo = getStaffWorkloadState(utilizationPercent);

  return {
    staffId,
    staffName,
    dateYMD,
    guidelineUnits,
    totalPhysicalWorkloadUnits,
    bakeUnits,
    decorateUnits,
    bakeTaskCount,
    decorateTaskCount,
    totalDistinctOrdersCount,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    state: stateInfo.state,
    stateLabel: stateInfo.stateLabel,
    badgeClass: stateInfo.badgeClass,
    progressBarClass: stateInfo.progressBarClass,
    hasInvalidComplexity: invalidComplexityOrderCount > 0,
    invalidComplexityOrderCount,
  };
}

/**
 * Calculates daily workloads for all active staff members on a given date.
 */
export function calculateStaffWorkloads(
  dateYMD: string,
  staffList: StaffProfileInput[],
  orders: StaffOrderInput[],
  guidelineUnits: number = DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE
): StaffDailyWorkloadResult[] {
  return staffList.map((staff) => {
    const staffName = getStaffDisplayName(staff);
    return calculateStaffDailyWorkload(dateYMD, staff.id, staffName, orders, guidelineUnits);
  });
}

/**
 * Produces a comprehensive daily staff workload summary for the kitchen schedule header.
 */
export function getStaffWorkloadSummary(
  dateYMD: string,
  staffList: StaffProfileInput[],
  orders: StaffOrderInput[],
  guidelineUnits: number = DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE
): StaffWorkloadSummaryResult {
  const staffWorkloads = calculateStaffWorkloads(dateYMD, staffList, orders, guidelineUnits);

  let totalAssignedWorkloadUnits = 0;
  let activeStaffCount = 0;
  let overloadedStaffCount = 0;

  staffWorkloads.forEach((w) => {
    totalAssignedWorkloadUnits += w.totalPhysicalWorkloadUnits;
    if (w.totalDistinctOrdersCount > 0) {
      activeStaffCount++;
    }
    if (w.state === "overloaded") {
      overloadedStaffCount++;
    }
  });

  // Count unassigned roles on this specific date among committed orders
  let unassignedBakersCount = 0;
  let unassignedDecoratorsCount = 0;

  orders.forEach((order) => {
    if (!isStaffWorkloadStatus(order.status)) return;

    if (order.scheduled_bake_date === dateYMD && (!order.assigned_baker_id || !order.assigned_baker_id.trim())) {
      unassignedBakersCount++;
    }
    if (order.scheduled_decorate_date === dateYMD && (!order.assigned_decorator_id || !order.assigned_decorator_id.trim())) {
      unassignedDecoratorsCount++;
    }
  });

  return {
    dateYMD,
    totalStaffCount: staffList.length,
    activeStaffCount,
    totalAssignedWorkloadUnits: Math.round(totalAssignedWorkloadUnits * 10) / 10,
    overloadedStaffCount,
    unassignedBakersCount,
    unassignedDecoratorsCount,
    staffWorkloads,
  };
}

/**
 * Filters orders committed to production that have missing Baker OR missing Decorator assignments.
 */
export function getUnassignedOrders(orders: StaffOrderInput[]): StaffOrderInput[] {
  return orders.filter((order) => {
    if (!isStaffWorkloadStatus(order.status)) return false;
    const state = getAssignmentState(order);
    return state !== "fully_assigned";
  });
}

/**
 * Filters orders assigned to a specific staff member (as Baker OR Decorator).
 */
export function getStaffAssignedOrders(orders: StaffOrderInput[], staffId: string): StaffOrderInput[] {
  return orders.filter((order) => {
    return order.assigned_baker_id === staffId || order.assigned_decorator_id === staffId;
  });
}

/**
 * Previews the staff workload impact before saving an assignment.
 * Accurately prevents double-counting if the staff member is already assigned to this order on this date.
 */
export function previewStaffAssignmentImpact(
  dateYMD: string,
  staffId: string,
  staffName: string,
  orderIdToAssign: string,
  orderComplexityUnits: number | null | undefined,
  role: "baker" | "decorator",
  allOrders: StaffOrderInput[],
  guidelineUnits: number = DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE
): {
  currentWorkload: number;
  newWorkload: number;
  guideline: number;
  currentUtilization: number;
  newUtilization: number;
  isOverloaded: boolean;
  overageUnits: number;
  warningMessage: string | null;
  requiresNotice: boolean;
} {
  const currentResult = calculateStaffDailyWorkload(
    dateYMD,
    staffId,
    staffName,
    allOrders,
    guidelineUnits
  );

  const currentWorkload = currentResult.totalPhysicalWorkloadUnits;
  const validComplexity = validateComplexityUnits(orderComplexityUnits) ?? 1.0;

  // Check if this order is already counted towards this staff member's physical workload on this date
  const isAlreadyCountedOnDate = allOrders.some((o) => {
    if (o.id !== orderIdToAssign || !isStaffWorkloadStatus(o.status)) return false;
    const isBaker = o.assigned_baker_id === staffId && o.scheduled_bake_date === dateYMD;
    const isDecorator = o.assigned_decorator_id === staffId && o.scheduled_decorate_date === dateYMD;
    return isBaker || isDecorator;
  });

  const newWorkload = isAlreadyCountedOnDate
    ? currentWorkload
    : Math.round((currentWorkload + validComplexity) * 10) / 10;

  const currentUtilization = currentResult.utilizationPercent;
  const newUtilization = guidelineUnits > 0
    ? Math.round(((newWorkload / guidelineUnits) * 100) * 10) / 10
    : 0;

  const isOverloaded = newUtilization > 100;
  const overageUnits = Math.max(0, Math.round((newWorkload - guidelineUnits) * 10) / 10);

  let warningMessage: string | null = null;
  let requiresNotice = false;

  if (isOverloaded) {
    requiresNotice = true;
    warningMessage = `Workload Notice: Assigning this order brings ${staffName}'s workload on ${dateYMD} to ${newWorkload.toFixed(
      1
    )} / ${guidelineUnits.toFixed(1)} units (${newUtilization.toFixed(
      1
    )}% load — ${overageUnits.toFixed(1)} units above guideline).`;
  } else if (newUtilization > 80) {
    warningMessage = `Advisory: ${staffName} will be near daily guideline on ${dateYMD} (${newWorkload.toFixed(
      1
    )} / ${guidelineUnits.toFixed(1)} units — ${newUtilization.toFixed(1)}% load).`;
  }

  return {
    currentWorkload,
    newWorkload,
    guideline: guidelineUnits,
    currentUtilization,
    newUtilization,
    isOverloaded,
    overageUnits,
    warningMessage,
    requiresNotice,
  };
}
