-- Call Scripts Schema
-- Stores call scripts for guidance during salesblocks

CREATE TABLE call_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown/rich text content
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;

-- Users can read scripts they own or shared scripts in their org
CREATE POLICY call_scripts_select_policy ON call_scripts
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (
      is_shared = true
      AND org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    )
  );

-- Users can insert their own scripts
CREATE POLICY call_scripts_insert_policy ON call_scripts
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own scripts
CREATE POLICY call_scripts_update_policy ON call_scripts
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own scripts
CREATE POLICY call_scripts_delete_policy ON call_scripts
  FOR DELETE
  USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX idx_call_scripts_org_id ON call_scripts(org_id);
CREATE INDEX idx_call_scripts_owner_id ON call_scripts(owner_id);
CREATE INDEX idx_call_scripts_is_shared ON call_scripts(is_shared);

-- Updated_at trigger
CREATE TRIGGER update_call_scripts_updated_at
  BEFORE UPDATE ON call_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
