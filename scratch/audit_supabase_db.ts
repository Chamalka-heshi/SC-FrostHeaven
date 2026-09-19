import { supabase } from "../src/lib/supabase";

async function auditSupabase() {
  console.log("==================================================");
  console.log("     SUPABASE PRODUCTION READINESS AUDIT          ");
  console.log("==================================================\n");

  // 1. Check Phase 8C secure RPC
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_custom_orders");
    console.log("1. RPC get_my_custom_orders():", {
      accessible: !rpcErr || !rpcErr.message.includes("does not exist"),
      error: rpcErr?.message || null,
      dataReturned: rpcData,
    });
  } catch (e: any) {
    console.log("1. RPC get_my_custom_orders() error:", e.message);
  }

  // 2. Check Phase 8B pipeline diagnostic RPC
  try {
    const { data: diagData, error: diagErr } = await supabase.rpc("diagnose_phase8b_pipeline");
    console.log("\n2. RPC diagnose_phase8b_pipeline():", {
      accessible: !diagErr,
      result: diagData || diagErr?.message,
    });
  } catch (e: any) {
    console.log("2. RPC diagnose_phase8b_pipeline() error:", e.message);
  }

  // 3. Check table accessibility and RLS
  const tables = [
    "custom_orders",
    "notifications",
    "inquiries",
    "reviews",
    "profiles",
    "menu_items",
    "kitchen_capacity_settings",
    "bakery_blackout_dates",
  ];

  console.log("\n3. Public Tables Access (Anon / Public Role):");
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    console.log(`  - ${table}:`, error ? `RLS Active / Restricted (${error.message})` : `Accessible (${data?.length ?? 0} rows)`);
  }

  // 4. Confirm customer_custom_orders view does NOT exist
  const { data: viewData, error: viewErr } = await supabase.from("customer_custom_orders" as any).select("*").limit(1);
  console.log("\n4. View 'customer_custom_orders' check (Must NOT exist):", {
    doesNotExist: !!viewErr && viewErr.message.includes("does not exist") || viewErr?.code === "42P01",
    errorDetails: viewErr?.message || "View existed unexpectedly",
  });

  // 5. Check Storage Buckets
  console.log("\n5. Storage Buckets:");
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    console.log("  Bucket list error (anon):", bucketErr.message);
  } else {
    console.log("  Buckets found:", buckets?.map((b) => ({ id: b.id, name: b.name, public: b.public })));
  }

  console.log("\n==================================================");
}

auditSupabase().catch(console.error);
