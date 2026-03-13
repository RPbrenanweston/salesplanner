// @crumb frontend-page-pricing
// UI/PAGES | render_pricing_tiers | billing_period_toggle | stripe_checkout | handle_redirect
// why: Pricing and billing — display role-based plan tiers with billing period toggle, trigger Stripe checkout
// in:supabase(functions.invoke for create-checkout-session,auth.getSession),pricing tier constants(hardcoded) out:pricing grid with period toggle,plan feature lists,CTA per tier,Stripe redirect err:edge function failure(alert shown),session fetch failure(silent),Stripe redirect failure(silent)
// hazard: Pricing tier prices are hardcoded — any change requires code deploy; price drift between frontend and Stripe catalogue possible
// hazard: Checkout triggered with role identifier only — if Stripe price ID mapping diverges from frontend role names, wrong plans charged
// edge:supabase/functions/create-checkout-session/index.ts -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:pricing#1 -> STEP_IN
// prompt: Pull pricing from Supabase table to avoid price drift. Add error toast instead of alert. Add loading spinner on CTA during checkout.
import { useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

type BillingPeriod = 'weekly' | 'monthly' | 'annual';

interface PricingTier {
  name: string;
  role: 'sdr' | 'ae' | 'manager';
  weeklyPrice: number;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  headerClass: string;
  ctaClass: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'SDR Plan',
    role: 'sdr',
    weeklyPrice: 3.50,
    monthlyPrice: 14,
    annualPrice: 149,
    features: [
      'Unlimited SalesBlocks',
      'Contact & List Management',
      'Email Integration (Gmail/Outlook)',
      'Social Activity Tracking',
      'Basic Analytics',
      'Call Script Library',
    ],
    headerClass: 'bg-indigo-electric text-white',
    ctaClass: 'bg-indigo-electric hover:bg-indigo-electric/80 text-white',
  },
  {
    name: 'AE Plan',
    role: 'ae',
    weeklyPrice: 4.50,
    monthlyPrice: 18,
    annualPrice: 189,
    features: [
      'Everything in SDR Plan',
      'Pipeline & Deal Management',
      'Calendar Sync (Google/Outlook)',
      'Meeting Scheduling',
      'Salesforce Integration',
      'Advanced Analytics',
    ],
    headerClass: 'bg-cyan-neon text-void-950',
    ctaClass: 'bg-cyan-neon hover:bg-cyan-neon/80 text-void-950',
  },
  {
    name: 'Manager Plan',
    role: 'manager',
    weeklyPrice: 5.50,
    monthlyPrice: 22,
    annualPrice: 229,
    features: [
      'Everything in AE Plan',
      'Team Dashboard & Leaderboards',
      'Assign SalesBlocks to Team',
      'Team Performance Analytics',
      'Custom KPI Builder',
      'Revenue Forecasting',
    ],
    headerClass: 'bg-purple-neon text-void-950',
    ctaClass: 'bg-purple-neon hover:bg-purple-neon/80 text-void-950',
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const getPrice = (tier: PricingTier): string => {
    if (billingPeriod === 'weekly') return `$${tier.weeklyPrice.toFixed(2)}`;
    if (billingPeriod === 'monthly') return `$${tier.monthlyPrice}`;
    return `$${tier.annualPrice}`;
  };

  const getPeriodLabel = (): string => {
    if (billingPeriod === 'weekly') return '/week';
    if (billingPeriod === 'monthly') return '/month';
    return '/year';
  };

  const getSavingsBadge = (): string | null => {
    if (billingPeriod === 'annual') return 'Save 15%';
    return null;
  };

  const handleCheckout = async (tier: PricingTier) => {
    try {
      setLoading(tier.role);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please sign in to subscribe');
        window.location.href = '/signin';
        return;
      }

      // Create Stripe Checkout Session via Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          role: tier.role,
          billingPeriod,
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-950 via-void-900 to-void-950 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-display text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-white/60">
            Start your 14-day free trial. No credit card required.
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-lg border border-white/10 p-1 bg-void-900/40">
            <button
              onClick={() => setBillingPeriod('weekly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ease-snappy ${
                billingPeriod === 'weekly'
                  ? 'bg-indigo-electric text-white'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ease-snappy ${
                billingPeriod === 'monthly'
                  ? 'bg-indigo-electric text-white'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ease-snappy relative ${
                billingPeriod === 'annual'
                  ? 'bg-indigo-electric text-white'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              Annual
              {getSavingsBadge() && (
                <span className="absolute -top-3 -right-3 bg-emerald-signal text-void-950 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {getSavingsBadge()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-8">
          {pricingTiers.map((tier) => (
            <div
              key={tier.role}
              className="glass-card border-2 border-white/10 overflow-hidden hover:border-white/20 transition-all ease-snappy"
            >
              <div className={`${tier.headerClass} px-6 py-4`}>
                <h3 className="text-2xl font-bold font-display">{tier.name}</h3>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-white">
                      {getPrice(tier)}
                    </span>
                    <span className="text-white/60 ml-2">
                      {getPeriodLabel()}
                    </span>
                  </div>
                  <p className="text-sm text-white/40 mt-2">
                    14-day free trial
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-emerald-signal mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(tier)}
                  disabled={loading !== null}
                  className={`w-full ${tier.ctaClass} font-semibold py-3 rounded-lg transition-colors ease-snappy disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === tier.role ? 'Processing...' : 'Start Free Trial'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Trial Info */}
        <div className="mt-16 text-center">
          <div className="bg-indigo-electric/10 rounded-lg p-8 border border-indigo-electric/20">
            <h3 className="text-2xl font-bold font-display text-white mb-4">
              14-Day Free Trial Includes Full Access
            </h3>
            <ul className="text-left max-w-2xl mx-auto space-y-2 text-white/70">
              <li className="flex items-center">
                <Check className="w-5 h-5 text-emerald-signal mr-3" />
                No credit card required to start
              </li>
              <li className="flex items-center">
                <Check className="w-5 h-5 text-emerald-signal mr-3" />
                Full access to all features in your plan
              </li>
              <li className="flex items-center">
                <Check className="w-5 h-5 text-emerald-signal mr-3" />
                Cancel anytime during trial with no charge
              </li>
              <li className="flex items-center">
                <Check className="w-5 h-5 text-emerald-signal mr-3" />
                Automatically converts to paid plan after trial
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
