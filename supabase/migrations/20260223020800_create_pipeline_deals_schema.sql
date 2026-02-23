-- US-034: Pipeline stages and deals database schema
-- Creates pipeline_stages and deals tables with RLS policies

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6', -- default blue
  probability INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  value DECIMAL(12, 2) DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  close_date DATE,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for pipeline_stages
CREATE INDEX idx_pipeline_stages_org_id ON pipeline_stages(org_id);
CREATE INDEX idx_pipeline_stages_position ON pipeline_stages(org_id, position);

-- Indexes for deals
CREATE INDEX idx_deals_org_id ON deals(org_id);
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_stage_id ON deals(stage_id);
CREATE INDEX idx_deals_close_date ON deals(close_date);

-- Enable RLS
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- RLS policies for pipeline_stages
-- Users can view all stages in their org
CREATE POLICY "Users can view org pipeline stages"
  ON pipeline_stages FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Only managers can create/update/delete stages
CREATE POLICY "Managers can create pipeline stages"
  ON pipeline_stages FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update pipeline stages"
  ON pipeline_stages FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete pipeline stages"
  ON pipeline_stages FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS policies for deals
-- Users can view deals in their org
CREATE POLICY "Users can view org deals"
  ON deals FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can create their own deals
CREATE POLICY "Users can create own deals"
  ON deals FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- Users can update their own deals
CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own deals
CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  USING (user_id = auth.uid());

-- Updated_at trigger for deals
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default pipeline stages (for new orgs)
-- These will be created when an org is created
-- For now, we'll insert defaults for all existing orgs
INSERT INTO pipeline_stages (org_id, name, position, color, probability, is_default)
SELECT
  o.id as org_id,
  stage_data.name,
  stage_data.position,
  stage_data.color,
  stage_data.probability,
  TRUE as is_default
FROM
  organizations o,
  (VALUES
    ('Prospect', 1, '#6B7280', 10),      -- gray
    ('Qualified', 2, '#3B82F6', 25),     -- blue
    ('Proposal', 3, '#F59E0B', 50),      -- amber
    ('Negotiation', 4, '#8B5CF6', 75),   -- violet
    ('Closed Won', 5, '#10B981', 100),   -- green
    ('Closed Lost', 6, '#EF4444', 0)     -- red
  ) AS stage_data(name, position, color, probability)
WHERE NOT EXISTS (
  -- Only insert if org has no stages yet
  SELECT 1 FROM pipeline_stages ps WHERE ps.org_id = o.id
);
