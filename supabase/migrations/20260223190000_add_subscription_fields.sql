-- Add subscription fields to users table for trial and subscription management (US-043)

-- Add subscription_status to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'inactive'));

-- Add trial_ends_at to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- Add subscription_role to track which plan the user is on
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_role TEXT CHECK (subscription_role IN ('sdr', 'ae', 'manager'));

-- Update existing users to have trial status with 14-day trial
UPDATE users
SET subscription_status = 'trial',
    trial_ends_at = NOW() + INTERVAL '14 days'
WHERE subscription_status IS NULL;

-- Create index for querying expired trials
CREATE INDEX IF NOT EXISTS idx_users_trial_expiry ON users(trial_ends_at) WHERE subscription_status = 'trial';

COMMENT ON COLUMN users.subscription_status IS 'User subscription status: trial (14 days), active (paid), past_due (payment failed), canceled (subscription ended), inactive (trial expired)';
COMMENT ON COLUMN users.trial_ends_at IS 'Timestamp when the free trial expires';
COMMENT ON COLUMN users.subscription_role IS 'The role tier for this subscription (sdr, ae, manager)';
