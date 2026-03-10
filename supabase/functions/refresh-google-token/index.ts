/**
 * Refresh a Google OAuth access token using the stored refresh_token.
 * Handles both Gmail and Google Calendar providers.
 *
 * POST { provider: 'gmail' | 'google_calendar' }
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

    if (provider !== 'gmail' && provider !== 'google_calendar') {
      throw new Error('Invalid provider. Must be "gmail" or "google_calendar"')
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
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth not configured on server')
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

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
        `Google token refresh failed: ${tokenData.error_description || tokenData.error}`
      )
    }

    const { access_token, expires_in } = tokenData

    // 5. Calculate new expiry and update the stored tokens
    const expiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString()

    const { error: updateError } = await serviceClient
      .from('oauth_connections')
      .update({
        access_token,
        expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
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
    console.error('Google token refresh error:', error)
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
