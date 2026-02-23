-- Create goals table for personal/team goal tracking
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('calls', 'emails', 'social_touches', 'meetings_booked', 'pipeline_value', 'custom')),
  target_value INTEGER NOT NULL CHECK (target_value > 0),
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  custom_metric_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_goals_org_id ON goals(org_id);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_metric_period ON goals(metric, period);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Users can view all goals in their org (for transparency/comparison)
CREATE POLICY "Users can view goals in their org"
  ON goals
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can create their own goals
CREATE POLICY "Users can create own goals"
  ON goals
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own goals
CREATE POLICY "Users can update own goals"
  ON goals
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own goals
CREATE POLICY "Users can delete own goals"
  ON goals
  FOR DELETE
  USING (user_id = auth.uid());

-- Managers can create goals for team members
CREATE POLICY "Managers can create team goals"
  ON goals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
      AND users.org_id = goals.org_id
    )
  );
