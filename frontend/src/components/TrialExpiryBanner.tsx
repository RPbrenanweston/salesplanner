import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DURATION, SUBSCRIPTION_STATUS, ROUTES } from '../lib/constants';

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
