/**
 * SC Frost Heaven — Phase 8B Transactional Email Verification Suite
 *
 * Verifies:
 * 1. All 7 canonical email types (quote_ready, order_confirmed, in_baking, order_ready, order_completed, order_declined, order_cancelled)
 * 2. Negative filtering: submitted, under_review, arbitrary types do not generate emails
 * 3. Strict Customer Data Allowlist: internal_notes, payment_reference, payment_notes, staff IDs, timestamps, complexity, priority are NEVER leaked
 * 4. Customer Isolation: Customer A / Customer B isolation & guest order handling
 * 5. Formatting & Absolute URL building
 * 6. HTML and Plain-Text rendering integrity
 */

import {
  renderEmailTemplate,
  formatLKR,
  buildAccountUrl,
  buildTestimonialsUrl,
  formatEmailDate,
  DEFAULT_SITE_URL,
  type CustomerSafeOrderEmailData,
} from "../src/lib/email-templates";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n================================================================================");
console.log("  SC FROST HEAVEN — PHASE 8B TRANSACTIONAL EMAIL VERIFICATION SUITE");
console.log("================================================================================\n");

// ============================================================================
// 1. ALL 7 CANONICAL EMAIL TYPES
// ============================================================================
console.log("--- 1. Verification of the 7 Order Milestone Email Templates ---");

const testOrderData: CustomerSafeOrderEmailData = {
  orderId: "e9b2c3d4-1234-5678-9abc-def012345678",
  customerName: "Amara Perera",
  customerEmail: "amara@example.lk",
  eventType: "Birthday",
  eventDate: "2026-09-20",
  quotedPriceLkr: 18500,
  depositAmountLkr: 6000,
  amountPaidLkr: 6000,
  paymentStatus: "deposit_paid",
  targetPickupTime: "14:30:00",
  customerMessage: "Vanilla sponge with salted caramel drip.",
  adminNotes: "Customer requested edible gold stars.",
};

// 1. quote_ready
const emailQuoteReady = renderEmailTemplate("quote_ready", testOrderData);
assert(emailQuoteReady !== null, "quote_ready renders a valid email");
assert(
  emailQuoteReady?.subject === "Your SC Frost Heaven cake quotation is ready",
  "quote_ready has exact expected subject",
);
assert(
  emailQuoteReady?.html.includes("Amara Perera") === true,
  "quote_ready HTML includes customer name",
);
assert(
  emailQuoteReady?.html.includes("LKR 18,500") === true,
  "quote_ready HTML includes formatted quoted price",
);
assert(
  emailQuoteReady?.html.includes("LKR 6,000") === true,
  "quote_ready HTML includes formatted deposit",
);
assert(
  emailQuoteReady?.html.includes("/account?orderId=e9b2c3d4-1234-5678-9abc-def012345678") === true,
  "quote_ready includes account link",
);
assert(
  emailQuoteReady?.text.includes("LKR 18,500") === true,
  "quote_ready plain text contains quoted price",
);

// 2. order_confirmed
const emailConfirmed = renderEmailTemplate("order_confirmed", testOrderData);
assert(emailConfirmed !== null, "order_confirmed renders a valid email");
assert(
  emailConfirmed?.subject === "Your SC Frost Heaven cake order is confirmed",
  "order_confirmed has exact expected subject",
);
assert(
  emailConfirmed?.html.includes("Order Confirmed") === true,
  "order_confirmed HTML includes badge",
);
assert(emailConfirmed?.html.includes("LKR 18,500") === true, "order_confirmed HTML includes price");
assert(
  emailConfirmed?.text.includes("/account?orderId=") === true,
  "order_confirmed text includes account link",
);

// 3. in_baking
const emailInBaking = renderEmailTemplate("in_baking", testOrderData);
assert(emailInBaking !== null, "in_baking renders a valid email");
assert(
  emailInBaking?.subject === "Your SC Frost Heaven cake is now being prepared",
  "in_baking has exact expected subject",
);
assert(
  emailInBaking?.html.includes("In Kitchen Baking") === true,
  "in_baking HTML includes status box",
);
assert(
  emailInBaking?.text.includes("in the kitchen being baked") === true,
  "in_baking plain text contains update",
);

// 4. order_ready
const emailOrderReady = renderEmailTemplate("order_ready", testOrderData);
assert(emailOrderReady !== null, "order_ready renders a valid email");
assert(
  emailOrderReady?.subject === "Your SC Frost Heaven cake is ready",
  "order_ready has exact expected subject",
);
assert(
  emailOrderReady?.html.includes("14:30") === true,
  "order_ready HTML includes target pickup time",
);
assert(
  emailOrderReady?.html.includes("Ready for Pickup") === true,
  "order_ready HTML contains ready status",
);
assert(
  emailOrderReady?.text.includes("Time: 14:30") === true,
  "order_ready plain text contains pickup time",
);

// 5. order_completed
const emailCompleted = renderEmailTemplate("order_completed", testOrderData);
assert(emailCompleted !== null, "order_completed renders a valid email");
assert(
  emailCompleted?.subject === "Thank you for choosing SC Frost Heaven",
  "order_completed has exact expected subject",
);
assert(
  emailCompleted?.html.includes("/testimonials") === true,
  "order_completed HTML links to testimonials for review CTA",
);
assert(
  emailCompleted?.text.includes("/testimonials") === true,
  "order_completed plain text links to testimonials",
);

// 6. order_declined
const emailDeclined = renderEmailTemplate("order_declined", testOrderData);
assert(emailDeclined !== null, "order_declined renders a valid email");
assert(
  emailDeclined?.subject === "Update regarding your SC Frost Heaven cake request",
  "order_declined has exact expected subject",
);
assert(
  emailDeclined?.html.includes("unable to fulfill this request") === true,
  "order_declined HTML contains polite decline notice",
);

// 7. order_cancelled
const emailCancelled = renderEmailTemplate("order_cancelled", testOrderData);
assert(emailCancelled !== null, "order_cancelled renders a valid email");
assert(
  emailCancelled?.subject === "Your SC Frost Heaven cake order has been cancelled",
  "order_cancelled has exact expected subject",
);
assert(
  emailCancelled?.html.includes("Order Cancelled") === true,
  "order_cancelled HTML contains cancellation badge",
);

// ============================================================================
// 2. NEGATIVE TESTS: SUBMITTED, UNDER_REVIEW, ARBITRARY TYPES
// ============================================================================
console.log("\n--- 2. Negative Tests: Filtering Unreviewed / Draft States ---");

assert(
  renderEmailTemplate("submitted", testOrderData) === null,
  "submitted status produces NO email (returns null)",
);
assert(
  renderEmailTemplate("under_review", testOrderData) === null,
  "under_review status produces NO email (returns null)",
);
assert(
  renderEmailTemplate("random_invalid_status", testOrderData) === null,
  "Unknown status produces NO email (returns null)",
);

// ============================================================================
// 3. SECURITY & SENSITIVE DATA EXCLUSION AUDIT
// ============================================================================
console.log("\n--- 3. Strict Data Protection & Sensitive Field Exclusion ---");

// Test payload containing secret/internal fields that must NEVER appear in customer emails
const poisonedOrderData: CustomerSafeOrderEmailData & Record<string, unknown> = {
  ...testOrderData,
  internal_notes: "SECRET_INTERNAL_NOTE_12345_CHEF_ONLY",
  payment_reference: "SECRET_BANK_REF_998877",
  payment_notes: "SECRET_SLIP_VERIFIED_BY_ADMIN",
  assigned_baker_id: "SECRET_BAKER_UUID_111",
  assigned_decorator_id: "SECRET_DECORATOR_UUID_222",
  production_priority: "SECRET_URGENT_PRIORITY",
  complexity_units: 4.5,
  scheduled_bake_date: "2026-09-18",
  scheduled_decorate_date: "2026-09-19",
  production_started_at: "2026-09-18T08:00:00Z",
  production_completed_at: "2026-09-19T12:00:00Z",
};

const allRenderedEmails = [
  renderEmailTemplate("quote_ready", poisonedOrderData),
  renderEmailTemplate("order_confirmed", poisonedOrderData),
  renderEmailTemplate("in_baking", poisonedOrderData),
  renderEmailTemplate("order_ready", poisonedOrderData),
  renderEmailTemplate("order_completed", poisonedOrderData),
  renderEmailTemplate("order_declined", poisonedOrderData),
  renderEmailTemplate("order_cancelled", poisonedOrderData),
];

const forbiddenStrings = [
  "SECRET_INTERNAL_NOTE_12345_CHEF_ONLY",
  "SECRET_BANK_REF_998877",
  "SECRET_SLIP_VERIFIED_BY_ADMIN",
  "SECRET_BAKER_UUID_111",
  "SECRET_DECORATOR_UUID_222",
  "SECRET_URGENT_PRIORITY",
  "complexity_units",
  "assigned_baker",
  "assigned_decorator",
  "scheduled_bake_date",
  "scheduled_decorate_date",
  "production_started_at",
  "production_completed_at",
];

let leakDetected = false;
allRenderedEmails.forEach((email, idx) => {
  if (!email) return;
  for (const forbidden of forbiddenStrings) {
    if (email.html.includes(forbidden) || email.text.includes(forbidden)) {
      console.error(`  \x1b[31mLEAK DETECTED in template #${idx}: contains '${forbidden}'\x1b[0m`);
      leakDetected = true;
    }
  }
});

assert(
  !leakDetected,
  "Zero internal notes, payment refs, staff IDs, timestamps, or complexity units leaked in any template",
);

// ============================================================================
// 4. CUSTOMER ISOLATION & GUEST ORDER LOGIC
// ============================================================================
console.log("\n--- 4. Customer Isolation & Guest Order Simulation ---");

function simulateWebhookEdgeFunction(
  notification: { id: string; user_id: string; type: string; related_order_id: string | null },
  order: {
    id: string;
    customer_id: string | null;
    customer_name: string;
    customer_email: string;
    status: string;
  } | null,
): { status: string; reason?: string } {
  if (!notification || !notification.id) {
    return { status: "ignored_no_record" };
  }
  if (!notification.related_order_id) {
    return { status: "ignored_no_related_order" };
  }
  if (!order) {
    return { status: "ignored_order_not_found" };
  }

  // Isolation check: order.customer_id strictly equals notification.user_id
  if (!order.customer_id || order.customer_id !== notification.user_id) {
    return {
      status: "rejected_customer_mismatch",
      reason: "Customer A cannot access Customer B or guest orders",
    };
  }

  if (!order.customer_email || !order.customer_email.includes("@")) {
    return { status: "ignored_no_valid_email" };
  }

  return { status: "ready_to_send" };
}

// Test matching customer (Customer A owns Order A)
const matchResult = simulateWebhookEdgeFunction(
  { id: "notif-1", user_id: "user-A", type: "quote_ready", related_order_id: "order-A" },
  {
    id: "order-A",
    customer_id: "user-A",
    customer_name: "Amara",
    customer_email: "amara@example.lk",
    status: "quoted",
  },
);
assert(
  matchResult.status === "ready_to_send",
  "Matching customer order is approved for email dispatch",
);

// Test cross-customer mismatch (Customer B's notification points to Customer A's order)
const mismatchResult = simulateWebhookEdgeFunction(
  { id: "notif-2", user_id: "user-B", type: "quote_ready", related_order_id: "order-A" },
  {
    id: "order-A",
    customer_id: "user-A",
    customer_name: "Amara",
    customer_email: "amara@example.lk",
    status: "quoted",
  },
);
assert(
  mismatchResult.status === "rejected_customer_mismatch",
  "Cross-customer order mismatch is strictly rejected",
);

// Test guest order (customer_id is null)
const guestResult = simulateWebhookEdgeFunction(
  { id: "notif-3", user_id: "user-C", type: "quote_ready", related_order_id: "order-guest" },
  {
    id: "order-guest",
    customer_id: null,
    customer_name: "Guest",
    customer_email: "guest@example.lk",
    status: "quoted",
  },
);
assert(
  guestResult.status === "rejected_customer_mismatch",
  "Guest order with null customer_id is safely skipped",
);

// ============================================================================
// 5. FORMATTING & URL RESOLUTION
// ============================================================================
console.log("\n--- 5. Currency, Date & URL Helper Assertions ---");

assert(
  formatLKR(25000).replace(/\s+/g, " ") === "LKR 25,000",
  "formatLKR formats numbers with thousand separators",
);
assert(formatLKR(null) === "—", "formatLKR handles null gracefully");
assert(formatLKR(0) === "LKR 0", "formatLKR formats 0 correctly");

assert(
  buildAccountUrl("https://scfrostheaven.com", "abc-123") ===
    "https://scfrostheaven.com/account?orderId=abc-123",
  "buildAccountUrl constructs valid absolute link",
);
assert(
  buildTestimonialsUrl("https://scfrostheaven.com") === "https://scfrostheaven.com/testimonials",
  "buildTestimonialsUrl constructs valid testimonials link",
);

assert(
  formatEmailDate("2026-09-25") === "Fri, Sep 25, 2026",
  "formatEmailDate produces localized human-friendly date",
);
assert(formatEmailDate(null) === "To be coordinated", "formatEmailDate handles null safely");

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n================================================================================");
console.log(`  QA RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
console.log("================================================================================\n");

if (failedTests > 0) {
  process.exit(1);
}
