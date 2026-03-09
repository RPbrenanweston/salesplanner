/**
 * @crumb
 * @id backend-salesforce-activity-sync
 * @area INF
 * @intent Asynchronously sync local sales activities (calls, emails, meetings) to Salesforce Task objects ensuring bi-directional sales data consistency
 * @responsibilities Batch-fetch pending activities, map activity type/outcome to Salesforce Task subjects/statuses, create Tasks via REST API, persist salesforce_task_id, handle OAuth token refresh
 * @contracts async handler(req: Request) → Response({synced: count} | {error: string}); Maps 50-item activity batches; maps activity.type to Task subject; maps activity.outcome to status enum
 * @in OAuth connection (Salesforce refresh_token, access_token, expires_at), activities table (pending sync), contact record (salesforce_id for task target)
 * @out Created Salesforce Tasks via /services/data/v59.0/sobjects/Task; updated activities.salesforce_task_id and sync_status='synced'
 * @err OAuth token expired (line 45); activity.contact_id missing salesforce_id (line 78); batch of 50 has 1 contact failure—entire batch retried, partial sync lost (line 95); activity.type unmapped to subject (line 52-59 falls through to default)
 * @hazard Token expiration not checked before API call—if access_token invalid, batch silently fails after 30sec timeout with no retry, losing sync window; Activity-to-Task mapping is string-based (mapActivityTypeToSubject, mapOutcomeToStatus)—if Salesforce schema changes or enums added, mapping drifts without type safety (lines 52-59, 65-72)
 * @hazard No partial failure recovery—if contact #25 of 50 has missing salesforce_id, entire batch queued for retry, delaying contacts #26-50; Email/call metadata (duration, thread_id, conversation_id) not persisted to Salesforce—losing call duration and reply tracking integration (line 88-90); No idempotency guard—same webhook fire twice creates duplicate Tasks with different IDs
 * @shared-edges supabase/functions/track-email-replies/index.ts→READS oauth_connections same table, accesses activities from same batch flow; frontend/src/lib/salesforce.ts→USES same Token refresh pattern (refreshAccessToken), same Task creation endpoint; supabase/functions/handle-stripe-webhook/index.ts→USES same pattern of OAuth token handling and batch database updates
 * @trail salesforce-sync#1 | Activity created locally → activity.sync_status='pending' → Job polls activities table → OAuth token fetched/refreshed → mapActivityType→subject, mapOutcome→status → POST /services/data/v59.0/sobjects/Task → Salesforce Task created → activity.salesforce_task_id set, sync_status='synced' → reply tracking references salesforce_task_id for updates
 * @prompt When modifying activity-to-Task mapping, update both mapActivityTypeToSubject and mapOutcomeToStatus consistently (e.g., if activity.type adds 'demo', add case to subject mapping). Test partial failures: manually set one contact.salesforce_id to null, run sync, verify batch retry doesn't duplicate successful creates. Consider adding call_duration_seconds as Task custom field to preserve sales intelligence.
 */
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

    // Fetch all pending activities with salesforce_id
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
      .eq('sync_status', 'pending')
      .not('contacts.salesforce_id', 'is', null)
      .limit(50); // Process 50 activities per run

    if (fetchError) throw fetchError;
    if (!activities || activities.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending activities to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      total: activities.length,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each activity
    for (const activity of activities as Activity[]) {
      try {
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

        // Update activity with sync success
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
        // Update activity with sync failure
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabaseAdmin
          .from('activities')
          .update({
            sync_status: 'failed',
            sync_error: errorMessage,
          })
          .eq('id', activity.id);

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
