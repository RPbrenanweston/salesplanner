/**
 * Shared CORS headers for Supabase Edge Functions.
 * Import this in every edge function to avoid duplicating CORS config.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
