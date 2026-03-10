/**
 * Exchange Microsoft OAuth authorization code for access + refresh tokens.
 * Handles both Outlook Mail and Outlook Calendar providers.
 *
 * POST { code, redirect_uri, provider: 'outlook' | 'outlook_calendar' }
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

    if (provider !== 'outlook' && provider !== 'outlook_calendar') {
      throw new Error('Invalid provider. Must be "outlook" or "outlook_calendar"')
    }

    // 3. Exchange authorization code for tokens at Microsoft's token endpoint
    //    IMPORTANT: Microsoft requires application/x-www-form-urlencoded, NOT JSON
    const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')
    const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')

    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth not configured on server')
    }

    const tokenBody = new URLSearchParams({
      code,
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
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
      throw new Error(
        `Microsoft token exchange failed: ${tokenData.error_description || tokenData.error}`
      )
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData

    // 4. Get user's email from Microsoft Graph API
    const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const meData = await meResponse.json()
    const emailAddress = meData.mail || meData.userPrincipalName || user.email

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
    const { error: upsertError } = await serviceClient
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

    if (upsertError) {
      throw new Error(`Failed to store tokens: ${upsertError.message}`)
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
    console.error('Microsoft token exchange error:', error)
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
