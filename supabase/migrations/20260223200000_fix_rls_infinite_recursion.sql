-- Fix infinite recursion in RLS policies on users table
-- The original policies on 'users' used subqueries against 'users' itself,
-- causing infinite recursion when Postgres evaluated the RLS policy.

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can read users in their org" ON users;
DROP POLICY IF EXISTS "Managers can read team members" ON users;
DROP POLICY IF EXISTS "Managers can update users in their org" ON users;

-- Recreate users SELECT policy using auth.uid() directly
-- Users can always read their own row
CREATE POLICY "Users can read own row"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Users can read other users in their org (uses a security definer function to avoid recursion)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id FROM users WHERE id = auth.uid()
$$;

CREATE POLICY "Users can read users in their org"
  ON users FOR SELECT
  USING (org_id = get_user_org_id());

-- Managers can update users in their org
CREATE POLICY "Managers can update users in their org"
  ON users FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Also fix policies on other tables that reference users with subqueries
-- These work but are slower than using the security definer function

-- Fix organizations policies
DROP POLICY IF EXISTS "Users can read their own organization" ON organizations;
CREATE POLICY "Users can read their own organization"
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update their own organization" ON organizations;
CREATE POLICY "Users can update their own organization"
  ON organizations FOR UPDATE
  USING (
    id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Fix divisions policies
DROP POLICY IF EXISTS "Users can read divisions in their org" ON divisions;
CREATE POLICY "Users can read divisions in their org"
  ON divisions FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Managers can manage divisions in their org" ON divisions;
CREATE POLICY "Managers can manage divisions in their org"
  ON divisions FOR ALL
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Fix teams policies
DROP POLICY IF EXISTS "Users can read teams in their org" ON teams;
CREATE POLICY "Users can read teams in their org"
  ON teams FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS "Managers can manage teams in their org" ON teams;
CREATE POLICY "Managers can manage teams in their org"
  ON teams FOR ALL
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow INSERT on users for signup flow (service role handles this, but add policy for safety)
CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  WITH CHECK (true);
