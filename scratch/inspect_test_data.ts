import { createClient } from "../node_modules/@supabase/supabase-js";

const SUPABASE_URL = "https://xaqczelrmlhjhfjxlwzv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcWN6ZWxybWxoamhmanhsd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzgxNjEsImV4cCI6MjEwMzQxNDE2MX0.4AvHkYQ9flJOHR1CON8eAqLncRG19sMEqvwQUgahe30";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectData() {
  console.log("=== INSPECTING TEST DATA ===");

  // Check profiles
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .limit(5);

  console.log("Profiles (anon/public check):", { count: profiles?.length, error: pErr?.message });
  if (profiles) {
    console.log(profiles.map(p => ({ id: p.id, email: p.email, role: p.role })));
  }
}

inspectData().catch(console.error);
