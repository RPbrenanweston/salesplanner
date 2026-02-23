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
