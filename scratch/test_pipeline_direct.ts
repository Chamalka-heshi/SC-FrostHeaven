import { createClient } from "../node_modules/@supabase/supabase-js";

const SUPABASE_URL = "https://xaqczelrmlhjhfjxlwzv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcWN6ZWxybWxoamhmanhsd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzgxNjEsImV4cCI6MjEwMzQxNDE2MX0.4AvHkYQ9flJOHR1CON8eAqLncRG19sMEqvwQUgahe30";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-transactional-email`;

async function testPipeline() {
  console.log("=== PHASE 8B DIRECT AUTHENTICATION & EDGE FUNCTION TEST ===");

  // 1. Unauthenticated
  console.log("\n1. Testing Unauthenticated Request:");
  const unauthRes = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log("   Status:", unauthRes.status, unauthRes.statusText);
  const unauthJson = await unauthRes.json();
  console.log("   Body:", unauthJson);

  // 2. Authenticated with Anon Key (MUST BE REJECTED)
  console.log("\n2. Testing Request with Anon Key (Must be 401):");
  const anonRes = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  console.log("   Status:", anonRes.status, anonRes.statusText);
  const anonJson = await anonRes.json();
  console.log("   Body:", anonJson);

  // 3. Authenticated with wrong secret (MUST BE REJECTED)
  console.log("\n3. Testing Request with Invalid Secret (Must be 401):");
  const invalidRes = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "invalid_secret_key_12345",
    },
    body: JSON.stringify({}),
  });
  console.log("   Status:", invalidRes.status, invalidRes.statusText);
  const invalidJson = await invalidRes.json();
  console.log("   Body:", invalidJson);
}

testPipeline().catch(console.error);
