-- Team Invitations Table
-- Stores pending team member invitations

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email, status) -- Prevent duplicate pending invites for same email
);

-- Index for querying invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id ON team_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- RLS Policies for team_invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Managers can see invitations they sent or for their team
CREATE POLICY "Managers can view team invitations"
  ON team_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = team_invitations.org_id
        AND users.role = 'manager'
    )
  );

-- Managers can create invitations for their team
CREATE POLICY "Managers can create team invitations"
  ON team_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = team_invitations.org_id
        AND users.role = 'manager'
        AND users.id = team_invitations.invited_by
    )
  );

-- Managers can delete pending invitations
CREATE POLICY "Managers can delete team invitations"
  ON team_invitations
  FOR DELETE
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = team_invitations.org_id
        AND users.role = 'manager'
    )
  );

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- Trigger to expire invitations (run daily via cron or edge function)
-- Note: This is a manual function call - set up a Supabase Edge Function cron to call it
