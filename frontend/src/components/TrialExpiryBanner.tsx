/**
 * @crumb
 * @id frontend-component-trial-expiry-banner
 * @area UI/Billing/Trial
 * @intent Trial expiry banner — display a persistent warning when the org's trial is expiring or expired, with a CTA to upgrade and a dismiss option
 * @responsibilities Fetch org subscription/trial status from Supabase, determine days remaining in trial, show banner with urgency level (warning vs critical), navigate to /pricing on upgrade click, allow banner dismissal
 * @contracts TrialExpiryBanner({ orgId }) → JSX | null; reads orgs table for trial_ends_at and subscription_status; returns null if subscription active or no trial data; shows banner if trial_ends_at within threshold
 * @in orgId (string), supabase orgs table (trial_ends_at, subscription_status fields), useNavigate for /pricing redirect
 * @out Rendered banner with days-remaining message and upgrade CTA; or null if subscription active; navigation to /pricing on upgrade click
 * @err Supabase read failure (banner silently not rendered — no error shown to user); missing trial_ends_at (banner does not show)
 * @hazard Banner dismissal state is managed in React local state only — if the user navigates away and returns, the banner reappears; there is no persistent "dismissed" flag in Supabase or localStorage
 * @hazard Trial end date comparison uses client-side Date.now() — if the user's system clock is wrong, the banner may show prematurely or not show when the trial has actually expired; server-side validation is required for gating
 * @shared-edges supabase orgs table→READS trial_ends_at + subscription_status; frontend/src/pages/PricingPage.tsx→NAVIGATES to on upgrade click; App.tsx or layout component→RENDERS banner in global layout
 * @trail trial-banner#1 | User loads page → TrialExpiryBanner fetches org → trial_ends_at within 7 days → banner renders → user clicks "Upgrade" → /pricing → Stripe checkout
 * @prompt Persist banner dismissal to localStorage or Supabase user_preferences. Add server-side gating in RLS policies as primary control — client banner is secondary UX only. Show different messaging for expired vs expiring.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
      if (userData.subscription_status !== 'trial') {
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

      // Show banner if trial is expiring soon (7 days or less) or expired
      if (diffDays <= 7) {
        setShowBanner(true);
        setTrialExpired(diffDays <= 0);
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
    }
  };

  const handleUpgrade = () => {
    navigate('/pricing');
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
