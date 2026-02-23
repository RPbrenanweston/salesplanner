import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceConfig {
  weekly: string;
  monthly: string;
  annual: string;
}

// Stripe Price IDs (TODO: replace with actual Price IDs from Stripe Dashboard)
const PRICE_IDS: Record<'sdr' | 'ae' | 'manager', PriceConfig> = {
  sdr: {
    weekly: 'price_sdr_weekly_placeholder',
    monthly: 'price_sdr_monthly_placeholder',
    annual: 'price_sdr_annual_placeholder',
  },
  ae: {
    weekly: 'price_ae_weekly_placeholder',
    monthly: 'price_ae_monthly_placeholder',
    annual: 'price_ae_annual_placeholder',
  },
  manager: {
    weekly: 'price_manager_weekly_placeholder',
    monthly: 'price_manager_monthly_placeholder',
    annual: 'price_manager_annual_placeholder',
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { role, billingPeriod } = await req.json();

    if (!role || !billingPeriod) {
      throw new Error('Missing required fields: role, billingPeriod');
    }

    if (!['sdr', 'ae', 'manager'].includes(role)) {
      throw new Error('Invalid role');
    }

    if (!['weekly', 'monthly', 'annual'].includes(billingPeriod)) {
      throw new Error('Invalid billing period');
    }

    // Get user's organization
    const { data: userData, error: orgError } = await supabaseClient
      .from('users')
      .select('org_id, email, display_name')
      .eq('id', user.id)
      .single();

    if (orgError || !userData) {
      throw new Error('User organization not found');
    }

    // Get or create Stripe customer
    const { data: orgData } = await supabaseClient
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', userData.org_id)
      .single();

    let customerId = orgData?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userData.email,
        name: orgData?.name || userData.display_name,
        metadata: {
          org_id: userData.org_id,
          user_id: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to organization
      await supabaseClient
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', userData.org_id);
    }

    // Get price ID for selected plan
    const priceId = PRICE_IDS[role as 'sdr' | 'ae' | 'manager'][billingPeriod as 'weekly' | 'monthly' | 'annual'];

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14, // 14-day free trial
        metadata: {
          org_id: userData.org_id,
          user_id: user.id,
          role,
        },
      },
      success_url: `${req.headers.get('origin')}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/pricing`,
      metadata: {
        org_id: userData.org_id,
        user_id: user.id,
        role,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
