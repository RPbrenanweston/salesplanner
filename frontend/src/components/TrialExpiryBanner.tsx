// @crumb frontend-component-trial-expiry-banner
// UI/Billing/Trial | fetch_trial_status | days_remaining_calculation | urgency_banner | upgrade_cta | dismiss_option
// why: Trial expiry banner — display a persistent warning when the org's trial is expiring or expired, with a CTA to upgrade and a dismiss option
// in:orgId,supabase orgs table (trial_ends_at, subscription_status),useNavigate out:Rendered banner with days-remaining and upgrade CTA,or null if active err:Supabase read failure (banner silently not rendered),missing trial_ends_at
// hazard: Banner dismissal in React local state only — reappears on navigation, no persistent dismissed flag
// hazard: Trial end date uses client-side Date.now() — wrong system clock causes incorrect display, server-side gating required
// edge:frontend/src/pages/PricingPage.tsx -> RELATES
// edge:trial-banner#1 -> STEP_IN
// prompt: Persist banner dismissal to localStorage or Supabase user_preferences. Add server-side gating in RLS policies as primary control. Show different messaging for expired vs expiring.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DURATION, SUBSCRIPTION_STATUS } from '../lib/constants';
import { ROUTES } from '../lib/routes';

export default function TrialExpiryBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkTrialStatus();
  }, []);

  const checkTrialStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('subscription_status, trial_ends_at')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // Only show for trial users
      if (userData.subscription_status !== SUBSCRIPTION_STATUS.TRIAL) {
        setShowBanner(false);
        return;
      }

      if (!userData.trial_ends_at) {
        setShowBanner(false);
        return;
      }

      const trialEndsAt = new Date(userData.trial_ends_at);
      const now = new Date();
      const diffMs = trialEndsAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      setDaysRemaining(diffDays);

      // Show banner if trial is expiring soon (TRIAL_EXPIRY_WARNING_DAYS or less) or expired
      if (diffDays <= DURATION.TRIAL_EXPIRY_WARNING_DAYS) {
        setShowBanner(true);
        setTrialExpired(diffDays <= 0);
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
    }
  };

  const handleUpgrade = () => {
    navigate(ROUTES.PRICING);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className={`${
      trialExpired ? 'bg-red-600' : 'bg-yellow-500'
    } text-white px-4 py-3 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="font-medium">
            {trialExpired ? (
              <>
                Your trial has expired. Please subscribe to continue using SalesBlock.io
              </>
            ) : (
              <>
                Your trial expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}.
                Upgrade now to keep full access.
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpgrade}
            className={`${
              trialExpired
                ? 'bg-white text-red-600 hover:bg-gray-100'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            } px-4 py-2 rounded-md font-semibold transition-colors`}
          >
            {trialExpired ? 'Subscribe Now' : 'Upgrade Plan'}
          </button>
          {!trialExpired && (
            <button
              onClick={handleDismiss}
              className="text-white hover:bg-white/20 rounded-md p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
