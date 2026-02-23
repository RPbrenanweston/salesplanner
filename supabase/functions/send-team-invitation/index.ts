import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    const { invitation_id, email, org_id, team_id, role } = await req.json()

    // Verify the user is a manager in the org
    const { data: userData } = await supabaseClient
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.role !== 'manager' || userData.org_id !== org_id) {
      throw new Error('Unauthorized: only managers can send invitations')
    }

    // Get org name for the email
    const { data: orgData } = await supabaseClient
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single()

    const orgName = orgData?.name || 'SalesBlock.io'

    // Generate invitation URL with metadata
    // The invited user will sign up via this magic link with pre-filled org/team assignment
    const invitationUrl = `${Deno.env.get('SITE_URL')}/signup?invitation_id=${invitation_id}&email=${encodeURIComponent(email)}`

    // Send invitation email via Supabase Auth Admin API
    const { error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: invitationUrl,
        data: {
          invitation_id,
          org_id,
          team_id,
          role,
          display_name: email.split('@')[0], // Default display name from email
        },
      }
    )

    if (inviteError) {
      throw new Error(`Failed to send invitation: ${inviteError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending invitation:', error)
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
