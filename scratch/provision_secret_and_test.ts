import { createClient } from "../node_modules/@supabase/supabase-js";
import { execSync } from "child_process";
import crypto from "crypto";

const SUPABASE_URL = "https://xaqczelrmlhjhfjxlwzv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcWN6ZWxybWxoamhmanhsd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzgxNjEsImV4cCI6MjEwMzQxNDE2MX0.4AvHkYQ9flJOHR1CON8eAqLncRG19sMEqvwQUgahe30";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("=== PHASE 8B VAULT SECRET PROVISIONING & PIPELINE VALIDATION ===");

  // 1. Generate strong cryptographically secure random secret (32 bytes = 256 bits hex)
  const dedicatedSecret = crypto.randomBytes(32).toString("hex");
  console.log("1. Generated secure 256-bit dedicated webhook secret (Length: " + dedicatedSecret.length + " chars).");

  // 2. Set WEBHOOK_SECRET in Supabase Edge Function Secrets
  console.log("2. Setting WEBHOOK_SECRET in Supabase Edge Function secrets...");
  execSync(`bunx supabase secrets set WEBHOOK_SECRET=${dedicatedSecret}`, {
    cwd: "c:\\SC-FrostHeaven",
    stdio: "pipe",
  });
  console.log("   ✔ WEBHOOK_SECRET set in Edge Function secrets.");

  // 3. Store secret in PostgreSQL Vault under 'scfrostheaven_transactional_email_webhook_key'
  console.log("3. Storing secret in PostgreSQL Vault...");
  const { data: vaultRes, error: vaultErr } = await supabase.rpc("set_phase8b_vault_webhook_secret", {
    p_secret: dedicatedSecret,
  });

  if (vaultErr) {
    console.error("   ✖ Error setting Vault secret:", vaultErr.message);
    process.exit(1);
  }
  console.log("   ✔ Secret successfully stored in PostgreSQL Vault.");

  // 4. Verify Vault & Trigger Status via inspect_phase8b_trigger_status
  console.log("4. Verifying remote Vault and Trigger status...");
  const { data: statusData, error: statusErr } = await supabase.rpc("inspect_phase8b_trigger_status");
  if (statusErr) {
    console.error("   ✖ Error inspecting trigger status:", statusErr.message);
  } else {
    console.log("   ✔ Inspection result:");
    console.log("     - function_exists:", statusData.function_exists);
    console.log("     - pg_net_installed:", statusData.pg_net_installed);
    console.log("     - vault_secret_exists:", statusData.vault_secret_exists);
    console.log("     - vault_secret_non_empty:", statusData.vault_secret_non_empty);
    console.log("     - trigger_notifications:", statusData.trigger_notifications?.name);
    console.log("     - trigger_custom_orders:", statusData.trigger_custom_orders?.name);
  }
}

main().catch(console.error);
