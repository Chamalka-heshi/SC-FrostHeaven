/**
 * SC FrostHeaven — Phase 7G Runtime Verification Test Suite
 * Tests Analytics, CSV Export, Print Aggregations, Data Quality & Boundary Safety
 */

import {
  calculateAverageProductionDuration,
  calculateProductionCompletionRate,
  calculateKitchenOperationsKPIs,
  calculate14DayWorkloadCapacityForecast,
  generateCapacityReportCsvRows,
  generateStaffWorkloadReportCsvRows,
} from "../src/lib/analytics-utils";
import {
  calculateDailyCapacity,
  sanitizeComplexityUnits,
  DEFAULT_WEEKDAY_CAPACITY_FALLBACK,
} from "../src/lib/capacity-utils";
import {
  calculateStaffDailyWorkload,
  getStaffWorkloadSummary,
  validateComplexityUnits,
  DEFAULT_STAFF_DAILY_WORKLOAD_GUIDELINE,
} from "../src/lib/staff-workload-utils";
import {
  getLocalDateString,
  getOverdueInfo,
  getAtRiskInfo,
  formatProductionDuration,
} from "../src/lib/kitchen-operations-utils";
import { generateCsvContent, formatCsvValue } from "../src/lib/csv-export";
import { getProductionReadiness, getPaymentBadgeInfo } from "../src/lib/order-readiness";

console.log("================================================================================");
console.log("SC FROSTHEAVEN — PHASE 7G RUNTIME & MATHEMATICAL VERIFICATION SUITE");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (detail) console.error(`   Detail: ${detail}`);
  }
}

// ==============================================================================
// 1. ANALYTICS — AVERAGE PRODUCTION DURATION
// ==============================================================================
console.log("--- 1. Average Production Duration Tests ---");

const testOrdersWithTimestamps = [
  {
    // 2 hours = 120 minutes
    production_started_at: "2026-09-09T08:00:00.000Z",
    production_completed_at: "2026-09-09T10:00:00.000Z",
  },
  {
    // 3 hours 30 mins = 210 minutes
    production_started_at: "2026-09-09T09:00:00.000Z",
    production_completed_at: "2026-09-09T12:30:00.000Z",
  },
  {
    // Missing completion (in progress) -> MUST BE EXCLUDED
    production_started_at: "2026-09-09T11:00:00.000Z",
    production_completed_at: null,
  },
  {
    // Missing both -> MUST BE EXCLUDED
    production_started_at: null,
    production_completed_at: null,
  },
  {
    // Invalid clock skew (completed before start) -> MUST BE EXCLUDED
    production_started_at: "2026-09-09T14:00:00.000Z",
    production_completed_at: "2026-09-09T13:00:00.000Z",
  },
];

const durationResult = calculateAverageProductionDuration(testOrdersWithTimestamps);
// Avg of (120 + 210) / 2 = 330 / 2 = 165 minutes = 2h 45m
assert(durationResult.validOrdersCount === 2, "Valid completed order sample count is 2");
assert(durationResult.avgMinutes === 165, "Average minutes equals 165 mins");
assert(
  durationResult.formattedAvgDuration === "2h 45m",
  `Formatted duration equals '2h 45m' (got: ${durationResult.formattedAvgDuration})`,
);

const emptyDurationResult = calculateAverageProductionDuration([]);
assert(
  emptyDurationResult.validOrdersCount === 0 &&
    emptyDurationResult.avgMinutes === null &&
    emptyDurationResult.formattedAvgDuration === "—",
  "Empty orders returns safe null duration",
);

// ==============================================================================
// 2. ANALYTICS — PRODUCTION COMPLETION RATE
// ==============================================================================
console.log("\n--- 2. Production Completion Rate Tests ---");

const testOrdersForCompletion = [
  { status: "completed" }, // Numerator + Denominator
  { status: "completed" }, // Numerator + Denominator
  { status: "in_baking" }, // Denominator
  { status: "ready" }, // Denominator
  { status: "accepted" }, // Denominator
  { status: "submitted" }, // EXCLUDED (pre-quote pipeline)
  { status: "quoted" }, // EXCLUDED (pre-acceptance pipeline)
  { status: "declined" }, // EXCLUDED (terminal non-production)
  { status: "cancelled" }, // EXCLUDED (terminal non-production)
];

const completionResult = calculateProductionCompletionRate(testOrdersForCompletion);
// Completed = 2. Eligible = 5 (2 completed + 1 in_baking + 1 ready + 1 accepted).
// Rate = (2 / 5) * 100 = 40%
assert(completionResult.completedCount === 2, "Completed count is 2");
assert(completionResult.eligibleCount === 5, "Eligible production count is 5");
assert(
  completionResult.ratePercent === 40,
  `Completion rate is 40% (got: ${completionResult.ratePercent}%)`,
);

// ==============================================================================
// 3. DATA QUALITY — COMPLEXITY SANITIZATION (NO SILENT FABRICATION OF 1.0)
// ==============================================================================
console.log("\n--- 3. Data Quality & Complexity Tests ---");

assert(sanitizeComplexityUnits(2.5) === 2.5, "Valid complexity 2.5 sanitized");
assert(sanitizeComplexityUnits(0.5) === 0.5, "Lower boundary 0.5 sanitized");
assert(sanitizeComplexityUnits(10.0) === 10.0, "Upper boundary 10.0 sanitized");
assert(sanitizeComplexityUnits(null) === null, "Null complexity returns null (NOT 1.0)");
assert(sanitizeComplexityUnits(undefined) === null, "Undefined complexity returns null (NOT 1.0)");
assert(sanitizeComplexityUnits(0) === null, "Zero complexity returns null (NOT 1.0)");
assert(sanitizeComplexityUnits(15.0) === null, "Out-of-range complexity > 10 returns null");

// Test calculateDailyCapacity data quality handling
const ordersWithMissingComplexity = [
  {
    id: "ord-1",
    status: "accepted",
    scheduled_bake_date: "2026-09-10",
    complexity_units: 3.0, // valid
  },
  {
    id: "ord-2",
    status: "accepted",
    scheduled_bake_date: "2026-09-10",
    complexity_units: null, // missing -> MUST NOT BE FABRICATED AS 1.0
  },
];

const testCapacitySettings = [{ day_of_week: 4, max_capacity_units: 8.0 }]; // Thursday = 4
const capResultWithQuality = calculateDailyCapacity(
  "2026-09-10",
  ordersWithMissingComplexity,
  testCapacitySettings,
  [],
);
assert(
  capResultWithQuality.committedWorkloadUnits === 3.0,
  `Committed workload is strictly 3.0u (got: ${capResultWithQuality.committedWorkloadUnits}u)`,
);
assert(capResultWithQuality.hasInvalidComplexity === true, "Flags hasInvalidComplexity = true");
assert(capResultWithQuality.invalidComplexityOrderCount === 1, "invalidComplexityOrderCount = 1");

// ==============================================================================
// 4. CAPACITY THRESHOLD MATHEMATICS & BLACKOUT
// ==============================================================================
console.log("\n--- 4. Capacity Threshold Mathematics Tests ---");

// 4/8 = 50% -> within_capacity
const cap50 = calculateDailyCapacity(
  "2026-09-10",
  [{ id: "o1", status: "accepted", scheduled_bake_date: "2026-09-10", complexity_units: 4.0 }],
  [{ day_of_week: 4, max_capacity_units: 8.0 }],
  [],
);
assert(
  cap50.utilizationPercent === 50 && cap50.state === "within_capacity",
  "4/8 = 50% -> within_capacity",
);

// 6.5/8 = 81.25% -> near_capacity
const cap81 = calculateDailyCapacity(
  "2026-09-10",
  [{ id: "o1", status: "accepted", scheduled_bake_date: "2026-09-10", complexity_units: 6.5 }],
  [{ day_of_week: 4, max_capacity_units: 8.0 }],
  [],
);
assert(
  cap81.utilizationPercent === 81.25 && cap81.state === "near_capacity",
  "6.5/8 = 81.25% -> near_capacity",
);

// 8.1/8 = 101.25% -> over_capacity
const cap101 = calculateDailyCapacity(
  "2026-09-10",
  [{ id: "o1", status: "accepted", scheduled_bake_date: "2026-09-10", complexity_units: 8.1 }],
  [{ day_of_week: 4, max_capacity_units: 8.0 }],
  [],
);
assert(cap101.state === "over_capacity", "8.1/8 = 101.25% -> over_capacity");

// Same-day single count rule (Bake + Decorate on same date = 2.5u once)
const capSameDay = calculateDailyCapacity(
  "2026-09-10",
  [
    {
      id: "o1",
      status: "accepted",
      scheduled_bake_date: "2026-09-10",
      scheduled_decorate_date: "2026-09-10",
      complexity_units: 2.5,
    },
  ],
  [{ day_of_week: 4, max_capacity_units: 8.0 }],
  [],
);
assert(
  capSameDay.committedWorkloadUnits === 2.5,
  `Same day bake+decorate counted once: 2.5u (got: ${capSameDay.committedWorkloadUnits}u)`,
);
assert(
  capSameDay.bakeTaskCount === 1 && capSameDay.decorateTaskCount === 1,
  "Both bake and decorate tasks tracked",
);

// Blackout date closure
const capBlackout = calculateDailyCapacity(
  "2026-09-10",
  [{ id: "o1", status: "accepted", scheduled_bake_date: "2026-09-10", complexity_units: 2.0 }],
  [{ day_of_week: 4, max_capacity_units: 8.0 }],
  [{ blackout_date: "2026-09-10", reason: "National Holiday" }],
);
assert(
  capBlackout.state === "blackout" && capBlackout.hasBlackoutConflict === true,
  "Blackout date properly flagged with conflict",
);

// ==============================================================================
// 5. STAFF WORKLOAD ALLOCATION & SOFT GUIDELINE (6.0u)
// ==============================================================================
console.log("\n--- 5. Staff Workload & Guideline Tests ---");

const testStaff = [
  { id: "staff-1", full_name: "Amara Perera", email: "amara@frostheaven.com" },
  { id: "staff-2", full_name: "Kamal Silva", email: "kamal@frostheaven.com" },
];

const staffOrders = [
  {
    id: "o1",
    status: "accepted",
    scheduled_bake_date: "2026-09-10",
    scheduled_decorate_date: "2026-09-10",
    assigned_baker_id: "staff-1",
    assigned_decorator_id: "staff-1",
    complexity_units: 4.0, // Same staff member for both tasks on same day -> 4.0u physical load
  },
  {
    id: "o2",
    status: "accepted",
    scheduled_bake_date: "2026-09-10",
    assigned_baker_id: "staff-1",
    complexity_units: 3.0, // Total for staff-1 = 4.0 + 3.0 = 7.0u -> Overloaded (>6.0u)
  },
];

const staffWorkloads = calculateStaffDailyWorkload(
  "2026-09-10",
  "staff-1",
  "Amara Perera",
  staffOrders,
  6.0,
);
assert(
  staffWorkloads.totalPhysicalWorkloadUnits === 7.0,
  `Staff physical workload is 7.0u (got: ${staffWorkloads.totalPhysicalWorkloadUnits}u)`,
);
assert(
  staffWorkloads.state === "overloaded",
  `Staff state is 'overloaded' against 6.0u guideline (got: ${staffWorkloads.state})`,
);
assert(
  staffWorkloads.bakeTaskCount === 2 && staffWorkloads.decorateTaskCount === 1,
  "Bake and decorate task counts verified",
);

// ==============================================================================
// 6. CSV EXPORT UTILITY (RFC-4180 Escaping & UTF-8 BOM)
// ==============================================================================
console.log("\n--- 6. CSV Export RFC-4180 Escaping Tests ---");

assert(formatCsvValue("Standard Text") === "Standard Text", "Simple text unquoted");
assert(formatCsvValue('Text with "quotes"') === '"Text with ""quotes"""', "Double quote escaping");
assert(formatCsvValue("Text, with, commas") === '"Text, with, commas"', "Comma wrapping");
assert(formatCsvValue("Line 1\nLine 2") === '"Line 1\nLine 2"', "Newline wrapping");
assert(formatCsvValue(null) === "", "Null formatted as empty string");
assert(formatCsvValue(undefined) === "", "Undefined formatted as empty string");

const sampleCsv = generateCsvContent(
  ["Order ID", "Customer", "Price (LKR)"],
  [
    ["#101", 'John "Jack" Doe', 15000],
    ["#102", "Jane, Mary", 25000],
  ],
);
assert(sampleCsv.startsWith("\uFEFF"), "CSV content starts with UTF-8 BOM (\\uFEFF)");
assert(sampleCsv.includes('"John ""Jack"" Doe"'), "CSV correctly escapes inner double quotes");
assert(sampleCsv.includes('"Jane, Mary"'), "CSV correctly escapes commas in customer name");

// ==============================================================================
// 7. TIMEZONE & LOCAL DATE STRING SAFETY
// ==============================================================================
console.log("\n--- 7. Timezone & Local Date Formatting Tests ---");

const testDate = new Date(2026, 8, 10, 23, 45, 0); // 10th September 2026 at 11:45 PM local
const localYMD = getLocalDateString(testDate);
assert(
  localYMD === "2026-09-10",
  `getLocalDateString produces '2026-09-10' without UTC shifting (got: ${localYMD})`,
);

// ==============================================================================
// 8. SUMMARY
// ==============================================================================
console.log("\n================================================================================");
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log("================================================================================");

if (passedTests === totalTests) {
  console.log("\n🌟 ALL PHASE 7G RUNTIME & MATHEMATICAL TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
} else {
  console.error("\n❌ SOME TESTS FAILED!\n");
  process.exit(1);
}
