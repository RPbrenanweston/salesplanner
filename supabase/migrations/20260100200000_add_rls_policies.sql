-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Organizations policies
-- Users can only read/write their own organization
CREATE POLICY "Users can read their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Divisions policies
-- Users can read divisions in their organization
CREATE POLICY "Users can read divisions in their org"
  ON divisions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Managers can create/update/delete divisions in their org
CREATE POLICY "Managers can manage divisions in their org"
  ON divisions FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Teams policies
-- Users can read teams in their organization
CREATE POLICY "Users can read teams in their org"
  ON teams FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Managers can manage teams in their org
CREATE POLICY "Managers can manage teams in their org"
  ON teams FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Users policies
-- Users can read other users in their organization
CREATE POLICY "Users can read users in their org"
  ON users FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Managers can read all users in their org (for team management)
CREATE POLICY "Managers can read team members"
  ON users FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Managers can update users in their org (role assignment, team assignment)
CREATE POLICY "Managers can update users in their org"
  ON users FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );
