/**
 * @crumb
 * @id backend-stripe-webhook-handler
 * @area INF
 * @intent Ingest and synchronously apply Stripe billing events (checkout, subscription state changes, payment failures) to local subscription state ensuring payment status accuracy
 * @responsibilities Validate webhook signature, dispatch on event type, update subscription_status for org members, map Stripe states to internal enum
 * @contracts Deno.serve(req: Request) → Response({received: true} | {error: string}); handles 4 event types (checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed)
 * @in Stripe webhook payload + signature header, org/user IDs from session metadata, Supabase admin client (service role)
 * @out Updated organizations.stripe_customer_id, users.subscription_status on success; 400 on missing/invalid signature, 500 on database error
 * @err Webhook signature verification fails if secret invalid or payload tampered (line 34); missing org_id/user_id in metadata (line 52); database connection fails (lines 58-65, 98-101)
 * @hazard Token expiration not checked on Stripe.webhooks.constructEvent—if webhook secret rotates mid-batch, subsequent events fail silently (line 34); subscription status enum mismatch (line 91-95): Stripe 'trialing'→'trial', 'active'→'active', 'past_due'→'past_due', but if Stripe adds new status code, falls through to 'inactive', losing intent
 * @hazard Metadata extraction assumes org_id and user_id always present—missing these silently breaks (lines 49-54); no idempotency guard—same webhook fired twice will create duplicate state updates (no unique constraint on stripe_webhook_id in code)
 * @shared-edges supabase/functions/sync-activities-to-salesforce/index.ts→READS oauth_connections same table for Salesforce tokens; frontend/src/lib/supabase.ts→USES same Supabase client singleton; src/types.ts→DEPENDS on subscription_status enum definition
 * @trail payment-lifecycle#1 | Stripe charge → webhook fired → signature verified → event type matched (switch) → subscription_status updated in users table based on Stripe status → org.stripe_customer_id linked
 * @prompt When adding new Stripe event handlers, verify metadata extraction (org_id, user_id required), test idempotency (fire webhook twice, expect same state), validate enum mapping (trialing→trial, past_due→past_due, etc.) against Stripe docs, consider webhook retry behavior (Stripe retries for 5 days)
 */
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
        let status: string
        if (subscription.status === 'trialing') status = 'trial'
        else if (subscription.status === 'active') status = 'active'
        else if (subscription.status === 'past_due') status = 'past_due'
        else if (subscription.status === 'canceled') status = 'canceled'
        else status = 'inactive'

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
