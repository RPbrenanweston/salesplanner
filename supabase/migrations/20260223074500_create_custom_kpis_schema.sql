-- US-041: Custom KPI builder

-- Create custom_kpis table
CREATE TABLE IF NOT EXISTS custom_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  formula_type TEXT NOT NULL CHECK (formula_type IN ('count', 'ratio', 'sum')),
  numerator_metric TEXT NOT NULL,
  denominator_metric TEXT,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_custom_kpis_org_id ON custom_kpis(org_id);
CREATE INDEX idx_custom_kpis_user_id ON custom_kpis(user_id);

-- Enable RLS
ALTER TABLE custom_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users see all custom KPIs in their org
CREATE POLICY "Users can view custom KPIs in their org"
  ON custom_kpis FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can create their own custom KPIs
CREATE POLICY "Users can insert their own custom KPIs"
  ON custom_kpis FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Users can update their own custom KPIs
CREATE POLICY "Users can update their own custom KPIs"
  ON custom_kpis FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own custom KPIs
CREATE POLICY "Users can delete their own custom KPIs"
  ON custom_kpis FOR DELETE
  USING (user_id = auth.uid());
