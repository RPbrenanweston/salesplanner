// @crumb edge-refresh-microsoft-token
// Auth/OAuth | access_token_refresh | expiry_check | token_persistence
// why: Refresh expired Microsoft OAuth access tokens using stored refresh token — called by frontend token-refresh lib before Outlook/Calendar API calls
// in:POST body (user_id,provider:'outlook'|'outlook_calendar'),env vars (OUTLOOK_CLIENT_ID,OUTLOOK_CLIENT_SECRET,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY) out:JSON {access_token:string,expires_at:number} on success; JSON {error:string} on failure; updates oauth_connections with new access_token and expires_at err:Missing refresh_token (invalid_grant) -> 401; Microsoft refresh endpoint failure -> 502; DB update failure -> 500
// hazard: Microsoft tokens have a rolling refresh window — if refresh_token itself expires (90 days inactive), user must reconnect
// hazard: No lock on concurrent refresh calls — simultaneous requests may cause token overwrite race
// edge:frontend/src/lib/token-refresh.ts -> SERVES
// edge:supabase/functions/exchange-microsoft-token/index.ts -> RELATES
// edge:microsoft-token-refresh#1 -> STEP_IN
// prompt: Handle invalid_grant by marking oauth_connections row as disconnected and returning clear error to caller. Add check whether token is already valid before calling Microsoft endpoint. Mirror refresh-google-token behavior for consistency.
/**
 * Refresh a Microsoft OAuth access token using the stored refresh_token.
 * Handles both Outlook Mail and Outlook Calendar providers.
 *
 * POST { provider: 'outlook' | 'outlook_calendar' }
 * Returns { success: true, access_token, expires_at } or { error: string }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Authenticate the calling user via JWT
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // 2. Parse request body
    const { provider } = await req.json()

    if (provider !== 'outlook' && provider !== 'outlook_calendar') {
      throw new Error('Invalid provider. Must be "outlook" or "outlook_calendar"')
    }

    // 3. Read the stored refresh_token from oauth_connections
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: connection } = await serviceClient
      .from('oauth_connections')
      .select('refresh_token')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (!connection?.refresh_token) {
      throw new Error('No refresh token found. Please reconnect your account.')
    }

    // 4. Exchange refresh_token for a new access_token
    //    IMPORTANT: Microsoft requires application/x-www-form-urlencoded
    const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')
    const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')

    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth not configured on server')
    }

    const tokenBody = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    })

    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      }
    )

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      // If refresh token is revoked/expired, mark connection as inactive
      if (tokenData.error === 'invalid_grant') {
        await serviceClient
          .from('oauth_connections')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('provider', provider)
      }
      throw new Error(
        `Microsoft token refresh failed: ${tokenData.error_description || tokenData.error}`
      )
    }

    const { access_token, refresh_token: new_refresh_token, expires_in } = tokenData

    // 5. Calculate new expiry and update the stored tokens
    //    Microsoft may return a new rolling refresh_token — always update when present
    const expiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString()

    const updatePayload: Record<string, unknown> = {
      access_token,
      expires_at: expiresAt,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    // Microsoft uses rolling refresh tokens — update if a new one is provided
    if (new_refresh_token) {
      updatePayload.refresh_token = new_refresh_token
    }

    const { error: updateError } = await serviceClient
      .from('oauth_connections')
      .update(updatePayload)
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (updateError) {
      throw new Error(`Failed to update tokens: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        access_token,
        expires_at: expiresAt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Microsoft token refresh error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
