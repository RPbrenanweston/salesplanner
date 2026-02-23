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

      // A thread with more than 1 message means there's a reply
      if (threadData.messages && threadData.messages.length > 1) {
        // Get the most recent message (last in array is latest)
        const replyMessage = threadData.messages[threadData.messages.length - 1];
        const replyTimestamp = new Date(parseInt(replyMessage.internalDate));

        console.log(`Found reply in thread ${activity.thread_id} at ${replyTimestamp.toISOString()}`);

        // Update activity with replied_at timestamp
        await supabaseClient
          .from("activities")
          .update({
            replied_at: replyTimestamp.toISOString(),
          })
          .eq("id", activity.id);

        // TODO: Increment email_templates.reply_count if template was used
        // This requires storing template_id on activities table (future enhancement)

        repliesFound++;
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
      const outlookSearchUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${activity.conversation_id}' and from/emailAddress/address eq '${contact.email}' and receivedDateTime ge ${new Date(activity.created_at).toISOString()}&$select=id,receivedDateTime&$orderby=receivedDateTime asc&$top=1`;

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
