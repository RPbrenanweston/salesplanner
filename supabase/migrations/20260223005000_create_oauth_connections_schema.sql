-- OAuth Connections table
-- Stores OAuth tokens and connection metadata for external integrations (Gmail, Outlook, Calendar, Salesforce)

CREATE TABLE IF NOT EXISTS oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'google_calendar', 'outlook_calendar', 'salesforce')),

  -- OAuth token data (sensitive)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,

  -- Connection metadata
  email_address TEXT,
  scope TEXT NOT NULL, -- Requested OAuth scopes

  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one connection per user per provider
  UNIQUE (user_id, provider)
);

-- Indexes for performance
CREATE INDEX idx_oauth_connections_org_id ON oauth_connections(org_id);
CREATE INDEX idx_oauth_connections_user_id ON oauth_connections(user_id);
CREATE INDEX idx_oauth_connections_provider ON oauth_connections(provider);

-- RLS policies
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OAuth connections
CREATE POLICY "Users can view their own OAuth connections"
  ON oauth_connections
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own OAuth connections
CREATE POLICY "Users can create their own OAuth connections"
  ON oauth_connections
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own OAuth connections
CREATE POLICY "Users can update their own OAuth connections"
  ON oauth_connections
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own OAuth connections
CREATE POLICY "Users can delete their own OAuth connections"
  ON oauth_connections
  FOR DELETE
  USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER set_oauth_connections_updated_at
  BEFORE UPDATE ON oauth_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
