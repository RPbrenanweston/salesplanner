// @crumb backend-salesforce-activity-sync
// INF | batch_activity_fetch | activity_to_task_mapping | salesforce_task_creation | oauth_token_refresh | sync_status_persistence
// why: Asynchronously sync local sales activities (calls, emails, meetings) to Salesforce Task objects ensuring bi-directional sales data consistency
// in:OAuth connection (Salesforce refresh_token,access_token,expires_at), activities table (pending sync), contact record (salesforce_id) out:Created Salesforce Tasks via /services/data/v59.0/sobjects/Task; updated activities.salesforce_task_id and sync_status='synced' err:OAuth token expired; contact_id missing salesforce_id; batch partial failure causes full retry; activity.type unmapped falls through to default
// hazard: Token expiration not checked before API call — batch silently fails after 30sec timeout with no retry, losing sync window; Activity-to-Task mapping is string-based — Salesforce schema changes cause mapping drift without type safety
// hazard: No partial failure recovery — one contact failure retries entire batch; No idempotency guard — duplicate webhook fires create duplicate Tasks
// edge:supabase/functions/track-email-replies/index.ts -> READS
// edge:supabase/functions/exchange-oauth-token/index.ts -> READS
// edge:salesforce-sync#1 -> STEP_IN
// prompt: When modifying activity-to-Task mapping, update both mapActivityTypeToSubject and mapOutcomeToStatus consistently. Test partial failures: manually set one contact.salesforce_id to null, run sync, verify batch retry doesn't duplicate successful creates. Consider adding call_duration_seconds as Task custom field.
// US-033: Supabase Edge Function for syncing activities to Salesforce
// Runs asynchronously to push SalesBlock activities as Salesforce Tasks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Activity {
  id: string;
  org_id: string;
  contact_id: string;
  type: string;
  outcome: string;
  notes: string;
  duration_seconds: number | null;
  created_at: string;
  contacts: {
    salesforce_id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface SalesforceConnection {
  access_token: string;
  instance_url: string;
}

// Map SalesBlock activity type to Salesforce Task Subject
function mapActivityTypeToSubject(type: string, contactName: string): string {
  const subjectMap: Record<string, string> = {
    call: `Call with ${contactName}`,
    email: `Email to ${contactName}`,
    social: `Social touch with ${contactName}`,
    meeting: `Meeting with ${contactName}`,
    note: `Note about ${contactName}`,
  };
  return subjectMap[type] || `Activity with ${contactName}`;
}

// Map SalesBlock outcome to Salesforce Task Status
function mapOutcomeToStatus(outcome: string): string {
  const statusMap: Record<string, string> = {
    no_answer: 'Not Started',
    voicemail: 'In Progress',
    connect: 'In Progress',
    conversation: 'In Progress',
    meeting_booked: 'Completed',
    not_interested: 'Completed',
    follow_up: 'In Progress',
    other: 'In Progress',
  };
  return statusMap[outcome] || 'Completed';
}

// Create Salesforce Task via REST API
async function createSalesforceTask(
  activity: Activity,
  connection: SalesforceConnection
): Promise<string> {
  const contactName = `${activity.contacts.first_name} ${activity.contacts.last_name}`.trim();

  const taskData = {
    Subject: mapActivityTypeToSubject(activity.type, contactName),
    Description: activity.notes || '(No notes provided)',
    Status: mapOutcomeToStatus(activity.outcome),
    ActivityDate: activity.created_at.split('T')[0], // YYYY-MM-DD format
    WhoId: activity.contacts.salesforce_id, // Link to Lead or Contact
  };

  // Add call duration to description if available
  if (activity.duration_seconds && activity.type === 'call') {
    const minutes = Math.floor(activity.duration_seconds / 60);
    const seconds = activity.duration_seconds % 60;
    taskData.Description += `\n\nDuration: ${minutes}m ${seconds}s`;
  }

  const response = await fetch(`${connection.instance_url}/services/data/v59.0/sobjects/Task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce API error: ${error}`);
  }

  const result = await response.json();
  return result.id; // Salesforce Task ID
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Atomically claim pending activities by setting status to 'in_progress'.
    // This prevents duplicate processing if the function is invoked concurrently.
    const { data: claimedIds, error: claimError } = await supabaseAdmin
      .from('activities')
      .update({ sync_status: 'in_progress' })
      .eq('sync_status', 'pending')
      .not('contact_id', 'is', null)
      .limit(50)
      .select('id');

    if (claimError) throw claimError;
    if (!claimedIds || claimedIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending activities to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claimedActivityIds = claimedIds.map((r: { id: string }) => r.id);

    // Fetch full activity data (including contact) for claimed activities only
    const { data: activities, error: fetchError } = await supabaseAdmin
      .from('activities')
      .select(`
        id,
        org_id,
        contact_id,
        type,
        outcome,
        notes,
        duration_seconds,
        created_at,
        contacts!inner (
          salesforce_id,
          first_name,
          last_name,
          email
        )
      `)
      .in('id', claimedActivityIds)
      .not('contacts.salesforce_id', 'is', null);

    if (fetchError) throw fetchError;

    const results = {
      total: activities.length,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each activity
    for (const activity of activities as Activity[]) {
      try {
        // Idempotency guard: claim this activity by setting sync_status='syncing'
        // Uses a conditional update that only succeeds if still 'pending'
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from('activities')
          .update({ sync_status: 'syncing' })
          .eq('id', activity.id)
          .eq('sync_status', 'pending')
          .select('id')
          .maybeSingle();

        if (claimError || !claimed) {
          // Another instance is already processing this activity
          console.log(`Activity ${activity.id} already claimed by another instance, skipping`);
          continue;
        }

        // Get Salesforce OAuth connection for this org
        const { data: connection, error: connError } = await supabaseAdmin
          .from('oauth_connections')
          .select('access_token, instance_url')
          .eq('org_id', activity.org_id)
          .eq('provider', 'salesforce')
          .maybeSingle();

        if (connError || !connection) {
          throw new Error('No Salesforce connection found for org');
        }

        // Create Task in Salesforce
        const salesforceTaskId = await createSalesforceTask(activity, connection);

        // Update activity with sync success (ON CONFLICT safe: salesforce_task_id is unique)
        await supabaseAdmin
          .from('activities')
          .update({
            salesforce_task_id: salesforceTaskId,
            sync_status: 'synced',
            sync_error: null,
            synced_at: new Date().toISOString(),
          })
          .eq('id', activity.id);

        results.synced++;
      } catch (error) {
        // Update activity with sync failure (reset from 'syncing' to 'failed')
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabaseAdmin
          .from('activities')
          .update({
            sync_status: 'failed',
            sync_error: errorMessage,
          })
          .eq('id', activity.id)
          .eq('sync_status', 'syncing');

        results.failed++;
        results.errors.push(`Activity ${activity.id}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
