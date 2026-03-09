/**
 * @crumb
 * @id frontend-supabase-client
 * @area API
 * @intent Expose singleton Supabase client for auth token refresh and session validation (read-only for frontend)
 * @responsibilities Supabase client initialization, env var loading, warning on missing credentials
 * @contracts export supabase: SupabaseClient
 * @in env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (Vite frontend-safe, no server key)
 * @out SupabaseClient instance for auth/session operations
 * @err Missing env vars (warning logged, client unusable but doesn't crash)
 * @hazard Frontend anon key exposed in bundle — permissions controlled by RLS (auth token refresh only)
 * @hazard No connection pooling — cold start delays on first auth call
 * @shared-edges hooks/useAuth.ts→USES for session refresh; components→IMPORT for isolated Supabase calls
 * @prompt Consider wrapping in lazy singleton to defer initialization until first use. Add connection health check.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
