/** @id salesblock.lib.core.supabase */
// @crumb frontend-supabase-client
// API | client_initialization | env_var_loading | missing_credentials_warning
// why: Expose singleton Supabase client for auth token refresh and session validation (read-only for frontend)
// in:env vars VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY out:SupabaseClient instance for auth/session operations err:Missing env vars (warning logged,client unusable but doesn't crash)
// hazard: Frontend anon key exposed in bundle — permissions controlled by RLS (auth token refresh only)
// hazard: No connection pooling — cold start delays on first auth call
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// prompt: Consider wrapping in lazy singleton to defer initialization until first use. Add connection health check.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
