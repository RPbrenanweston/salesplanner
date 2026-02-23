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
  color: string;
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
    color: 'blue',
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
    color: 'indigo',
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
    color: 'violet',
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Start your 14-day free trial. No credit card required.
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 p-1 bg-white dark:bg-gray-800">
            <button
              onClick={() => setBillingPeriod('weekly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors relative ${
                billingPeriod === 'annual'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Annual
              {getSavingsBadge() && (
                <span className="absolute -top-3 -right-3 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
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
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className={`bg-${tier.color}-600 text-white px-6 py-4`}>
                <h3 className="text-2xl font-bold">{tier.name}</h3>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">
                      {getPrice(tier)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {getPeriodLabel()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    14-day free trial
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(tier)}
                  disabled={loading !== null}
                  className={`w-full bg-${tier.color}-600 hover:bg-${tier.color}-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === tier.role ? 'Processing...' : 'Start Free Trial'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Trial Info */}
        <div className="mt-16 text-center">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-8 border border-blue-200 dark:border-blue-800">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              14-Day Free Trial Includes Full Access
            </h3>
            <ul className="text-left max-w-2xl mx-auto space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3" />
                No credit card required to start
              </li>
              <li className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3" />
                Full access to all features in your plan
              </li>
              <li className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3" />
                Cancel anytime during trial with no charge
              </li>
              <li className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-3" />
                Automatically converts to paid plan after trial
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
