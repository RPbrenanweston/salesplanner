/**
 * @crumb
 * @id frontend-lib-token-refresh
 * @area INF/Auth/OAuth
 * @intent Centralized OAuth token validity checker with automatic refresh — ensures all API calls use non-expired access tokens
 * @responsibilities Check token expiry (with 5-min buffer), call appropriate refresh edge function when expired, return valid access_token, handle refresh failures gracefully
 * @contracts getValidToken(provider) → Promise<string | null>; checks oauth_connections.expires_at; calls refresh-google-token or refresh-microsoft-token edge function
 * @in Supabase oauth_connections table (access_token, refresh_token, expires_at), Supabase session (JWT), refresh edge functions
 * @out Valid (non-expired) access_token string; or null if no connection / refresh fails
 * @err No connection found (returns null); refresh edge function failure (returns null, logs error); missing refresh_token (returns null)
 * @hazard If the refresh edge function marks the connection as inactive (invalid_grant), this utility returns null — callers must handle the "reconnect" case
 * @shared-edges frontend/src/lib/calendar.ts→CALLS getValidToken for calendar API access; frontend/src/components/ComposeEmailModal.tsx→CALLS getValidToken for email send
 * @trail token-refresh#1 | Consumer calls getValidToken(provider) → check expires_at vs now-5min → if valid: return access_token → if expired: call refresh edge function → return new access_token
 */

import { supabase } from './supabase'

type OAuthProvider = 'gmail' | 'outlook' | 'google_calendar' | 'outlook_calendar'

/** Buffer time (ms) before actual expiry to trigger a refresh — prevents mid-request expiration */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

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
  return refreshToken(provider, connection.refresh_token)
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
  const edgeFunctionName = isGoogleProvider(provider)
    ? 'refresh-google-token'
    : 'refresh-microsoft-token'

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

/** Helper: determine if a provider uses Google's OAuth (vs Microsoft) */
function isGoogleProvider(provider: OAuthProvider): boolean {
  return provider === 'gmail' || provider === 'google_calendar'
}
