-- Session Cockpit schema changes (Middle Ground PRD)
-- 1. session_type on salesblocks
-- 2. progress_flags on activities
-- 3. research_entries table

-- 1. Add session_type to salesblocks
ALTER TABLE salesblocks
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'call'
  CHECK (session_type IN ('call', 'email', 'social'));

CREATE INDEX IF NOT EXISTS idx_salesblocks_session_type ON salesblocks(session_type);

-- 2. Add progress_flags to activities (connected flow checkpoints)
-- Shape: { intro_given: bool, conversation_held: bool, asked_for_meeting: bool, meeting_booked: bool, objection_details: string }
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS progress_flags JSONB DEFAULT NULL;

-- 3. Research entries table
CREATE TABLE IF NOT EXISTS research_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('contact', 'company')),
  category TEXT NOT NULL CHECK (category IN ('news', 'pain_points', 'tech_stack', 'funding', 'general')),
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_contact_id ON research_entries(contact_id);
CREATE INDEX IF NOT EXISTS idx_research_company_name ON research_entries(company_name);
CREATE INDEX IF NOT EXISTS idx_research_org_id ON research_entries(org_id);

ALTER TABLE research_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY research_select_own_org ON research_entries
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY research_insert_own_org ON research_entries
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY research_update_own ON research_entries
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY research_delete_own ON research_entries
  FOR DELETE USING (created_by = auth.uid());

-- Updated_at trigger for research_entries
CREATE OR REPLACE FUNCTION update_research_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER research_entries_updated_at_trigger
  BEFORE UPDATE ON research_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_research_entries_updated_at();
