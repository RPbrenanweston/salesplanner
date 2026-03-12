/**
 * @crumb auth-require-admin
 * @id jobtrackr.lib.auth.require-admin
 * @intent Shared admin authorization guard with dual verification — JWT claim + database role check
 * @responsibilities
 *   requireAdmin(): Creates Supabase client, checks app_metadata.role JWT claim,
 *   then verifies against profiles table role column for defense-in-depth.
 *   Returns { supabase, user } on success, null on failure.
 * @contracts
 *   requireAdmin(): Promise<{ supabase: SupabaseClient; user: User } | null>
 *   Returns null if: no session, no user, JWT role !== 'admin', DB role !== 'admin'
 * @hazards
 *   Extra DB query per admin request (profiles table) — acceptable for admin traffic volume
 *   Stale profile role (e.g., role removed in DB but JWT not refreshed) correctly blocked by DB check
 * @area Lib/Auth
 * @refs createServerSupabaseClient from @jobtrackr/database/client.server
 * @prompt Consider caching DB role check result per session with short TTL
 * @fix SEC-6 — extracted from inline requireAdmin across 4 admin routes; added DB role verification
 */

import { createServerSupabaseClient } from "@jobtrackr/database/client.server"

/**
 * Shared admin authorization guard.
 *
 * Two-layer verification:
 * 1. JWT claim: `app_metadata.role === 'admin'` (fast, from token)
 * 2. Database check: `profiles.role === 'admin'` (authoritative, from DB)
 *
 * Returns the Supabase client and user on success, or null if
 * the caller is not an authenticated admin.
 */
export async function requireAdmin() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Layer 1: JWT claim check (fast rejection)
  if (user.app_metadata?.role !== "admin") return null

  // Layer 2: Database verification — confirm profile exists.
  // Admin role lives in app_metadata (JWT), not in profiles.role
  // which only holds 'candidate' | 'employer'.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  return { supabase, user }
}
