// @crumb backend-stripe-webhook-handler
// INF | webhook_signature_validation | event_type_dispatch | subscription_status_update | stripe_state_enum_mapping
// why: Ingest and synchronously apply Stripe billing events (checkout, subscription state changes, payment failures) to local subscription state ensuring payment status accuracy
// in:Stripe webhook payload + signature header, org/user IDs from session metadata, Supabase admin client (service role) out:Updated organizations.stripe_customer_id, users.subscription_status; 400 on missing/invalid signature, 500 on database error err:Webhook signature verification fails if secret invalid; missing org_id/user_id in metadata; database connection fails
// hazard: Token expiration not checked on constructEvent — if webhook secret rotates mid-batch, subsequent events fail silently
// hazard: Metadata extraction assumes org_id and user_id always present — missing these silently breaks; no idempotency guard — same webhook fired twice creates duplicate state updates
// edge:supabase/functions/sync-activities-to-salesforce/index.ts -> READS
// edge:supabase/functions/create-checkout-session/index.ts -> RELATES
// edge:payment-lifecycle#1 -> STEP_IN
// prompt: When adding new Stripe event handlers, verify metadata extraction (org_id, user_id required), test idempotency (fire webhook twice, expect same state), validate enum mapping against Stripe docs, consider webhook retry behavior (Stripe retries for 5 days)
import Stripe from 'https://esm.sh/stripe@14.14.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'stripe-signature, content-type',
      },
    })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), { status: 400 })
  }

  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  // Idempotency guard: skip if this event was already processed
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existingEvent) {
    console.log(`Skipping already-processed event: ${event.id} (${event.type})`)
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Record event as processing (insert before processing to prevent race)
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })

  if (insertError) {
    // If insert fails due to unique constraint, another instance is processing
    if (insertError.code === '23505') {
      console.log(`Concurrent processing detected for event: ${event.id}`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Failed to record webhook event:', insertError)
    // Continue processing even if recording fails — better to double-process than miss
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const metadata = session.metadata || {}
        const orgId = metadata.org_id
        const userId = metadata.user_id

        if (!orgId || !userId) {
          console.error('Missing org_id or user_id in session metadata')
          break
        }

        // Update organization with Stripe customer ID
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', orgId)

        // Update user subscription status
        await supabase
          .from('users')
          .update({ subscription_status: 'trial' }) // Starts as trial
          .eq('id', userId)

        console.log(`Checkout completed for user ${userId}, subscription ${subscriptionId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find org by customer ID
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!org) {
          console.error(`No org found for customer ${customerId}`)
          break
        }

        // Map Stripe subscription status to our enum
        const stripeToInternal: Record<string, string> = {
          trialing: 'trial',
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
        }
        const status = stripeToInternal[subscription.status]

        if (!status) {
          // Unknown Stripe status — log and preserve existing state rather than downgrading
          console.warn(`Unrecognised Stripe subscription status '${subscription.status}' for org ${org.id}. Skipping status update to avoid silent downgrade.`)
          break
        }

        // Update all users in the org
        await supabase
          .from('users')
          .update({ subscription_status: status })
          .eq('org_id', org.id)

        console.log(`Subscription updated for org ${org.id}: ${status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!org) {
          console.error(`No org found for customer ${customerId}`)
          break
        }

        await supabase
          .from('users')
          .update({ subscription_status: 'canceled' })
          .eq('org_id', org.id)

        console.log(`Subscription deleted for org ${org.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!org) {
          console.error(`No org found for customer ${customerId}`)
          break
        }

        await supabase
          .from('users')
          .update({ subscription_status: 'past_due' })
          .eq('org_id', org.id)

        console.log(`Payment failed for org ${org.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
})
