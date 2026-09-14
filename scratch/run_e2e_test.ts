import { createClient } from "../node_modules/@supabase/supabase-js";

const SUPABASE_URL = "https://xaqczelrmlhjhfjxlwzv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcWN6ZWxybWxoamhmanhsd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzgxNjEsImV4cCI6MjEwMzQxNDE2MX0.4AvHkYQ9flJOHR1CON8eAqLncRG19sMEqvwQUgahe30";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runE2ETest() {
  console.log("=== RUNNING CONTROLLED END-TO-END NOTIFICATION & PG_NET TEST ===");

  const testEmail = "scfrostheaven@gmail.com";
  console.log(`1. Triggering quote_ready milestone for recipient: ${testEmail}...`);

  const { data: dispatchData, error: dispatchErr } = await supabase.rpc(
    "test_phase8b_e2e_dispatch",
    { p_test_email: testEmail }
  );

  if (dispatchErr) {
    console.error("✖ Dispatch RPC error:", dispatchErr.message);
    return;
  }

  console.log("✔ Order & Notification created:");
  console.log("  Order ID:", dispatchData.order_id);
  console.log("  Notification ID:", dispatchData.notification_id);
  console.log("  User ID:", dispatchData.user_id);

  console.log("\n2. Waiting 5 seconds for asynchronous pg_net HTTP POST and Edge Function execution...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("\n3. Inspecting pg_net HTTP execution logs...");
  const { data: logsData, error: logsErr } = await supabase.rpc("inspect_phase8b_pg_net_logs");

  if (logsErr) {
    console.error("✖ Failed to retrieve pg_net logs:", logsErr.message);
  } else {
    console.log("✔ pg_net Response Logs:");
    console.log(JSON.stringify(logsData, null, 2));
  }
}

runE2ETest().catch(console.error);
