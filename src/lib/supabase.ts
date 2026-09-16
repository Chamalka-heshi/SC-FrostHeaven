import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://xaqczelrmlhjhfjxlwzv.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcWN6ZWxybWxoamhmanhsd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzgxNjEsImV4cCI6MjEwMzQxNDE2MX0.4AvHkYQ9flJOHR1CON8eAqLncRG19sMEqvwQUgahe30";

const rawSupabaseUrl =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || DEFAULT_SUPABASE_URL;
const supabasePublishableKey =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
  DEFAULT_SUPABASE_KEY;

// Normalize the base Supabase project URL by removing any trailing slashes or /rest/v1 paths
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
