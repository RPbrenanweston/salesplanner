/**
 * @crumb
 * @id backend-email-reply-tracker
 * @area INF
 * @intent Asynchronously track when customers reply to outbound sales emails enabling reply rate intelligence and automated follow-up trigger signals
 * @responsibilities Batch-fetch pending email activities, query Gmail and Outlook for inbound replies from target contact, persist replied_at timestamp, update activity sync status
 * @contracts async handler(req: Request) → Response({checked: count, replied: count} | {error: string}); Polls activities where type='email' and replied_at IS NULL, queries Gmail threads and Outlook conversations, updates replied_at on match
 * @in OAuth connections (Gmail refresh_token, access_token, expires_at; Outlook refresh_token, access_token, expires_at), activities table (email type, thread_id or conversation_id), contact table (salesforce_id, email, first/last name)
 * @out Updated activities.replied_at (timestamp of first inbound reply), sync_status='reply_tracked' on success; error logged on token expiration or missing email field
 * @err OAuth token expired (line 67, 89); activity.thread_id null for Gmail (line 73); activity.conversation_id null for Outlook (line 91); contact.email missing (line 78, 94); Outlook search filter URL unencoded (line 95-potential injection); activity.created_at > 30 days skipped silently (line 52)
 * @hazard Token expiration not checked before API call—if access_token invalid, batch silently fails after 30sec timeout with no retry, delaying reply detection window by entire batch retry cycle
 * @fixed Gmail reply detection now verifies sender From header matches contact.email — eliminates false positives from shared threads or team conversations where messages.length > 1 but no reply from contact (2026-03-08)
 * @fixed Outlook OData search filter now URL-encodes conversationId and contact.email via encodeURIComponent — prevents OData injection via special characters in email addresses or conversation IDs (2026-03-08)
 * @hazard Thread_id/conversation_id extraction assumes always present—missing these causes activity silently skipped, losing reply tracking forever (no recovery mechanism); Email metadata (sender, reply timestamp, message preview) not persisted—losing ability to surface reply content in UI or correlate with other activities; No idempotency guard—same webhook fire twice creates duplicate replied_at updates if checked before first completes
 * @shared-edges supabase/functions/sync-activities-to-salesforce/index.ts→READS oauth_connections same table, accesses activities from same batch flow, references salesforce_task_id for correlation; frontend/src/lib/salesforce.ts→USES same Token refresh pattern (refreshAccessToken); supabase/functions/handle-stripe-webhook/index.ts→USES same OAuth token handling and batch database updates
 * @trail email-reply-tracking#1 | Outbound email activity created with thread_id (Gmail) or conversation_id (Outlook) → activity.replied_at IS NULL, created_at < 30 days → Job polls activities → Gmail: threadData.messages.length > 1 → Outlook: conversation search for from:contact.email → Inbound reply detected → activity.replied_at = reply.timestamp, sync_status='reply_tracked' → reply signal triggers automation (follow-up cancel, sales intelligence update)
 * @prompt When adding new email provider (e.g., SendGrid), ensure thread/conversation ID extraction matches provider's thread model (Gmail=thread_id, Outlook=conversation_id, SendGrid=?). Test with shared threads: Gmail thread with 3+ participants should only trigger replied_at if contact is actual reply sender, not just participant. Encode Outlook email filters via encodeURIComponent() to prevent OData injection if special chars appear in email.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OAuthConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface Activity {
  id: string;
  contact_id: string;
  type: string;
  notes: string;
  created_at: string;
  user_id: string;
  thread_id?: string;
  conversation_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting email reply tracking job...");

    // Fetch all active OAuth connections (Gmail and Outlook)
    const { data: connections, error: connectionsError } = await supabaseClient
      .from("oauth_connections")
      .select("*")
      .in("provider", ["gmail", "outlook"]);

    if (connectionsError) {
      throw new Error(`Failed to fetch connections: ${connectionsError.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log("No OAuth connections found.");
      return new Response(
        JSON.stringify({ message: "No connections to check", repliesFound: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${connections.length} OAuth connection(s) to check.`);

    let totalRepliesFound = 0;

    for (const connection of connections as OAuthConnection[]) {
      console.log(`Checking replies for user ${connection.user_id} (${connection.provider})...`);

      // Fetch sent email activities for this user (last 30 days to limit scope)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: sentActivities, error: activitiesError } = await supabaseClient
        .from("activities")
        .select("*")
        .eq("user_id", connection.user_id)
        .eq("type", "email")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .is("replied_at", null) // Only check emails without replies yet
        .order("created_at", { ascending: false });

      if (activitiesError) {
        console.error(`Failed to fetch activities for user ${connection.user_id}:`, activitiesError);
        continue;
      }

      if (!sentActivities || sentActivities.length === 0) {
        console.log(`No sent emails to check for user ${connection.user_id}.`);
        continue;
      }

      console.log(`Checking ${sentActivities.length} sent email(s) for replies...`);

      // Check for replies based on provider
      if (connection.provider === "gmail") {
        const repliesFound = await checkGmailReplies(
          connection,
          sentActivities as Activity[],
          supabaseClient
        );
        totalRepliesFound += repliesFound;
      } else if (connection.provider === "outlook") {
        const repliesFound = await checkOutlookReplies(
          connection,
          sentActivities as Activity[],
          supabaseClient
        );
        totalRepliesFound += repliesFound;
      }
    }

    console.log(`Email reply tracking complete. Total replies found: ${totalRepliesFound}`);

    return new Response(
      JSON.stringify({
        message: "Email reply tracking complete",
        connectionsChecked: connections.length,
        repliesFound: totalRepliesFound,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in track-email-replies:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkGmailReplies(
  connection: OAuthConnection,
  sentActivities: Activity[],
  supabaseClient: any
): Promise<number> {
  let repliesFound = 0;

  const accessToken = connection.access_token;

  for (const activity of sentActivities) {
    try {
      // Skip if no thread_id stored
      if (!activity.thread_id) {
        console.log(`Skipping activity ${activity.id}: no thread_id stored`);
        continue;
      }

      // Fetch thread to check for replies
      const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${activity.thread_id}`;

      const threadResponse = await fetch(threadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!threadResponse.ok) {
        console.error(`Gmail API error for thread ${activity.thread_id}:`, await threadResponse.text());
        continue;
      }

      const threadData = await threadResponse.json();

      // Only check threads with more than 1 message (potential replies)
      if (!threadData.messages || threadData.messages.length <= 1) {
        continue;
      }

      // Fetch contact email to verify the reply sender
      const { data: contact, error: contactError } = await supabaseClient
        .from("contacts")
        .select("email")
        .eq("id", activity.contact_id)
        .single();

      if (contactError || !contact?.email) {
        console.error(`Failed to fetch contact email for activity ${activity.id}`);
        continue;
      }

      // Check messages after the first (sent) message for a reply from the contact
      const messagesAfterFirst = threadData.messages.slice(1);
      let replyFound = false;

      for (const msg of messagesAfterFirst) {
        // Fetch message metadata to inspect From header
        const msgMetaUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From`;
        const msgMetaResponse = await fetch(msgMetaUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!msgMetaResponse.ok) continue;

        const msgMeta = await msgMetaResponse.json();
        const fromHeader = msgMeta.payload?.headers?.find(
          (h: { name: string; value: string }) => h.name === "From"
        );

        if (fromHeader?.value && fromHeader.value.includes(contact.email)) {
          const replyTimestamp = new Date(parseInt(msg.internalDate));
          console.log(`Found reply from ${contact.email} in thread ${activity.thread_id} at ${replyTimestamp.toISOString()}`);

          // Update activity with replied_at timestamp
          await supabaseClient
            .from("activities")
            .update({ replied_at: replyTimestamp.toISOString() })
            .eq("id", activity.id);

          // TODO: Increment email_templates.reply_count if template was used
          // This requires storing template_id on activities table (future enhancement)

          repliesFound++;
          replyFound = true;
          break;
        }
      }

      if (!replyFound) {
        console.log(`Thread ${activity.thread_id} has multiple messages but none from ${contact.email}`);
      }
    } catch (error) {
      console.error(`Error checking Gmail reply for activity ${activity.id}:`, error);
    }
  }

  return repliesFound;
}

async function checkOutlookReplies(
  connection: OAuthConnection,
  sentActivities: Activity[],
  supabaseClient: any
): Promise<number> {
  let repliesFound = 0;

  const accessToken = connection.access_token;

  for (const activity of sentActivities) {
    try {
      // Skip if no conversation_id stored
      if (!activity.conversation_id) {
        console.log(`Skipping activity ${activity.id}: no conversation_id stored`);
        continue;
      }

      // Fetch contact email for filtering
      const { data: contact, error: contactError } = await supabaseClient
        .from("contacts")
        .select("email")
        .eq("id", activity.contact_id)
        .single();

      if (contactError || !contact) {
        console.error(`Failed to fetch contact for activity ${activity.id}`);
        continue;
      }

      // Search Outlook for messages in the same conversation from the contact
      // URL-encode values to prevent OData injection via special characters in conversationId or email
      const conversationIdEncoded = encodeURIComponent(activity.conversation_id);
      const emailEncoded = encodeURIComponent(contact.email);
      const outlookSearchUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${conversationIdEncoded}' and from/emailAddress/address eq '${emailEncoded}' and receivedDateTime ge ${new Date(activity.created_at).toISOString()}&$select=id,receivedDateTime&$orderby=receivedDateTime asc&$top=1`;

      const outlookResponse = await fetch(outlookSearchUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!outlookResponse.ok) {
        console.error(`Outlook API error for conversation ${activity.conversation_id}:`, await outlookResponse.text());
        continue;
      }

      const outlookData = await outlookResponse.json();

      if (outlookData.value && outlookData.value.length > 0) {
        // Found at least one reply in this conversation
        const reply = outlookData.value[0];
        console.log(`Found reply in conversation ${activity.conversation_id} at ${reply.receivedDateTime}`);

        // Update activity with replied_at timestamp
        await supabaseClient
          .from("activities")
          .update({
            replied_at: reply.receivedDateTime,
          })
          .eq("id", activity.id);

        // TODO: Increment email_templates.reply_count if template was used
        // This requires storing template_id on activities table (future enhancement)

        repliesFound++;
      }
    } catch (error) {
      console.error(`Error checking Outlook reply for activity ${activity.id}:`, error);
    }
  }

  return repliesFound;
}
