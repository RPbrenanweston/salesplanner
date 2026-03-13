// @crumb frontend-page-pricing
// UI/PAGES | render_pricing_tiers | billing_period_toggle | stripe_checkout | handle_redirect | supabase_fetch
// why: Pricing and billing — fetch role-based plan tiers from Supabase, display with billing period toggle, trigger Stripe checkout
// in:supabase(from pricing_plans table, functions.invoke for create-checkout-session, auth.getSession),pricing tier constants(fallback) out:pricing grid with period toggle,plan feature lists,CTA per tier,Stripe redirect err:fetch failure(toast shown),edge function failure(toast shown),session fetch failure(silent),Stripe redirect failure(silent)
// hazard: Checkout triggered with priceId from DB — if Stripe price ID in DB diverges from Stripe catalogue, wrong plans charged
// edge:supabase/functions/create-checkout-session/index.ts -> CALLS
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/App.tsx -> RELATES
// edge:pricing#1 -> STEP_IN
// prompt: None — pricing now fetched from Supabase pricing_plans table
import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '@/hooks/use-toast';

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
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
}

/** DB row shape from pricing_plans table */
interface PricingPlanRow {
  id: string;
  name: string;
  role: 'sdr' | 'ae' | 'manager';
  monthly_price_cents: number;
  annual_price_cents: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  features: string[];
  display_order: number;
}

/** Style map per role — keeps visual config out of the DB */
const ROLE_STYLES: Record<string, { headerClass: string; ctaClass: string }> = {
  sdr: {
    headerClass: 'bg-indigo-electric text-white',
    ctaClass: 'bg-indigo-electric hover:bg-indigo-electric/80 text-white',
  },
  ae: {
    headerClass: 'bg-cyan-neon text-void-950',
    ctaClass: 'bg-cyan-neon hover:bg-cyan-neon/80 text-void-950',
  },
  manager: {
    headerClass: 'bg-purple-neon text-void-950',
    ctaClass: 'bg-purple-neon hover:bg-purple-neon/80 text-void-950',
  },
};

const DEFAULT_STYLE = {
  headerClass: 'bg-indigo-electric text-white',
  ctaClass: 'bg-indigo-electric hover:bg-indigo-electric/80 text-white',
};

/** Hardcoded fallback tiers — kept as type reference and offline fallback */
const fallbackTiers: PricingTier[] = [
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
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
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
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
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
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
  },
];

function mapRowToTier(row: PricingPlanRow): PricingTier {
  const style = ROLE_STYLES[row.role] ?? DEFAULT_STYLE;
  return {
    name: row.name,
    role: row.role,
    weeklyPrice: 0, // weekly not stored in DB — will be hidden gracefully
    monthlyPrice: row.monthly_price_cents / 100,
    annualPrice: row.annual_price_cents / 100,
    features: row.features ?? [],
    headerClass: style.headerClass,
    ctaClass: style.ctaClass,
    stripePriceIdMonthly: row.stripe_price_id_monthly,
    stripePriceIdAnnual: row.stripe_price_id_annual,
  };
}

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchPricing() {
      try {
        const { data, error } = await supabase
          .from('pricing_plans')
          .select('id, name, role, monthly_price_cents, annual_price_cents, stripe_price_id_monthly, stripe_price_id_annual, features, display_order')
          .order('display_order', { ascending: true });

        if (cancelled) return;

        if (error) {
          console.error('Failed to fetch pricing plans:', error);
          toast({
            title: 'Failed to load pricing',
            description: 'Could not retrieve current pricing. Showing cached prices.',
            variant: 'destructive',
          });
          setTiers(fallbackTiers);
          setFetchError(false); // fallback loaded, not a total failure
        } else if (!data || data.length === 0) {
          setTiers([]);
          setFetchError(true);
        } else {
          setTiers((data as PricingPlanRow[]).map(mapRowToTier));
          setFetchError(false);
        }
      } catch (err) {
        console.error('Pricing fetch exception:', err);
        if (cancelled) return;
        toast({
          title: 'Failed to load pricing',
          description: 'Could not retrieve current pricing. Showing cached prices.',
          variant: 'destructive',
        });
        setTiers(fallbackTiers);
        setFetchError(false);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    fetchPricing();
    return () => { cancelled = true; };
  }, []);

  const getPrice = (tier: PricingTier): string => {
    if (billingPeriod === 'weekly') return tier.weeklyPrice > 0 ? `$${tier.weeklyPrice.toFixed(2)}` : '--';
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

  /** Resolve the Stripe price ID for the selected tier and billing period */
  const getStripePriceId = (tier: PricingTier): string | null => {
    if (billingPeriod === 'annual') return tier.stripePriceIdAnnual;
    if (billingPeriod === 'monthly') return tier.stripePriceIdMonthly;
    // weekly has no Stripe price ID from the DB
    return null;
  };

  const handleCheckout = async (tier: PricingTier) => {
    try {
      setLoading(tier.role);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to subscribe to a plan.',
          variant: 'destructive',
        });
        window.location.href = '/signin';
        return;
      }

      const stripePriceId = getStripePriceId(tier);

      // Build request body — send priceId when available, fall back to role-based
      const body: Record<string, string> = {
        role: tier.role,
        billingPeriod,
      };
      if (stripePriceId) {
        body.priceId = stripePriceId;
      }

      // Create Stripe Checkout Session via Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify(body),
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
      toast({
        title: 'Checkout failed',
        description: 'Failed to start checkout. Please try again.',
        variant: 'destructive',
      });
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

        {/* Loading Skeleton */}
        {fetching && (
          <div className="grid md:grid-cols-3 gap-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="glass-card border-2 border-white/10 overflow-hidden animate-pulse"
              >
                <div className="bg-white/10 px-6 py-4">
                  <div className="h-8 bg-white/10 rounded w-2/3" />
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <div className="h-12 bg-white/10 rounded w-1/2 mb-2" />
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                  </div>
                  <div className="space-y-3 mb-8">
                    {[0, 1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="flex items-center">
                        <div className="w-5 h-5 bg-white/10 rounded mr-3" />
                        <div className="h-4 bg-white/10 rounded flex-1" />
                      </div>
                    ))}
                  </div>
                  <div className="h-12 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state — pricing unavailable */}
        {!fetching && fetchError && tiers.length === 0 && (
          <div className="text-center py-20">
            <p className="text-xl text-white/60 mb-4">
              Pricing unavailable — contact us
            </p>
            <a
              href="mailto:support@salesblock.io"
              className="inline-block bg-indigo-electric hover:bg-indigo-electric/80 text-white font-semibold px-8 py-3 rounded-lg transition-colors ease-snappy"
            >
              Contact Sales
            </a>
          </div>
        )}

        {/* Pricing Tiers */}
        {!fetching && tiers.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier) => (
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
                    className={`w-full ${tier.ctaClass} font-semibold py-3 rounded-lg transition-colors ease-snappy disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                  >
                    {loading === tier.role ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Start Free Trial'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
