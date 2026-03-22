// @crumb frontend-lib-token-refresh
// INF/Auth/OAuth | token_expiry_check | refresh_edge_function_call | valid_token_return | refresh_failure_handling
// why: Centralized OAuth token validity checker with automatic refresh — ensures all API calls use non-expired access tokens
// in:Supabase oauth_connections table (access_token,refresh_token,expires_at),Supabase session (JWT),refresh edge functions out:Valid access_token string or null err:No connection found (null);refresh edge function failure (null,logs error);missing refresh_token (null)
// hazard: If refresh edge function marks connection as inactive (invalid_grant), returns null — callers must handle the reconnect case
// hazard: No retry logic on transient refresh failures — single attempt then null
// edge:frontend/src/lib/calendar.ts -> CALLS
// edge:frontend/src/components/ComposeEmailModal.tsx -> CALLS
// edge:token-refresh#1 -> STEP_IN

import { supabase } from './supabase'

export type OAuthProvider = 'gmail' | 'outlook' | 'google_calendar' | 'outlook_calendar' | 'salesforce' | 'attio'

/** Buffer time (ms) before actual expiry to trigger a refresh — prevents mid-request expiration */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

/** In-flight refresh promises — prevents concurrent refresh for same provider */
const refreshInFlight = new Map<OAuthProvider, Promise<string | null>>()

/**
 * Get a valid (non-expired) access token for the given OAuth provider.
 * Automatically refreshes the token if it's within 5 minutes of expiry.
 *
 * @returns The valid access_token, or null if no connection exists or refresh fails.
 */
export async function getValidToken(provider: OAuthProvider): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch the stored connection
  const { data: connection, error } = await supabase
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at, is_active')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()

  if (error || !connection) return null

  // Connection was deactivated (e.g. invalid_grant during a previous refresh)
  if (connection.is_active === false) return null

  // Check if the token is still valid (with buffer)
  const expiresAt = new Date(connection.expires_at).getTime()
  const now = Date.now()

  if (expiresAt - now > EXPIRY_BUFFER_MS) {
    // Token is still fresh — use it directly
    return connection.access_token
  }

  // Token expired or expiring soon — refresh it
  // If a refresh is already in progress for this provider, await it
  const existing = refreshInFlight.get(provider)
  if (existing) return existing

  // Start refresh and register in-flight promise
  const refreshPromise = refreshToken(provider, connection.refresh_token)
    .finally(() => refreshInFlight.delete(provider))
  refreshInFlight.set(provider, refreshPromise)
  return refreshPromise
}

/**
 * Force-refresh a token with mutex protection.
 * If a refresh is already in-flight for this provider, returns the existing promise.
 * This is the primary entry point for callers that know the token is expired.
 */
export async function refreshTokenWithMutex(provider: OAuthProvider): Promise<string | null> {
  const existing = refreshInFlight.get(provider)
  if (existing) return existing

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: connection } = await supabase
    .from('oauth_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()

  if (!connection?.refresh_token) return null

  const refreshPromise = refreshToken(provider, connection.refresh_token)
    .finally(() => refreshInFlight.delete(provider))
  refreshInFlight.set(provider, refreshPromise)
  return refreshPromise
}

/**
 * Call the appropriate refresh edge function to get a new access_token.
 */
async function refreshToken(
  provider: OAuthProvider,
  refreshTokenValue: string | null
): Promise<string | null> {
  if (!refreshTokenValue) {
    console.error(`No refresh token available for provider: ${provider}`)
    return null
  }

  // Route to the correct refresh edge function based on provider
  const edgeFunctionName = getRefreshFunctionName(provider)

  try {
    const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
      body: { provider },
    })

    if (error) {
      console.error(`Token refresh failed for ${provider}:`, error.message)
      return null
    }

    if (data?.error) {
      console.error(`Token refresh error for ${provider}:`, data.error)
      return null
    }

    return data?.access_token ?? null
  } catch (err) {
    console.error(`Unexpected error refreshing ${provider} token:`, err)
    return null
  }
}

/** Helper: determine the correct refresh edge function for each provider */
function getRefreshFunctionName(provider: OAuthProvider): string {
  switch (provider) {
    case 'gmail':
    case 'google_calendar':
      return 'refresh-google-token'
    case 'outlook':
    case 'outlook_calendar':
      return 'refresh-microsoft-token'
    case 'salesforce':
    case 'attio':
      // CRM providers use the generic OAuth token exchange function
      return 'exchange-oauth-token'
  }
}
