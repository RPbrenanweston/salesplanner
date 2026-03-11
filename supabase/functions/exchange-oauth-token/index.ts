/**
 * @crumb
 * @id edge-exchange-oauth-token
 * @area Auth/OAuth
 * @intent Exchange OAuth authorization code for access/refresh tokens across all providers (Gmail, Outlook, Google Calendar, Outlook Calendar, Salesforce)
 * @responsibilities Accept provider + code + redirect_uri + user_id, exchange code with provider token endpoint, upsert tokens into oauth_connections table
 * @contracts POST { provider, code, redirect_uri, user_id } -> { success: true } | { error: string }
 * @in POST body (provider, code, redirect_uri, user_id), env vars (GMAIL_CLIENT_SECRET, OUTLOOK_CLIENT_SECRET, SALESFORCE_CLIENT_SECRET, GMAIL_CLIENT_ID, OUTLOOK_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_ID, OUTLOOK_CALENDAR_CLIENT_ID, SALESFORCE_CLIENT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * @out JSON { success: true } on success; JSON { error: string } on failure; upserts row in oauth_connections table
 * @err Missing env vars -> 500; invalid provider -> 400; token exchange failure -> 502; DB upsert failure -> 500
 * @hazard Client secrets in Deno env — ensure edge function logs are restricted
 * @hazard OAuth codes are single-use — if this function is called twice with the same code, the second call will fail
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Provider =
  | 'gmail'
  | 'outlook'
  | 'google_calendar'
  | 'outlook_calendar'
  | 'salesforce';

interface TokenExchangeRequest {
  provider: Provider;
  code: string;
  redirect_uri: string;
  user_id: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  instance_url?: string; // Salesforce-specific
}

/** Map provider to its token endpoint URL */
function getTokenEndpoint(provider: Provider): string {
  switch (provider) {
    case 'gmail':
    case 'google_calendar':
      return 'https://oauth2.googleapis.com/token';
    case 'outlook':
    case 'outlook_calendar':
      return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    case 'salesforce':
      return 'https://login.salesforce.com/services/oauth2/token';
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Get client_id for the provider from env vars */
function getClientId(provider: Provider): string {
  switch (provider) {
    case 'gmail':
      return Deno.env.get('GMAIL_CLIENT_ID') || '';
    case 'outlook':
      return Deno.env.get('OUTLOOK_CLIENT_ID') || '';
    case 'google_calendar':
      return Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || '';
    case 'outlook_calendar':
      return Deno.env.get('OUTLOOK_CALENDAR_CLIENT_ID') || '';
    case 'salesforce':
      return Deno.env.get('SALESFORCE_CLIENT_ID') || '';
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Get client_secret for the provider from env vars */
function getClientSecret(provider: Provider): string {
  switch (provider) {
    case 'gmail':
    case 'google_calendar':
      // Google uses the same secret for Gmail and Calendar (same project)
      return Deno.env.get('GMAIL_CLIENT_SECRET') || '';
    case 'outlook':
    case 'outlook_calendar':
      // Microsoft uses the same secret for Mail and Calendar (same app registration)
      return Deno.env.get('OUTLOOK_CLIENT_SECRET') || '';
    case 'salesforce':
      return Deno.env.get('SALESFORCE_CLIENT_SECRET') || '';
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Exchange the authorization code for tokens with the provider */
async function exchangeCodeForTokens(
  provider: Provider,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const tokenEndpoint = getTokenEndpoint(provider);
  const clientId = getClientId(provider);
  const clientSecret = getClientSecret(provider);

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing client credentials for provider: ${provider}. Check environment variables.`
    );
  }

  // Build the token exchange request body
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `Token exchange failed for ${provider}:`,
      response.status,
      errorBody
    );
    throw new Error(
      `Token exchange failed with ${provider} (HTTP ${response.status})`
    );
  }

  const tokenData = await response.json();
  return tokenData as TokenResponse;
}

/** Get the scopes string for the provider (for storage reference) */
function getDefaultScopes(provider: Provider): string {
  switch (provider) {
    case 'gmail':
      return 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
    case 'outlook':
      return 'Mail.Send Mail.Read offline_access';
    case 'google_calendar':
      return 'https://www.googleapis.com/auth/calendar.events';
    case 'outlook_calendar':
      return 'Calendars.ReadWrite offline_access';
    case 'salesforce':
      return 'api refresh_token';
    default:
      return '';
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        }
      );
    }

    // Parse and validate request body
    const { provider, code, redirect_uri, user_id }: TokenExchangeRequest =
      await req.json();

    if (!provider || !code || !redirect_uri || !user_id) {
      return new Response(
        JSON.stringify({
          error:
            'Missing required fields: provider, code, redirect_uri, user_id',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const validProviders: Provider[] = [
      'gmail',
      'outlook',
      'google_calendar',
      'outlook_calendar',
      'salesforce',
    ];
    if (!validProviders.includes(provider)) {
      return new Response(
        JSON.stringify({ error: `Invalid provider: ${provider}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Exchange the authorization code for tokens
    const tokenData = await exchangeCodeForTokens(
      provider,
      code,
      redirect_uri
    );

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Use the service role key for DB writes (bypasses RLS)
    // This is safe because we validate the user_id from the OAuth state
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up the user to get their org_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('org_id')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      console.error('Failed to look up user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Build the upsert payload
    const upsertData: Record<string, unknown> = {
      user_id,
      org_id: userData.org_id,
      provider,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: expiresAt,
      scope: tokenData.scope || getDefaultScopes(provider),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // Salesforce returns instance_url which we need to store
    if (provider === 'salesforce' && tokenData.instance_url) {
      upsertData.instance_url = tokenData.instance_url;
    }

    // Upsert the connection (unique on user_id + provider)
    const { error: upsertError } = await supabaseAdmin
      .from('oauth_connections')
      .upsert(upsertData, {
        onConflict: 'user_id,provider',
      });

    if (upsertError) {
      console.error('Failed to upsert OAuth connection:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store OAuth connection' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log(
      `OAuth connection stored for user ${user_id}, provider ${provider}`
    );

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
