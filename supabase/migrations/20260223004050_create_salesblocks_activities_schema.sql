-- Migration: Create salesblocks and activities schema
-- US-013: SalesBlock and activity database schema

-- SalesBlocks table: timed focus sessions for sales reps
CREATE TABLE IF NOT EXISTS salesblocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  calendar_event_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table: log of all contact interactions
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salesblock_id UUID REFERENCES salesblocks(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'social', 'meeting', 'note')),
  outcome TEXT CHECK (outcome IN ('no_answer', 'voicemail', 'connect', 'conversation', 'meeting_booked', 'not_interested', 'follow_up', 'other')),
  notes TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_salesblocks_user_id ON salesblocks(user_id);
CREATE INDEX idx_salesblocks_list_id ON salesblocks(list_id);
CREATE INDEX idx_salesblocks_scheduled_start ON salesblocks(scheduled_start);
CREATE INDEX idx_salesblocks_status ON salesblocks(status);
CREATE INDEX idx_salesblocks_org_id ON salesblocks(org_id);

CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_salesblock_id ON activities(salesblock_id);
CREATE INDEX idx_activities_org_id ON activities(org_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);

-- Enable RLS
ALTER TABLE salesblocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for salesblocks

-- Users can read their own salesblocks
CREATE POLICY salesblocks_select_own ON salesblocks
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Managers can read their team's salesblocks
CREATE POLICY salesblocks_select_team ON salesblocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'manager'
        AND u.team_id IN (
          SELECT team_id FROM users WHERE id = salesblocks.user_id
        )
    )
  );

-- Users can insert their own salesblocks
CREATE POLICY salesblocks_insert_own ON salesblocks
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Managers can insert salesblocks for their team members
CREATE POLICY salesblocks_insert_for_team ON salesblocks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users manager
      WHERE manager.id = auth.uid()
        AND manager.role = 'manager'
        AND manager.team_id IN (
          SELECT team_id FROM users WHERE id = salesblocks.user_id
        )
        AND salesblocks.org_id = manager.org_id
    )
  );

-- Users can update their own salesblocks
CREATE POLICY salesblocks_update_own ON salesblocks
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own salesblocks
CREATE POLICY salesblocks_delete_own ON salesblocks
  FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for activities

-- Users can read their own activities
CREATE POLICY activities_select_own ON activities
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Managers can read their team's activities
CREATE POLICY activities_select_team ON activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'manager'
        AND u.team_id IN (
          SELECT team_id FROM users WHERE id = activities.user_id
        )
    )
  );

-- Users can insert activities in their own org
CREATE POLICY activities_insert_own ON activities
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Users can update their own activities
CREATE POLICY activities_update_own ON activities
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own activities
CREATE POLICY activities_delete_own ON activities
  FOR DELETE
  USING (user_id = auth.uid());
