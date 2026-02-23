-- US-021: Email templates CRUD
-- Migration: Create email_templates table with RLS policies

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT FALSE,
  times_used INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_email_templates_org_id ON email_templates(org_id);
CREATE INDEX idx_email_templates_owner_id ON email_templates(owner_id);

-- Create updated_at trigger
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own templates + shared templates in their org
CREATE POLICY email_templates_select_policy ON email_templates
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR
    (is_shared = true AND org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

-- RLS Policy: Users can insert their own templates
CREATE POLICY email_templates_insert_policy ON email_templates
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- RLS Policy: Users can update their own templates
CREATE POLICY email_templates_update_policy ON email_templates
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- RLS Policy: Users can delete their own templates
CREATE POLICY email_templates_delete_policy ON email_templates
  FOR DELETE
  USING (owner_id = auth.uid());
