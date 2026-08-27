import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ?? ''
const supabasePublishableKey = import.meta.env[
  'VITE_SUPABASE_PUBLISHABLE_KEY'
] as string | undefined

if (!rawSupabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

// Normalize the base Supabase project URL by removing any trailing slashes or /rest/v1 paths
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)