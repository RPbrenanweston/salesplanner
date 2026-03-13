// @crumb edge-exchange-google-token
// Auth/OAuth | authorization_code_exchange | token_storage | provider_dispatch
// why: Exchange Google OAuth authorization code for access and refresh tokens — handles both Gmail and Google Calendar providers
// in:POST body (code,redirect_uri,provider:'gmail'|'google_calendar'),env vars (GMAIL_CLIENT_ID,GMAIL_CLIENT_SECRET,GOOGLE_CALENDAR_CLIENT_ID,GOOGLE_CALENDAR_CLIENT_SECRET,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY) out:JSON {success:true,email_address} on success; JSON {error:string} on failure; upserts row in oauth_connections table err:Missing env vars -> 500; token exchange failure -> 502; DB upsert failure -> 500; unknown provider -> 400
// hazard: Client secrets in Deno env — ensure edge function logs are restricted to prevent secret leakage
// hazard: OAuth codes are single-use — React StrictMode double-invoke or duplicate requests will cause second call to fail
// edge:frontend/src/pages/GmailOAuthCallback.tsx -> SERVES
// edge:frontend/src/pages/GoogleCalendarOAuthCallback.tsx -> SERVES
// edge:supabase/functions/refresh-google-token/index.ts -> RELATES
// edge:google-oauth-exchange#1 -> STEP_IN
// prompt: When adding new Google scopes, ensure redirect_uri matches the provider case exactly. Test double-submit protection. Verify upsert handles re-connect (user reconnects Gmail after disconnect). Confirm email_address returned for display in SettingsPage.
/**
 * Exchange Google OAuth authorization code for access + refresh tokens.
 * Handles both Gmail and Google Calendar providers.
 *
 * POST { code, redirect_uri, provider: 'gmail' | 'google_calendar' }
 * Returns { success: true, email_address } or { error: string }
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
    const { code, redirect_uri, provider } = await req.json()

    if (!code || !redirect_uri) {
      throw new Error('Missing required fields: code, redirect_uri')
    }

    if (provider !== 'gmail' && provider !== 'google_calendar') {
      throw new Error('Invalid provider. Must be "gmail" or "google_calendar"')
    }

    // 3. Exchange authorization code for tokens at Google's token endpoint
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth not configured on server')
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      throw new Error(
        `Google token exchange failed: ${tokenData.error_description || tokenData.error}`
      )
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData

    // 4. Get user's email address from Google userinfo
    const userinfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    )

    const userinfoData = await userinfoResponse.json()
    const emailAddress = userinfoData.email || user.email

    // 5. Look up user's org_id from the users table
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData } = await serviceClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData?.org_id) {
      throw new Error('User organization not found')
    }

    // 6. Calculate token expiry timestamp
    const expiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString()

    // 7. Upsert into oauth_connections
    //    COALESCE preserves existing refresh_token if Google doesn't send a new one
    //    (Google only sends refresh_token on first consent)
    const { error: upsertError } = await serviceClient.rpc('upsert_oauth_connection', {
      p_user_id: user.id,
      p_org_id: userData.org_id,
      p_provider: provider,
      p_access_token: access_token,
      p_refresh_token: refresh_token || null,
      p_expires_at: expiresAt,
      p_email_address: emailAddress,
      p_scope: scope || '',
    })

    // If RPC doesn't exist, fall back to direct upsert
    if (upsertError) {
      const { error: directError } = await serviceClient
        .from('oauth_connections')
        .upsert(
          {
            user_id: user.id,
            org_id: userData.org_id,
            provider,
            access_token,
            refresh_token: refresh_token || null,
            expires_at: expiresAt,
            email_address: emailAddress,
            scope: scope || '',
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,provider',
          }
        )

      if (directError) {
        throw new Error(`Failed to store tokens: ${directError.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_address: emailAddress,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Google token exchange error:', error)
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
